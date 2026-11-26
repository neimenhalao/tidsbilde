// Lager site/og.png (1200×630) og site/icon-512.png. Kan bruke opptil 3 bilder fra data/img som collage.
import sharp from 'sharp';
import { readdir } from 'node:fs/promises';

const W = 1200, H = 630;
const imgs = (await readdir('data/img').catch(() => [])).filter((f) => f.endsWith('.jpg')).slice(0, 3);
const logo = `<g transform="translate(70,70) scale(2.6)"><rect x="2" y="7" width="28" height="20" rx="4" fill="#9a4f22"/><rect x="11" y="4" width="10" height="5" rx="1.5" fill="#9a4f22"/><circle cx="16" cy="17" r="6.5" fill="#fbf8f2"/><path d="M16 13v4.2l2.8 1.8" stroke="#9a4f22" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>`;
const text = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
<rect width="${W}" height="${H}" fill="#f3ede2"/>
${logo}
<text x="170" y="128" font-family="Georgia, serif" font-size="64" font-weight="600" fill="#2a241d">Tidsbilde</text>
<text x="70" y="250" font-family="Georgia, serif" font-size="52" fill="#2a241d">Når og hvor ble bildet tatt?</text>
<text x="70" y="320" font-family="Segoe UI, Arial, sans-serif" font-size="30" fill="#6b6153">Fem gamle bilder fra Norge hver dag.</text>
<text x="70" y="364" font-family="Segoe UI, Arial, sans-serif" font-size="30" fill="#6b6153">Gjett årstallet og sett en nål på kartet.</text>
<rect x="70" y="420" width="300" height="70" rx="12" fill="#9a4f22"/>
<text x="220" y="466" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="600" fill="#fff">Spill gratis</text>
</svg>`;
const layers = [];
if (imgs.length) {
  // bildestabel til høyre
  const pos = [[740, 70, -4], [800, 230, 3], [720, 360, -2]];
  for (let i = 0; i < imgs.length; i++) {
    const [x, y, rot] = pos[i];
    const card = await sharp(`data/img/${imgs[i]}`).resize(380, 260, { fit: 'cover' }).grayscale().modulate({ brightness: 1.02 })
      .extend({ top: 12, bottom: 12, left: 12, right: 12, background: '#fbf8f2' }).rotate(rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    layers.push({ input: card, left: x, top: y });
  }
}
await sharp(Buffer.from(text)).composite(layers).png().toFile('site/og.png');
const icon = `<svg width="512" height="512" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" fill="#f3ede2"/><g transform="translate(3,3) scale(.8125)"><rect x="2" y="7" width="28" height="20" rx="4" fill="#9a4f22"/><rect x="11" y="4" width="10" height="5" rx="1.5" fill="#9a4f22"/><circle cx="16" cy="17" r="6.5" fill="#fbf8f2"/><path d="M16 13v4.2l2.8 1.8" stroke="#9a4f22" stroke-width="1.8" fill="none" stroke-linecap="round"/></g></svg>`;
await sharp(Buffer.from(icon)).png().toFile('site/icon-512.png');
console.log('og.png og icon-512.png laget', imgs.length ? `(${imgs.length} bilder)` : '(uten bilder)');
