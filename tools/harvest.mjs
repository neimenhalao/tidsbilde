// Samler kandidatbilder fra Wikimedia Commons: Â«Category:{Ã¥r} in NorwayÂ» og underkategorier.
// Bruk: node tools/harvest.mjs 1860 2005  â†’ data/candidates/{Ã¥r}.json
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'TidsbildeBot/0.2 (https://tidsbilde.no/om/)';
const OUT = path.resolve('data/candidates');
const [fromY = 1860, toY = 2005] = process.argv.slice(2).map(Number);
const OK_LICENSE = /(public domain|pdm|cc0|^cc by(-sa)? [0-9.]+|^cc by(-sa)?$|no restrictions|attribution)/i;
const BAD_LICENSE = /(nc|nd)\b|non-?commercial|noderiv/i;
const SKIP_TITLE = /(\.pdf|\.tif|map|kart over|logo|coat of arms|vÃ¥pen|signature|stamp|frimerke|poster|plakat|painting|maleri|drawing|tegning|document|dokument|newspaper|avis|svg)/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(params) {
  const url = API + '?' + new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  for (let i = 0; i < 8; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
      if (res.ok) {
        const j = await res.json();
        if (!j.error) { await sleep(350); return j; }
      } else if (res.status === 429) {
        const wait = Number(res.headers.get('retry-after')) || 15;
        console.log(`429 â€“ venter ${wait}s`);
        await sleep(wait * 1000);
        continue;
      }
    } catch {}
    await sleep(2000 * (i + 1));
  }
  throw new Error('API feilet: ' + url);
}

async function members(cat, type) {
  const out = [];
  let cont = {};
  do {
    const j = await api({ action: 'query', list: 'categorymembers', cmtitle: cat, cmtype: type, cmlimit: '500', ...cont });
    out.push(...(j.query?.categorymembers || []).map((m) => m.title));
    cont = j.continue || null;
  } while (cont);
  return out;
}

const strip = (s = '') => String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function fileInfo(titles) {
  const j = await api({
    action: 'query', titles: titles.join('|'), prop: 'imageinfo|categories|coordinates',
    iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1400', cllimit: '50', clshow: '!hidden',
    iiextmetadatafilter: 'LicenseShortName|Artist|ImageDescription|DateTimeOriginal|ObjectName|Credit|UsageTerms',
  });
  return (j.query?.pages || []).map((p) => {
    const ii = p.imageinfo?.[0];
    if (!ii) return null;
    const m = ii.extmetadata || {};
    return {
      title: p.title,
      width: ii.width, height: ii.height, mime: ii.mime,
      thumb: ii.thumburl, page: ii.descriptionurl,
      license: strip(m.LicenseShortName?.value),
      artist: strip(m.Artist?.value).slice(0, 200),
      credit: strip(m.Credit?.value).slice(0, 200),
      date: strip(m.DateTimeOriginal?.value).slice(0, 120),
      objectName: strip(m.ObjectName?.value).slice(0, 200),
      description: strip(m.ImageDescription?.value).slice(0, 600),
      categories: (p.categories || []).map((c) => c.title.replace(/^Category:/, '')),
      coords: p.coordinates?.[0] ? [p.coordinates[0].lat, p.coordinates[0].lon] : null,
    };
  }).filter(Boolean);
}

async function harvestYear(y) {
  const file = path.join(OUT, `${y}.json`);
  try { await access(file); return; } catch {}
  // Ett sÃ¸k med deepcat gir filene i kategorien og underkategoriene, med bildeinfo i samme svar.
  const pages = new Map();
  let cont = {};
  do {
    const j = await api({
      action: 'query', generator: 'search', gsrnamespace: '6', gsrlimit: '50',
      gsrsearch: `deepcat:"${y} in Norway" filemime:image/jpeg "${y}"`,
      prop: 'imageinfo|coordinates', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1400',
      iiextmetadatafilter: 'LicenseShortName|Artist|ImageDescription|DateTimeOriginal|ObjectName|Credit',
      ...cont,
    });
    for (const p of j.query?.pages || []) {
      const prev = pages.get(p.title) || {};
      pages.set(p.title, { ...prev, ...p, categories: [...(prev.categories || []), ...(p.categories || [])] });
    }
    cont = j.continue || null;
  } while (cont);
  const out = [];
  for (const p of pages.values()) {
    const ii = p.imageinfo?.[0];
    if (!ii || SKIP_TITLE.test(p.title)) continue;
    const m = ii.extmetadata || {};
    const f = {
      title: p.title, width: ii.width, height: ii.height, mime: ii.mime, thumb: ii.thumburl, page: ii.descriptionurl,
      license: strip(m.LicenseShortName?.value), artist: strip(m.Artist?.value).slice(0, 200), credit: strip(m.Credit?.value).slice(0, 200),
      date: strip(m.DateTimeOriginal?.value).slice(0, 120), objectName: strip(m.ObjectName?.value).slice(0, 200),
      description: strip(m.ImageDescription?.value).slice(0, 600),
      categories: [...new Set((p.categories || []).map((c) => c.title.replace(/^Category:/, '')))],
      coords: p.coordinates?.[0] ? [p.coordinates[0].lat, p.coordinates[0].lon] : null,
    };
    if (f.width < 900 || f.mime !== 'image/jpeg') continue;
    if (!OK_LICENSE.test(f.license) || BAD_LICENSE.test(f.license)) continue;
    // Ã¥ret mÃ¥ stÃ¥ i dato-feltet eller i beskrivelsen/tittelen
    if (!f.date.includes(String(y)) && !(f.description + f.title + f.objectName).includes(String(y))) continue;
    out.push({ year: y, ...f });
  }
  await writeFile(file, JSON.stringify(out, null, 1));
  console.log(`${y}: ${out.length} kandidater (${pages.size} filer)`);
}

await mkdir(OUT, { recursive: true });
const years = [];
for (let y = fromY; y <= toY; y++) years.push(y);
// litt parallellitet, men skÃ¥nsomt mot API-et
const workers = 1;
await Promise.all(Array.from({ length: workers }, async (_, w) => {
  for (let i = w; i < years.length; i += workers) {
    try { await harvestYear(years[i]); } catch (e) { console.error(years[i], e.message); }
  }
}));
console.log('Ferdig');
