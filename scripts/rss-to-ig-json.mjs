#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';

const FEED_URL = process.env.IG_RSS_URL;
const OUTPUT_DIR = 'assets';
const OUTPUT_FILE = `${OUTPUT_DIR}/ig-posts.json`;
const MAX_POSTS = 9;
const IG_LINK_REGEX = /^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+\/?$/i;

if (!FEED_URL) {
  console.error('Missing IG_RSS_URL environment variable. Please set the repository secret IG_RSS_URL.');
  process.exit(1);
}

const response = await fetch(FEED_URL);
if (!response.ok) {
  console.error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
  process.exit(1);
}

const xml = await response.text();
const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  parseTagValue: true
});

const parsed = parser.parse(xml);
const rawItems = parsed?.rss?.channel?.item;
const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

const posts = items
  .map((item) => {
    const permalink = item?.link ? String(item.link).trim() : '';
    if (!permalink) return null;

    return {
      title: item?.title ? String(item.title).trim() : '',
      permalink,
      pubDate: item?.pubDate ? String(item.pubDate).trim() : '',
      description: item?.description ? String(item.description).trim() : ''
    };
  })
  .filter(Boolean)
  .slice(0, MAX_POSTS);

if (posts.length === 0) {
  let previousCount = 0;
  try {
    const previousRaw = await readFile(OUTPUT_FILE, 'utf8');
    const previousPayload = JSON.parse(previousRaw);
    if (Array.isArray(previousPayload?.posts)) {
      previousCount = previousPayload.posts.length;
    }
  } catch {
    // Si no existe archivo previo o está corrupto, se mantiene previousCount en 0.
  }

  console.error(
    `RSS without valid posts. Keeping existing ${OUTPUT_FILE} (previous posts: ${previousCount}).`
  );
  process.exit(1);
}

const normalizedPosts = posts.filter((post) => IG_LINK_REGEX.test(post.permalink));

if (normalizedPosts.length === 0) {
  console.error(`RSS fetched but no valid Instagram permalinks found. Keeping existing ${OUTPUT_FILE}.`);
  process.exit(1);
}

const payload = {
  updatedAt: new Date().toISOString(),
  source: 'rss.app',
  posts: normalizedPosts
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(`Updated ${OUTPUT_FILE} with ${normalizedPosts.length} posts.`);
