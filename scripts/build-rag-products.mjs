import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const INPUT_FILE = 'nuestros-productos.html';
const COMPANY_SOURCE_FILE = 'index.html';
const SELLERS_SOURCE_FILE = 'Zonas.html';
const OUTPUT_FILE = 'assets/rag-products.json';
const BASE_URL = process.env.AGRICHECK_BASE_URL || 'https://www.agrichecksrl.com';

const decodeHtml = (text = '') =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const cleanText = (html = '') => decodeHtml(html.replace(/<[^>]+>/g, ' '));

const parseCSVAttribute = (value = '') =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const getAttr = (chunk, attrName) => {
  const match = chunk.match(new RegExp(`${attrName}="([^"]*)"`, 'i'));
  return match ? decodeHtml(match[1]) : '';
};

const getFirstMatch = (chunk, regex) => {
  const match = chunk.match(regex);
  return match ? cleanText(match[1]) : '';
};

const buildAbsoluteUrl = (relativeUrl) => {
  const base = BASE_URL.replace(/\/$/, '');
  const rel = relativeUrl.replace(/^\//, '');
  return `${base}/${rel}`;
};

const toId = (value = '') =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const formatSellerPhone = (phone = '') => {
  const digits = String(phone).replace(/\D/g, '');
  return digits || '';
};

const getPageMetadata = async (relativeUrl) => {
  try {
    const raw = await readFile(relativeUrl, 'utf8');
    const title = getFirstMatch(raw, /<title>([\s\S]*?)<\/title>/i);
    const metaDescriptionMatch = raw.match(/<meta\s+name="description"\s+content="([\s\S]*?)"\s*\/?>/i);
    const introParagraph = getFirstMatch(raw, /<main[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);

    return {
      title,
      meta_description: metaDescriptionMatch ? cleanText(metaDescriptionMatch[1]) : '',
      has_meta_description: Boolean(metaDescriptionMatch),
      file_exists: true,
      intro_paragraph: introParagraph,
    };
  } catch {
    return {
      title: '',
      meta_description: '',
      has_meta_description: false,
      file_exists: false,
      intro_paragraph: '',
    };
  }
};

const parseCompanyInfo = (rawHome) => {
  const site_title = getFirstMatch(rawHome, /<title>([\s\S]*?)<\/title>/i);
  const site_description = getFirstMatch(
    rawHome,
    /<meta\s+name="description"\s+content="([\s\S]*?)"\s*\/?>/i,
  );
  const hero_claim = getFirstMatch(rawHome, /<div\s+class="badge\s+badgeSub">([\s\S]*?)<\/div>/i);

  const historiaBlock = rawHome.match(/<section\s+class="heroBelow"[\s\S]*?<\/section>/i)?.[0] || '';
  const historia_title = getFirstMatch(historiaBlock, /<h2\s+class="agroTitle">([\s\S]*?)<\/h2>/i);
  const historia_text = getFirstMatch(historiaBlock, /<p\s+class="muted\s+agroLead"[^>]*>([\s\S]*?)<\/p>/i);

  const contactoBlock = rawHome.match(/<section\s+id="contacto"[\s\S]*?<\/section>/i)?.[0] || '';
  const company_summary = getFirstMatch(contactoBlock, /<p\s+class="muted\s+sectionLead">([\s\S]*?)<\/p>/i);

  const address = getFirstMatch(contactoBlock, /<li><strong>Dirección:<\/strong>\s*([\s\S]*?)<\/li>/i);
  const email = getFirstMatch(contactoBlock, /mailto:([^"\s>]+)/i);
  const phone = getFirstMatch(contactoBlock, /tel:([^"\s>]+)/i);

  const instagram = getFirstMatch(contactoBlock, /<a\s+class="contactLink"\s+href="(https:\/\/www\.instagram\.com\/[^"]+)"/i);
  const facebook = getFirstMatch(contactoBlock, /<a\s+class="contactLink"\s+href="(https:\/\/www\.facebook\.com\/[^"]+)"/i);
  const whatsapp = getFirstMatch(contactoBlock, /<a\s+class="contactLink"\s+href="(https:\/\/wa\.me\/[^"]+)"/i);

  const providerAlts = [
    ...historiaBlock.matchAll(/<div\s+class="logoItem">[\s\S]*?<img\s+src="[^"]+"\s+alt="([^"]+)"/gi),
  ].map((m) => cleanText(m[1]));

  return {
    name: 'AgriCheck',
    website: BASE_URL,
    site_title,
    site_description,
    hero_claim,
    historia: {
      title: historia_title,
      description: historia_text,
    },
    summary: company_summary,
    contact: {
      address,
      email,
      phone,
    },
    social_links: {
      instagram,
      facebook,
      whatsapp,
    },
    represented_brands: providerAlts.filter(Boolean),
    source_file: COMPANY_SOURCE_FILE,
  };
};

const parseSellersInfo = (rawZones) => {
  const sellersBlockMatch = rawZones.match(
    /const\s+sellers\s*=\s*({[\s\S]*?})\s*;\s*\n\s*const\s+normalizeZoneName/,
  );

  if (!sellersBlockMatch) return [];

  let sellersObj = {};
  try {
    sellersObj = vm.runInNewContext(`(${sellersBlockMatch[1]})`);
  } catch {
    return [];
  }

  return Object.entries(sellersObj).map(([zone_key, info]) => {
    const contacts = Array.isArray(info?.contacts)
      ? info.contacts.map((contact) => {
          const phone = formatSellerPhone(contact?.phone);
          return {
            name: cleanText(contact?.name || ''),
            email: cleanText(contact?.email || ''),
            phone,
            whatsapp_url: phone ? `https://wa.me/${phone}` : '',
          };
        })
      : [];

    const images = [
      ...(Array.isArray(info?.imgs) ? info.imgs : []),
      ...(info?.img ? [info.img] : []),
    ]
      .map((img) => cleanText(img))
      .filter(Boolean)
      .filter((img, idx, arr) => arr.indexOf(img) === idx);

    return {
      id: toId(info?.displayName || zone_key),
      zone_key,
      display_name: cleanText(info?.displayName || zone_key),
      region: cleanText(info?.meta || ''),
      images,
      contacts,
    };
  });
};

const rawCatalog = await readFile(INPUT_FILE, 'utf8');
const rawHome = await readFile(COMPANY_SOURCE_FILE, 'utf8');
const rawZones = await readFile(SELLERS_SOURCE_FILE, 'utf8');

const cards = [...rawCatalog.matchAll(/<article\s+class="card"([\s\S]*?)<\/article>/gi)];

const products = [];
for (const [fullMatch, inner] of cards) {
  const name = getFirstMatch(inner, /<h3>([\s\S]*?)<\/h3>/i);
  const description = getFirstMatch(inner, /<p>([\s\S]*?)<\/p>/i);
  const relativeUrl = getAttr(inner, 'href');
  const image =
    getAttr(inner, 'src') || getAttr(inner, 'srcset').split(',')[0]?.trim().split(' ')[0] || '';
  const tags = [...inner.matchAll(/<span\s+class="tag">([\s\S]*?)<\/span>/gi)].map((m) => cleanText(m[1]));

  const pageMeta = relativeUrl ? await getPageMetadata(relativeUrl) : {};

  products.push({
    id: toId(name),
    name,
    description,
    relative_url: relativeUrl,
    absolute_url: relativeUrl ? buildAbsoluteUrl(relativeUrl) : '',
    image,
    crops: parseCSVAttribute(getAttr(fullMatch, 'data-crops')),
    issues: parseCSVAttribute(getAttr(fullMatch, 'data-issues')),
    search_terms: parseCSVAttribute(getAttr(fullMatch, 'data-search').replace(/\s+/g, ',')),
    tags,
    page_metadata: pageMeta,
  });
}

const moreProductsSection = rawCatalog.match(/<section\s+class="moreProducts"[\s\S]*?<\/section>/i)?.[0] || '';
const more_products = [...moreProductsSection.matchAll(/<a\s+href="([^"]+)">([\s\S]*?)<\/a>/gi)].map((m) => ({
  id: toId(cleanText(m[2])),
  name: cleanText(m[2]),
  relative_url: decodeHtml(m[1]),
  absolute_url: buildAbsoluteUrl(decodeHtml(m[1])),
}));

const sellers = parseSellersInfo(rawZones);

const payload = {
  generated_at: new Date().toISOString(),
  source_file: INPUT_FILE,
  company_source_file: COMPANY_SOURCE_FILE,
  sellers_source_file: SELLERS_SOURCE_FILE,
  base_url: BASE_URL,
  update_policy: {
    generation: 'manual_or_ci',
    cadence: 'daily_3am_argentina_via_github_actions',
    cron_utc: '0 6 * * *',
    timezone_note: 'Argentina (ART) is UTC-3; 03:00 ART equals 06:00 UTC',
  },
  company: parseCompanyInfo(rawHome),
  total_sellers: sellers.length,
  sellers,
  total_products: products.length,
  products,
  more_products,
};

await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(
  `✅ JSON RAG generado: ${OUTPUT_FILE} (${products.length} productos, ${sellers.length} vendedores)`,
);
