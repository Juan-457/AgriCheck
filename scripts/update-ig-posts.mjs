#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const INSTAGRAM_HOME_URL = 'https://www.instagram.com/';
const PROFILE_URL = 'https://www.instagram.com/agricheck.srl/?hl=en';
const USERNAME = 'agricheck.srl';
const OUTPUT_PATH = 'assets/ig-posts.json';
const LIMIT = Number.parseInt(process.env.IG_POSTS_LIMIT ?? '12', 10);
const explicitStrict = (process.env.IG_POSTS_STRICT ?? '').toLowerCase();
const STRICT_MODE = ['1', 'true', 'yes'].includes(explicitStrict);
const TIMEOUT_MS = 60_000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
const DEBUG_SCREENSHOT_PATH = 'debug-grid.png';
const DEBUG_HTML_PATH = 'debug-grid.html';
const DEBUG_HTML_MAX_CHARS = 200_000;
const POST_HREF_SELECTOR = 'a[href*="/p/"], a[href*="/reel/"], a[href*="instagram.com/p/"], a[href*="instagram.com/reel/"]';
const IG_APP_ID = '936619743392459';
const WEB_PROFILE_API_URL = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(USERNAME)}`;
const STRATEGY_MAX_ATTEMPTS = Math.max(1, Number.parseInt(process.env.IG_STRATEGY_MAX_ATTEMPTS ?? '3', 10));
const RETRY_BASE_MS = Math.max(500, Number.parseInt(process.env.IG_RETRY_BASE_MS ?? '2000', 10));
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const humanDelay = async (page, minMs, maxMs) => {
  await page.waitForTimeout(randomBetween(minMs, maxMs));
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizePermalink = (href) => {
  if (typeof href !== 'string') return null;

  const trimmed = href.trim().replaceAll('\\u002F', '/');
  if (!trimmed) return null;

  const absoluteMatch = trimmed.match(/^https?:\/\/(?:www\.)?instagram\.com\/(p|reel)\/([A-Za-z0-9_-]+)\/?/i);
  if (absoluteMatch) {
    return `https://www.instagram.com/${absoluteMatch[1].toLowerCase()}/${absoluteMatch[2]}/`;
  }

  const relativeMatch = trimmed.match(/^\/(p|reel)\/([A-Za-z0-9_-]+)\/?/i);
  if (relativeMatch) {
    return `https://www.instagram.com/${relativeMatch[1].toLowerCase()}/${relativeMatch[2]}/`;
  }

  return null;
};

const dedupePreserveOrder = (items) => {
  const unique = [];
  const seen = new Set();

  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    unique.push(item);

    if (Number.isFinite(LIMIT) && LIMIT > 0 && unique.length >= LIMIT) {
      break;
    }
  }

  return unique;
};

const BASE_PERMALINKS = dedupePreserveOrder([
  'https://www.instagram.com/p/DUrI-shEs80/?img_index=1',
  'https://www.instagram.com/p/DUJiGiniTnm/'
].map((href) => normalizePermalink(href)).filter(Boolean));

const extractPermalinksFromText = (text) => {
  if (typeof text !== 'string' || text.length === 0) return [];

  const candidates = [];
  const patterns = [
    /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel)\/[A-Za-z0-9_-]+\/?/gi,
    /\/(?:p|reel)\/[A-Za-z0-9_-]+\/?/gi,
    /\\u002F(?:p|reel)\\u002F[A-Za-z0-9_-]+(?:\\u002F)?/gi
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = match?.[0];
      if (!raw) continue;
      candidates.push(raw.replaceAll('\\u002F', '/'));
    }
  }

  return dedupePreserveOrder(candidates.map((href) => normalizePermalink(href)).filter(Boolean));
};

const extractPermalinksFromApiPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return [];

  const candidateShortcodes = [
    payload?.data?.user?.edge_owner_to_timeline_media?.edges,
    payload?.data?.user?.edge_felix_video_timeline?.edges,
    payload?.graphql?.user?.edge_owner_to_timeline_media?.edges,
    payload?.items
  ];

  const shortcodes = [];
  for (const nodes of candidateShortcodes) {
    if (!Array.isArray(nodes)) continue;

    for (const item of nodes) {
      const node = item?.node ?? item?.media ?? item;
      const shortcode = node?.shortcode;
      if (typeof shortcode === 'string' && shortcode.length > 0) {
        shortcodes.push(`https://www.instagram.com/p/${shortcode}/`);
      }

      const permalink = normalizePermalink(node?.permalink ?? node?.code ?? node?.url);
      if (permalink) {
        shortcodes.push(permalink);
      }
    }
  }

  return dedupePreserveOrder(shortcodes.map((href) => normalizePermalink(href)).filter(Boolean));
};

const extractPermalinksFromWebApi = async () => {
  const response = await fetch(WEB_PROFILE_API_URL, {
    headers: {
      Accept: 'application/json',
      Referer: PROFILE_URL,
      'User-Agent': USER_AGENT,
      'X-IG-App-ID': IG_APP_ID,
      'X-Requested-With': 'XMLHttpRequest'
    }
  });

  if (!response.ok) {
    throw new Error(`Instagram API responded with ${response.status}`);
  }

  const payload = await response.json();
  return extractPermalinksFromApiPayload(payload);
};

const extractPermalinks = async () => {
  const strategies = [
    { name: 'playwright', run: extractPermalinksWithPlaywright },
    { name: 'web-api', run: extractPermalinksFromWebApi }
  ];

  const errors = [];

  const isRetryableError = (error) => {
    const message = String(error?.message ?? '').toLowerCase();
    return (
      message.includes('429') ||
      message.includes('timed out') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      message.includes('network')
    );
  };

  for (const strategy of strategies) {
    for (let attempt = 1; attempt <= STRATEGY_MAX_ATTEMPTS; attempt += 1) {
      try {
        const permalinks = await strategy.run();
        if (permalinks.length > 0) {
          console.log(`Permalinks obtained using ${strategy.name} (attempt ${attempt}/${STRATEGY_MAX_ATTEMPTS}).`);
          return permalinks;
        }

        const emptyError = new Error('returned 0 permalinks');
        if (attempt < STRATEGY_MAX_ATTEMPTS) {
          const waitMs = RETRY_BASE_MS * attempt;
          console.warn(
            `${strategy.name}: intento ${attempt}/${STRATEGY_MAX_ATTEMPTS} sin resultados. Reintento en ${waitMs} ms.`
          );
          await sleep(waitMs);
          continue;
        }

        errors.push(`${strategy.name}: ${emptyError.message}`);
        break;
      } catch (error) {
        if (attempt < STRATEGY_MAX_ATTEMPTS && isRetryableError(error)) {
          const waitMs = RETRY_BASE_MS * attempt;
          console.warn(
            `${strategy.name}: intento ${attempt}/${STRATEGY_MAX_ATTEMPTS} falló (${error.message}). Reintento en ${waitMs} ms.`
          );
          await sleep(waitMs);
          continue;
        }

        errors.push(`${strategy.name}: ${error.message}`);
        break;
      }
    }
  }

  throw new Error(`No se pudieron extraer permalinks de Instagram. Intentos: ${errors.join(' | ')}`);
};

const extractPermalinksWithPlaywright = async () => {
  let browser;

  try {
    browser = await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });
  } catch {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });
  }

  try {
    const context = await browser.newContext({
      locale: 'en-US',
      timezoneId: 'America/New_York',
      viewport: { width: 1366, height: 768 },
      userAgent: USER_AGENT
    });
    const page = await context.newPage();

    await page.goto(INSTAGRAM_HOME_URL, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT_MS
    });

    await humanDelay(page, 3000, 5000);

    await page.goto(PROFILE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT_MS
    });

    await humanDelay(page, 1500, 3000);

    const scrollCount = randomBetween(8, 10);
    for (let i = 0; i < scrollCount; i += 1) {
      await page.mouse.wheel(0, randomBetween(700, 1200));
      await humanDelay(page, 700, 1400);
    }

    await humanDelay(page, 1000, 1800);

    await page.waitForSelector(POST_HREF_SELECTOR, { timeout: 12_000 }).catch(() => null);

    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map((a) => a.getAttribute('href'))
        .filter(
          (href) =>
            href &&
            (href.includes('/p/') ||
              href.includes('/reel/') ||
              href.includes('instagram.com/p/') ||
              href.includes('instagram.com/reel/'))
        );
    });

    const permalinks = dedupePreserveOrder(
      links
        .map((href) => normalizePermalink(href))
        .filter(Boolean)
    );

    if (permalinks.length > 0) {
      return permalinks;
    }

    const htmlContent = await page.content();
    const htmlPermalinks = extractPermalinksFromText(htmlContent);

    if (htmlPermalinks.length > 0) {
      return htmlPermalinks;
    }

    const currentUrl = page.url().toLowerCase();
    if (!currentUrl.includes('/reels/')) {
      await page.goto(`${PROFILE_URL.replace(/\/?\?hl=en$/, '')}reels/`, {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT_MS
      });
      await humanDelay(page, 1200, 2200);
      await page.waitForSelector(POST_HREF_SELECTOR, { timeout: 10_000 }).catch(() => null);

      const reelsHtml = await page.content();
      const reelsPermalinks = extractPermalinksFromText(reelsHtml);
      if (reelsPermalinks.length > 0) {
        return reelsPermalinks;
      }
    }

    if (permalinks.length === 0) {
      await page.screenshot({ path: DEBUG_SCREENSHOT_PATH, fullPage: true });
      const latestHtml = await page.content();
      const truncatedHtml = latestHtml.slice(0, DEBUG_HTML_MAX_CHARS);
      await writeFile(DEBUG_HTML_PATH, truncatedHtml, 'utf8');
      throw new Error(
        `Grid not visible - no /p/ or /reel/ links found. Saved debug artifacts: ${DEBUG_SCREENSHOT_PATH}, ${DEBUG_HTML_PATH}`
      );
    }

    return permalinks;
  } finally {
    await browser.close();
  }
};

const run = async () => {
  try {
    const permalinks = await extractPermalinks();

    if (permalinks.length === 0) {
      throw new Error('No se extrajeron enlaces /p/ o /reel/ del perfil de Instagram usando Playwright.');
    }

    await writeFile(OUTPUT_PATH, `${JSON.stringify(permalinks, null, 2)}\n`, 'utf8');
    console.log(`Actualizado ${OUTPUT_PATH} con ${permalinks.length} publicaciones.`);
  } catch (error) {
    if (STRICT_MODE) {
      throw error;
    }

    const existing = await readFile(OUTPUT_PATH, 'utf8').catch(() => null);

    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.warn(
            `No se pudo refrescar Instagram (${error.message}). Se conserva ${OUTPUT_PATH} con ${parsed.length} enlaces previos. ` +
              'Define IG_POSTS_STRICT=true para forzar fallo del job.'
          );
          return;
        }
      } catch {
        // If existing file is corrupted, continue and try base permalinks below.
      }
    }

    if (BASE_PERMALINKS.length > 0) {
      await writeFile(OUTPUT_PATH, `${JSON.stringify(BASE_PERMALINKS, null, 2)}\n`, 'utf8');
      console.warn(
        `No se pudo refrescar Instagram (${error.message}). Se generó ${OUTPUT_PATH} con ${BASE_PERMALINKS.length} enlaces base.`
      );
      return;
    }

    await writeFile(OUTPUT_PATH, '[]\n', 'utf8');
    console.warn(
      `No se pudo refrescar Instagram (${error.message}). Se generó ${OUTPUT_PATH} vacío para evitar fallas del pipeline.`
    );
  }
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
