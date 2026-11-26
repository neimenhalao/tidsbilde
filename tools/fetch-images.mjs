// Leser data/curated/*.json, laster ned bilder fra Commons, lager 1200px + 480px-versjoner, skriver data/photos.json.
import { readdir, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { slugify } from './slug.mjs';

const UA = 'TidsbildeHarvester/0.1 (non-commercial Norwegian history photo game)';
const exists = (p) => access(p).then(() => true, () => false);
await mkdir('data/img/t', { recursive: true });

const old = (await exists('data/photos.json')) ? JSON.parse(await readFile('data/photos.json', 'utf8')) : [];
const known = new Map(old.map((p) => [p.id, p]));
const files = (await readdir('data/curated')).filter((f) => f.endsWith('.json'));
const recs = [];
for (const f of files) recs.push(...JSON.parse(await readFile(`data/curated/${f}`, 'utf8')));
for (const r of recs) r.id ||= 'b' + createHash('sha1').update(r.commonsTitle).digest('hex').slice(0, 9);
{ // fjern duplikater (samme Commons-fil kuratert to ganger)
  const seen = new Set();
  for (let i = recs.length - 1; i >= 0; i--) { if (seen.has(recs[i].id)) recs.splice(i, 1); else seen.add(recs[i].id); }
}

const slugs = new Set(old.map((p) => p.slug));
const out = [...old];
let ny = 0, feil = 0;
for (const r of recs) {
  if (known.has(r.id)) continue;
  const big = `data/img/${r.id}.jpg`, small = `data/img/t/${r.id}.jpg`;
  try {
    if (!(await exists(big))) {
      const res = await fetch(r.thumb, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      await sharp(buf).rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toFile(big);
      await sharp(buf).rotate().resize(480, 360, { fit: 'cover', position: 'attention' }).jpeg({ quality: 72, mozjpeg: true }).toFile(small);
      await new Promise((res) => setTimeout(res, 300));
    }
    const meta = await sharp(big).metadata();
    let slug = slugify(`${r.title}-${r.year}`);
    if (slugs.has(slug)) slug += '-' + r.id.slice(-4);
    slugs.add(slug);
    out.push({
      id: r.id, slug, title: r.title, place: r.place, kommune: r.kommune, fylke: r.fylke,
      lat: r.lat, lon: r.lon, year: r.year, caption: r.caption, credit: r.credit, photographer: r.photographer || null,
      license: r.license, licenseUrl: r.licenseUrl || null, source: r.page, commonsTitle: r.commonsTitle,
      difficulty: r.difficulty || 2, quality: r.quality || 3, tags: r.tags || [], w: meta.width, h: meta.height,
    });
    known.set(r.id, true); ny++;
  } catch (e) { feil++; console.error('Feil', r.id, r.commonsTitle, e.message); }
}
await writeFile('data/photos.json', JSON.stringify(out, null, 1));
console.log(`photos.json: ${out.length} bilder (${ny} nye, ${feil} feil)`);
