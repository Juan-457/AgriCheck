#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const INSTAGRAM_HOME_URL = 'https://www.instagram.com/';
const PROFILE_URL = 'https://www.instagram.com/agricheck.srl/?hl=en';
const OUTPUT_PATH = 'assets/ig-posts.json';
const LIMIT = Number.parseInt(process.env.IG_POSTS_LIMIT ?? '12', 10);
const TIMEOUT_MS = 60_000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
const DEBUG_SCREENSHOT_PATH = 'debug-grid.png';
const DEBUG_HTML_PATH = 'debug-grid.html';
const DEBUG_HTML_MAX_CHARS = 200_000;

const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const humanDelay = async (page, minMs, maxMs) => {
  await page.waitForTimeout(randomBetween(minMs, maxMs));
};

const normalizePermalink = (href) => {
  if (typeof href !== 'string') return null;
  const trimmed = href.trim();
  const match = trimmed.match(/^\/(p|reel)\/([A-Za-z0-9_-]+)\/?/i);
  if (!match) return null;
  return `https://www.instagram.com/${match[1].toLowerCase()}/${match[2]}/`;
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

    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map((a) => a.getAttribute('href'))
        .filter((href) => href && (href.includes('/p/') || href.includes('/reel/')));
    });

    const permalinks = dedupePreserveOrder(
      links
        .map((href) => normalizePermalink(href))
        .filter(Boolean)
    );

    if (permalinks.length === 0) {
      await page.screenshot({ path: DEBUG_SCREENSHOT_PATH, fullPage: true });
      const htmlContent = await page.content();
      const truncatedHtml = htmlContent.slice(0, DEBUG_HTML_MAX_CHARS);
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
  const permalinks = await extractPermalinksWithPlaywright();

  if (permalinks.length === 0) {
    throw new Error('No se extrajeron enlaces /p/ o /reel/ del perfil de Instagram usando Playwright.');
  }

  await writeFile(OUTPUT_PATH, `${JSON.stringify(permalinks, null, 2)}\n`, 'utf8');
  console.log(`Actualizado ${OUTPUT_PATH} con ${permalinks.length} publicaciones.`);
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
