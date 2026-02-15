#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';

const FEED_URL = process.env.IG_RSS_URL;
const OUTPUT_DIR = 'assets';
const OUTPUT_FILE = `${OUTPUT_DIR}/ig-posts.json`;
const MAX_POSTS = 9;

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

const payload = {
  updatedAt: new Date().toISOString(),
  source: 'rss.app',
  posts
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(`Updated ${OUTPUT_FILE} with ${posts.length} posts.`);
