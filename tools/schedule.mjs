// Fordeler ubrukte bilder på nye dager i data/schedule.json. Eksisterende dager endres aldri.
// Regler per dag: 5 bilder, ulike tiår, ulike kommuner, helst ulike landsdeler; best kvalitet først.
import { readFile, writeFile, access } from 'node:fs/promises';

const exists = (p) => access(p).then(() => true, () => false);
const photos = JSON.parse(await readFile('data/photos.json', 'utf8'));
const sched = (await exists('data/schedule.json')) ? JSON.parse(await readFile('data/schedule.json', 'utf8')) : { days: [] };
const PER = 5;
const used = new Set(sched.days.flat());
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
let pool = photos.filter((p) => !used.has(p.id)).sort((a, b) => (b.quality - a.quality) || (hash(a.id) - hash(b.id)));
const region = (p) => (p.lat > 66.5 ? 'nord' : p.lat > 62.3 ? 'midt' : p.lon < 7.6 ? 'vest' : p.lon < 9.5 && p.lat < 59.4 ? 'sor' : 'ost');

let added = 0;
while (pool.length >= PER) {
  const day = [];
  for (const strict of [3, 2, 1, 0]) {
    for (const p of pool) {
      if (day.length >= PER) break;
      if (day.includes(p)) continue;
      const dec = Math.floor(p.year / 10);
      if (strict >= 1 && day.some((q) => Math.floor(q.year / 10) === dec)) continue;
      if (strict >= 1 && day.some((q) => (q.kommune || q.place) === (p.kommune || p.place))) continue;
      if (strict >= 2 && day.filter((q) => region(q) === region(p)).length >= 2) continue;
      if (strict >= 3 && day.filter((q) => (q.difficulty || 2) === 3).length >= 1 && (p.difficulty || 2) === 3) continue;
      day.push(p);
    }
    if (day.length >= PER) break;
  }
  // rekkefølge: lett start, vanskeligst til slutt
  day.sort((a, b) => (a.difficulty || 2) - (b.difficulty || 2) || hash(a.id) - hash(b.id));
  sched.days.push(day.map((p) => p.id));
  pool = pool.filter((p) => !day.includes(p));
  added++;
}
await writeFile('data/schedule.json', JSON.stringify(sched, null, 1));
console.log(`schedule.json: ${sched.days.length} dager (${added} nye), ${pool.length} bilder til overs`);
