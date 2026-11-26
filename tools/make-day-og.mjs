// Lager forhåndsvisningsbilde per dag (data/og/N.jpg, 1200×630) til delingssiden /dag/N/.
// Kjøres lokalt etter schedule.mjs. Lager bare bilder som mangler.
import sharp from 'sharp';
import { readFile, mkdir, access } from 'node:fs/promises';

const exists = (p) => access(p).then(() => true, () => false);
const sched = JSON.parse(await readFile('data/schedule.json', 'utf8'));
const cfg = await readFile('site/js/config.js', 'utf8');
const START = cfg.match(/START = '([\d-]+)'/)[1];
await mkdir('data/og', { recursive: true });
const W = 1200, H = 630;
const dateOf = (n) => { const [a, b, c] = START.split('-').map(Number); return new Date(Date.UTC(a, b - 1, c) + (n - 1) * 864e5); };
const logo = `<g transform="translate(64,58) scale(2.2)"><rect x="2" y="7" width="28" height="20" rx="4" fill="#9a4f22"/><rect x="11" y="4" width="10" height="5" rx="1.5" fill="#9a4f22"/><circle cx="16" cy="17" r="6.5" fill="#fbf8f2"/><path d="M16 13v4.2l2.8 1.8" stroke="#9a4f22" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>`;

let made = 0;
for (let n = 1; n <= sched.days.length; n++) {
  const out = `data/og/${n}.jpg`;
  if (await exists(out)) continue;
  const dato = dateOf(n).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
<rect width="${W}" height="${H}" fill="#f3ede2"/>${logo}
<text x="146" y="104" font-family="Georgia, serif" font-size="52" font-weight="600" fill="#2a241d">Tidsbilde #${n}</text>
<text x="64" y="176" font-family="Segoe UI, Arial, sans-serif" font-size="30" fill="#6b6153">${dato.charAt(0).toUpperCase() + dato.slice(1)}</text>
<text x="64" y="262" font-family="Georgia, serif" font-size="46" fill="#2a241d">Fem gamle bilder fra Norge.</text>
<text x="64" y="320" font-family="Georgia, serif" font-size="46" fill="#2a241d">Når og hvor ble de tatt?</text>
<rect x="64" y="380" width="330" height="72" rx="12" fill="#9a4f22"/>
<text x="229" y="427" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="600" fill="#fff">Klarer du å slå meg?</text>
<text x="64" y="560" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="#6b6153">tidsbilde.no – gratis, uten innlogging</text>
</svg>`;
  const ids = sched.days[n - 1];
  const pos = [[720, 40, -5], [900, 70, 4], [700, 250, 3], [890, 290, -4], [790, 440, -2]];
  const layers = [];
  for (let i = 0; i < Math.min(5, ids.length); i++) {
    const [x, y, rot] = pos[i];
    const card = await sharp(`data/img/t/${ids[i]}.jpg`).resize(250, 170, { fit: 'cover' }).grayscale()
      .extend({ top: 9, bottom: 9, left: 9, right: 9, background: '#fbf8f2' })
      .rotate(rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    layers.push({ input: card, left: x, top: y });
  }
  await sharp(Buffer.from(svg)).composite(layers).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
  made++;
}
console.log(`og-bilder: ${made} nye (${sched.days.length} dager)`);
