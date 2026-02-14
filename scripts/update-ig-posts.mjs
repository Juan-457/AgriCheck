#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';

const PROFILE_URL = 'https://www.instagram.com/agricheck.srl/';
const OUTPUT_PATH = 'assets/ig-posts.json';
const LIMIT = Number.parseInt(process.env.IG_POSTS_LIMIT ?? '12', 10);

const normalizePermalink = (value) => {
  if (typeof value !== 'string') return null;
  const decoded = value.replace(/\\\//g, '/');
  const match = decoded.match(/https?:\/\/(?:www\.)?instagram\.com\/(p|reel)\/([A-Za-z0-9_-]+)\/?/i);
  if (!match) return null;
  return `https://www.instagram.com/${match[1].toLowerCase()}/${match[2]}/`;
};

const extractPermalinks = (html) => {
  const matches = [];

  const absoluteRegex = /https?:\\?\/\\?\/(?:www\\?\.)?instagram\.com\\?\/(?:p|reel)\\?\/[A-Za-z0-9_-]+\\?\/?/gi;
  for (const match of html.matchAll(absoluteRegex)) {
    const permalink = normalizePermalink(match[0]);
    if (permalink) matches.push(permalink);
  }

  const relativeRegex = /(?:href|content)=["']\/(p|reel)\/([A-Za-z0-9_-]+)\/?["']/gi;
  for (const match of html.matchAll(relativeRegex)) {
    const permalink = normalizePermalink(`https://www.instagram.com/${match[1]}/${match[2]}/`);
    if (permalink) matches.push(permalink);
  }

  const unique = [];
  const seen = new Set();

  for (const permalink of matches) {
    if (seen.has(permalink)) continue;
    seen.add(permalink);
    unique.push(permalink);
    if (Number.isFinite(LIMIT) && LIMIT > 0 && unique.length >= LIMIT) break;
  }

  return unique;
};

const run = async () => {
  const response = await fetch(PROFILE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AgriCheckBot/1.0; +https://agricheck.com)'
    }
  });

  if (!response.ok) {
    throw new Error(`No se pudo obtener el perfil de Instagram (${response.status}).`);
  }

  const html = await response.text();
  const permalinks = extractPermalinks(html);

  if (permalinks.length === 0) {
    throw new Error('No se encontraron permalinks /p/ o /reel/ en el HTML del perfil.');
  }

  await writeFile(OUTPUT_PATH, `${JSON.stringify(permalinks, null, 2)}\n`, 'utf8');
  console.log(`Actualizado ${OUTPUT_PATH} con ${permalinks.length} publicaciones.`);
};

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
