#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const PROFILE_URL = 'https://www.instagram.com/agricheck.srl/';
const OUTPUT_PATH = 'assets/ig-posts.json';
const LIMIT = Number.parseInt(process.env.IG_POSTS_LIMIT ?? '12', 10);
const TIMEOUT_MS = 30_000;
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

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
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT_MS
    });

    await page.waitForSelector('a[href*="/p/"], a[href*="/reel/"]', {
      timeout: TIMEOUT_MS
    });

    const hrefs = await page.$$eval('a[href*="/p/"], a[href*="/reel/"]', (anchors) =>
      anchors
        .map((anchor) => anchor.getAttribute('href'))
        .filter((href) => Boolean(href))
    );

    return dedupePreserveOrder(hrefs.map((href) => normalizePermalink(href)).filter(Boolean));
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
