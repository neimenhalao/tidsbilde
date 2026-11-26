// Melder nye/endrede sider fra siste bygg (dist/indexnow.json) til IndexNow (Bing, Yandex, Seznam m.fl.).
import { readFile, readdir } from 'node:fs/promises';

const host = process.env.SITE_DOMAIN || 'tidsbilde.no';
if (process.env.NOINDEX === '1' || host.endsWith('github.io')) { console.log('Hopper over IndexNow (forhåndsvisning)'); process.exit(0); }
const key = (await readdir('site')).find((f) => /^[0-9a-f]{32}\.txt$/.test(f))?.slice(0, 32);
const urls = JSON.parse(await readFile('dist/indexnow.json', 'utf8'));
if (!key || !urls.length) { console.log('Ingenting å melde'); process.exit(0); }
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList: urls }),
});
console.log(`IndexNow: ${res.status} for ${urls.length} adresser`);
