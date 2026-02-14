#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const PROFILE_URL = 'https://www.instagram.com/agricheck.srl/';
const OUTPUT_PATH = 'assets/ig-posts.json';
const LIMIT = Number.parseInt(process.env.IG_POSTS_LIMIT ?? '12', 10);
const TIMEOUT_MS = 60_000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

const normalizePermalink = (href) => {
  if (typeof href !== 'string') return null;
  const match = href.match(/^\/(p|reel)\/([A-Za-z0-9_-]+)\/?/i);
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
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ userAgent: USER_AGENT });
    const page = await context.newPage();

    await page.goto(PROFILE_URL, {
      waitUntil: 'networkidle',
      timeout: TIMEOUT_MS
    });

    await page.waitForTimeout(3000);
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(2000);
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(2000);

    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .map((a) => a.getAttribute('href'))
        .filter((href) => href && (href.includes('/p/') || href.includes('/reel/')));
    });

    const permalinks = dedupePreserveOrder(
      links.map((href) => normalizePermalink(href)).filter(Boolean)
    );

    if (permalinks.length === 0) {
      throw new Error('Instagram grid did not load: no /p/ or /reel/ links found after scroll.');
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
