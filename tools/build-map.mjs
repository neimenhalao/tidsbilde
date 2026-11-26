// Lager site/js/norge.js: forenklede fylkesomriss i km-projeksjon (Kartverket, CC BY 4.0 via robhop/fylker-og-kommuner).
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { project } from './proj.mjs';

const gj = JSON.parse(await readFile('data/geo/fylker-s.geojson', 'utf8'));
const TOL = 1.2; // km, Douglas-Peucker

function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9;
    let max = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
const fylker = [];
for (const f of gj.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let d = '';
  for (const poly of polys) {
    const ring = poly[0];
    if (ring.some(([, lat]) => lat > 74)) continue; // ikke Svalbard/Jan Mayen
    const raw = ring.slice(0, -1).map(([lon, lat]) => project(lon, lat));
    const mid = Math.floor(raw.length / 2);
    let pts = [...simplify(raw.slice(0, mid + 1), TOL).slice(0, -1), ...simplify(raw.slice(mid), TOL)];
    // dropp bittesmå øyer
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    if (Math.max(...xs) - Math.min(...xs) < 3 && Math.max(...ys) - Math.min(...ys) < 3) continue;
    if (pts.length < 3) continue;
    for (const [x, y] of pts) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    d += 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z';
  }
  if (d) fylker.push({ name: f.properties.fylkesnavn || f.properties.name, d });
}
// naboland (Natural Earth 1:50m, offentlig eie), klemt inn i et utsnitt rundt Norge
const ne = JSON.parse(await readFile('data/geo/ne50-countries.geojson', 'utf8'));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
let naboD = '';
for (const f of ne.features) {
  if (!['SWE', 'FIN', 'RUS', 'DNK', 'EST'].includes(f.properties.ADM0_A3)) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    const ring = poly[0];
    if (!ring.some(([lon, lat]) => lon > -2 && lon < 40 && lat > 52 && lat < 73)) continue;
    const raw = ring.slice(0, -1).map(([lon, lat]) => project(clamp(lon, -2, 40), clamp(lat, 52, 73)));
    const mid = Math.floor(raw.length / 2);
    const pts = [...simplify(raw.slice(0, mid + 1), 2).slice(0, -1), ...simplify(raw.slice(mid), 2)];
    if (pts.length < 3) continue;
    naboD += 'M' + pts.map(([x, y]) => `${x.toFixed(0)} ${y.toFixed(0)}`).join('L') + 'Z';
  }
}
const pad = 25;
const box = [minX - pad, minY - pad, maxX - minX + 2 * pad, maxY - minY + 2 * pad].map((v) => Math.round(v));
const js = `// Generert av tools/build-map.mjs. Kartdata: © Kartverket, CC BY 4.0\nexport const VIEWBOX = ${JSON.stringify(box)};\nexport const FYLKER = ${JSON.stringify(fylker)};\n// Naboland: Natural Earth (offentlig eie)\nexport const NABO = ${JSON.stringify(naboD)};\n`;
await writeFile('site/js/norge.js', js);
await copyFile('tools/proj.mjs', 'site/js/proj.js');
console.log('norge.js', (js.length / 1024).toFixed(0), 'KB', fylker.length, 'fylker, viewBox', box.join(' '));
