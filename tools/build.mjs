// Bygger dist/: spillet, dagsfiler t.o.m. i morgen, og søkbare sider for bilder som allerede er brukt.
// Bruk: node tools/build.mjs   (BUILD_DATE=2026-12-24 for å simulere en dato)
import { readFile, writeFile, mkdir, cp, rm, copyFile, access } from 'node:fs/promises';
import path from 'node:path';

const exists = (p) => access(p).then(() => true, () => false);
const cfg = await readFile('site/js/config.js', 'utf8');
const START = cfg.match(/START = '([\d-]+)'/)[1];
const DOMAIN = process.env.SITE_DOMAIN || 'tidsbilde.no';
const BP = (process.env.BASE_PATH || '').replace(/\/$/, ''); // f.eks. "/tidsbilde" på github.io
const NOINDEX = process.env.NOINDEX === '1';
const BASE = `https://${DOMAIN}${BP}`;
const GOAT = process.env.GOATCOUNTER || ''; // f.eks. "tidsbilde" → tidsbilde.goatcounter.com

const osloToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const TODAY = process.env.BUILD_DATE || osloToday;
const dayOf = (iso) => { const [y, m, d] = iso.split('-').map(Number), [a, b, c] = START.split('-').map(Number); return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(a, b - 1, c)) / 864e5) + 1; };
const dateOf = (n) => { const [a, b, c] = START.split('-').map(Number); return new Date(Date.UTC(a, b - 1, c) + (n - 1) * 864e5).toISOString().slice(0, 10); };
const todayN = dayOf(TODAY);

const photos = (await exists('data/photos.json')) ? JSON.parse(await readFile('data/photos.json', 'utf8')) : [];
const schedule = (await exists('data/schedule.json')) ? JSON.parse(await readFile('data/schedule.json', 'utf8')) : { days: [] };
const byId = new Map(photos.map((p) => [p.id, p]));

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const slugify = (s) => s.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const decade = (y) => Math.floor(y / 10) * 10;
const dateNo = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });

const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="7" width="28" height="20" rx="4" fill="var(--aksent)"/><rect x="11" y="4" width="10" height="5" rx="1.5" fill="var(--aksent)"/><circle cx="16" cy="17" r="6.5" fill="var(--kort)"/><path d="M16 13v4.2l2.8 1.8" stroke="var(--aksent)" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`;

function layout({ title, description, canonical, body, image, jsonld, scripts = '', noindex = false }) {
  const img = image ? BASE + image : `${BASE}/og.png`;
  return `<!doctype html>
<html lang="nb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${BASE}${canonical}">
${noindex || NOINDEX ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Tidsbilde">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${BASE}${canonical}">
<meta property="og:image" content="${img}">
<meta property="og:locale" content="nb_NO">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#9a4f22">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="/css/style.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
${GOAT ? `<script data-goatcounter="https://${GOAT}.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>` : ''}
</head>
<body>
<header class="topp"><div class="indre">
<a class="logo" href="/">${LOGO}<span>Tidsbilde</span></a>
<nav><a href="/arkiv/">Arkiv</a><a href="/bilder/">Gamle bilder</a><a href="/om/">Om</a></nav>
</div></header>
${body}
<footer class="bunn"><div class="indre">
<p>Tidsbilde er et gratis daglig spill med historiske bilder fra Norge. Alle bilder har fri lisens eller er falt i det fri, og fotograf og kilde står ved hvert bilde. Kart: © Kartverket (CC BY 4.0).</p>
<p><a href="/om/">Om Tidsbilde</a> · <a href="/om/#personvern">Personvern</a> · <a href="/om/#kilder">Kilder og lisenser</a></p>
</div></footer>
${scripts}
</body>
</html>`;
}

const gallery = (list) => `<div class="galleri">${list.map((p) => `<a href="/bilde/${p.slug}/"><img src="/img/t/${p.id}.jpg" alt="${esc(p.title)}, ${p.year}" loading="lazy" width="480" height="360"><span>${esc(p.title)}<small>${p.year} · ${esc(p.place)}</small></span></a>`).join('')}</div>`;
const playCta = `<div class="cta"><b>Klarer du å gjette når og hvor?</b><p>Hver dag får du fem nye gamle bilder fra Norge. Gjett årstallet og sett en nål på kartet.</p><a class="knapp hoved" href="/">Spill dagens Tidsbilde</a></div>`;

async function write(rel, html) {
  const f = path.join('dist', rel);
  await mkdir(path.dirname(f), { recursive: true });
  if (BP && rel.endsWith('.html')) html = html.replace(/(href|src)="\/(?!\/)/g, `$1="${BP}/`);
  await writeFile(f, html);
}

// ---------- start ----------
await rm('dist', { recursive: true, force: true });
await cp('site', 'dist', { recursive: true });
await mkdir('dist/img/t', { recursive: true });
const urls = [];

// dagsfiler: t.o.m. i morgen (tidssoner/cache), aldri lenger fram
const maxDay = Math.min(todayN + 1, schedule.days.length);
const published = []; // bilder brukt på dager før i dag
for (let n = 1; n <= maxDay; n++) {
  const ids = schedule.days[n - 1];
  const list = ids.map((id) => byId.get(id)).filter(Boolean);
  const data = {
    n, date: dateOf(n),
    photos: list.map((p) => ({ id: p.id, img: `${BP}/img/${p.id}.jpg`, thumb: `${BP}/img/t/${p.id}.jpg`, w: p.w, h: p.h, year: p.year, lat: p.lat, lon: p.lon, title: p.title, place: p.place, caption: p.caption, credit: p.credit, license: p.license, source: p.source })),
  };
  await write(`data/dag/${n}.json`, JSON.stringify(data));
  for (const p of list) {
    await copyFile(`data/img/${p.id}.jpg`, `dist/img/${p.id}.jpg`);
    await copyFile(`data/img/t/${p.id}.jpg`, `dist/img/t/${p.id}.jpg`);
    if (n < todayN) published.push({ ...p, day: n });
  }
}

// forsiden = spillet
const gameBody = `<main>
<div class="spillhode"><h1>Tidsbilde <span id="dagnr"></span></h1><span class="dato" id="dato"></span><span class="merke" id="arkivmerke" hidden>Arkiv</span><span class="poeng"><span id="runde"></span> · <b id="poengsum">0</b> poeng</span></div>
<div class="prikker" id="prikker"></div>
<div id="spill" data-fase="laster">
 <div class="spillflate">
  <figure class="foto" id="foto"><img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" decoding="async"><span class="lupe">Trykk for å forstørre</span></figure>
  <div class="panel">
   <div id="kontroller" class="panel">
    <div class="kort aarvelger">
     <label for="aar">Hvilket år er bildet tatt?</label>
     <div class="aarrad"><button class="rund" id="aar-minus" aria-label="Ett år tidligere">−</button><output class="aarvisning" id="aarvisning">1950</output><button class="rund" id="aar-pluss" aria-label="Ett år senere">+</button></div>
     <input type="range" id="aar" min="1850" max="2010" value="1950" step="1">
     <div class="skala"><span>1850</span><span>1900</span><span>1950</span><span>2010</span></div>
    </div>
   </div>
   <div class="kort kartboks"><div id="kart"></div>
    <div class="kartknapper"><button id="zoom-inn" aria-label="Zoom inn">+</button><button id="zoom-ut" aria-label="Zoom ut">−</button><button id="zoom-hele" aria-label="Vis hele Norge">⤢</button></div>
    <span class="kartinfo">Hvor i Norge? Trykk for å sette nål.</span></div>
   <div class="handling" id="handlingsrad"><button id="gjett" disabled>Sett en nål på kartet</button></div>
   <div id="fasit" class="kort fasitkort" hidden><div id="fasit-innhold"></div><p><button id="neste">Neste bilde →</button></p></div>
  </div>
 </div>
</div>
<div class="zoomlag" id="zoomlag" hidden><img alt="Forstørret bilde"></div>
<section class="slik tekst">
<h2>Slik spiller du Tidsbilde</h2>
<p>Hver dag kommer fem nye historiske bilder fra Norge, de samme for alle. For hvert bilde gjetter du hvilket år det er tatt, og setter en nål der du tror det er tatt. Du får opptil 5 000 poeng for året og 5 000 poeng for stedet – til sammen 50 000 poeng per dag.</p>
<p>Del resultatet med familien uten å avsløre bildene, og kom tilbake i morgen for fem nye. Bildene kommer fra fri lisensierte samlinger, blant annet Nasjonalbiblioteket, Riksarkivet, museer og fotografer som Anders Beer Wilse.</p>
${published.length ? `<h2>Nylig brukte bilder</h2>${gallery(published.slice(-8).reverse())}<p><a href="/bilder/">Se alle gamle bilder</a></p>` : ''}
</section>
</main>`;
await write('index.html', layout({
  title: 'Tidsbilde – gjett år og sted for gamle bilder fra Norge',
  description: 'Daglig bildespill: fem historiske bilder fra Norge hver dag. Gjett årstallet og sett en nål på kartet. Gratis, uten innlogging.',
  canonical: '/', body: gameBody,
  jsonld: { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Tidsbilde', url: BASE + '/', applicationCategory: 'GameApplication', operatingSystem: 'Alle', inLanguage: 'nb', offers: { '@type': 'Offer', price: '0', priceCurrency: 'NOK' }, description: 'Daglig spill der du gjetter år og sted for historiske bilder fra Norge.' },
  scripts: '<script type="module" src="/js/app.js"></script>',
}));
urls.push(['/', 'daily']);

// bildesider
const slugs = new Set();
for (const p of published) {
  const sted = slugify(p.kommune || p.place);
  const body = `<main class="tekst bildeside">
<p class="liten"><a href="/bilder/">Gamle bilder</a> › <a href="/sted/${sted}/">${esc(p.kommune || p.place)}</a></p>
<h1>${esc(p.title)}, ${p.year}</h1>
<figure><img src="/img/${p.id}.jpg" alt="${esc(p.title)} i ${esc(p.place)}, ${p.year}" width="${p.w}" height="${p.h}"><figcaption class="kreditt">${esc(p.credit)} · <a href="${p.source}" rel="noopener">${esc(p.license)}</a></figcaption></figure>
<p class="ingress">${esc(p.caption)}</p>
<dl class="fakta"><dt>År</dt><dd><a href="/tiar/${decade(p.year)}/">${p.year}</a></dd><dt>Sted</dt><dd>${esc(p.place)}</dd>${p.fylke ? `<dt>Fylke i dag</dt><dd>${esc(p.fylke)}</dd>` : ''}<dt>Brukt i</dt><dd><a href="/?dag=${p.day}">Tidsbilde #${p.day}</a> (${dateNo(dateOf(p.day))})</dd></dl>
${playCta}
${(() => { const more = published.filter((q) => q.id !== p.id && (q.kommune === p.kommune || decade(q.year) === decade(p.year))).slice(0, 6); return more.length ? `<h2>Flere gamle bilder</h2>${gallery(more)}` : ''; })()}
</main>`;
  await write(`bilde/${p.slug}/index.html`, layout({
    title: `${p.title}, ${p.year} – gammelt bilde fra ${p.kommune || p.place} | Tidsbilde`,
    description: `${p.caption}`.slice(0, 155),
    canonical: `/bilde/${p.slug}/`, body, image: `/img/${p.id}.jpg`,
    jsonld: { '@context': 'https://schema.org', '@type': 'ImageObject', contentUrl: `${BASE}/img/${p.id}.jpg`, name: `${p.title}, ${p.year}`, description: p.caption, dateCreated: String(p.year), creditText: p.credit, creator: { '@type': 'Person', name: p.photographer || 'Ukjent' }, license: p.licenseUrl || p.source, acquireLicensePage: p.source, copyrightNotice: p.license, contentLocation: { '@type': 'Place', name: p.place, geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lon } } },
  }));
  urls.push([`/bilde/${p.slug}/`, 'monthly']);
  slugs.add(p.slug);
}

// stedssider og tiårssider
const group = (fn) => { const m = new Map(); for (const p of published) { const k = fn(p); if (!m.has(k)) m.set(k, []); m.get(k).push(p); } return m; };
const steder = group((p) => p.kommune || p.place);
for (const [navn, list] of steder) {
  const s = slugify(navn);
  await write(`sted/${s}/index.html`, layout({
    title: `Gamle bilder fra ${navn} – historiske foto | Tidsbilde`,
    description: `Se gamle bilder fra ${navn}: ${list.length} historiske fotografier med årstall, sted og historien bak.`,
    canonical: `/sted/${s}/`, image: `/img/${list[0].id}.jpg`,
    body: `<main class="tekst"><h1>Gamle bilder fra ${esc(navn)}</h1><p class="ingress">Historiske fotografier fra ${esc(navn)}, sortert etter år. Alle bildene har vært med i det daglige spillet Tidsbilde.</p>${gallery([...list].sort((a, b) => a.year - b.year))}${playCta}</main>`,
  }));
  urls.push([`/sted/${s}/`, 'weekly']);
}
const tiar = group((p) => decade(p.year));
for (const [d, list] of tiar) {
  await write(`tiar/${d}/index.html`, layout({
    title: `Norge på ${d}-tallet – gamle bilder | Tidsbilde`,
    description: `Gamle bilder fra Norge på ${d}-tallet: ${list.length} historiske fotografier med sted og historien bak.`,
    canonical: `/tiar/${d}/`, image: `/img/${list[0].id}.jpg`,
    body: `<main class="tekst"><h1>Norge på ${d}-tallet</h1><p class="ingress">Historiske bilder fra ${d}–${d + 9}, fra hele landet.</p>${gallery([...list].sort((a, b) => a.year - b.year))}${playCta}</main>`,
  }));
  urls.push([`/tiar/${d}/`, 'weekly']);
}

// oversikt over gamle bilder
const stedChips = [...steder.entries()].sort((a, b) => b[1].length - a[1].length).map(([n, l]) => `<a href="/sted/${slugify(n)}/">${esc(n)} (${l.length})</a>`).join('');
const tiarChips = [...tiar.keys()].sort().map((d) => `<a href="/tiar/${d}/">${d}-tallet</a>`).join('');
await write('bilder/index.html', layout({
  title: 'Gamle bilder fra Norge – historiske foto etter sted og tiår | Tidsbilde',
  description: 'Bla i gamle bilder fra hele Norge, sortert etter sted og tiår. Nye historiske bilder hver dag.',
  canonical: '/bilder/',
  body: `<main class="tekst"><h1>Gamle bilder fra Norge</h1><p class="ingress">Her samler vi alle bildene som har vært med i Tidsbilde. Det kommer fem nye hver dag.</p>
${published.length ? `<h2>Etter sted</h2><div class="chips">${stedChips}</div><h2>Etter tiår</h2><div class="chips">${tiarChips}</div><h2>Nyeste</h2>${gallery([...published].reverse().slice(0, 24))}` : '<p>De første bildene dukker opp her dagen etter at de har vært med i spillet.</p>'}
${playCta}</main>`,
}));
urls.push(['/bilder/', 'daily']);

// arkiv
const days = []; for (let n = todayN - 1; n >= 1; n--) if (schedule.days[n - 1]) days.push(n);
await write('arkiv/index.html', layout({
  title: 'Arkiv – spill tidligere dager | Tidsbilde',
  description: 'Gikk du glipp av en dag? Spill alle tidligere runder av Tidsbilde.',
  canonical: '/arkiv/',
  body: `<main class="tekst"><h1>Arkiv</h1><p class="ingress">Spill tidligere dager. Arkivspill teller ikke på dager-på-rad. Hele arkivet er gratis i lanseringsperioden.</p>
<ul class="dagsliste">${days.map((n) => `<li><a href="/?dag=${n}">Tidsbilde #${n}</a><span class="liten">${dateNo(dateOf(n))}</span><span class="ok" data-dag="${n}"></span></li>`).join('') || '<li>Arkivet fylles opp fra og med i morgen.</li>'}</ul>
<script>document.querySelectorAll('[data-dag]').forEach(function(e){try{var s=JSON.parse(localStorage.getItem('tb:dag:'+e.dataset.dag)||'null');if(s&&s.guesses&&s.guesses.length>=5){var t=s.guesses.reduce(function(a,g){return a+g.yp+g.pp},0);e.textContent='✓ '+t.toLocaleString('nb-NO')+' poeng'}}catch(x){}})</script>
</main>`,
}));
urls.push(['/arkiv/', 'daily']);

// om-side
await write('om/index.html', layout({
  title: 'Om Tidsbilde – kilder, lisenser og personvern',
  description: 'Hvordan Tidsbilde fungerer, hvor bildene kommer fra, hvordan poengene regnes ut, og hvordan vi behandler personvern.',
  canonical: '/om/',
  body: `<main class="tekst"><h1>Om Tidsbilde</h1>
<p class="ingress">Tidsbilde er et gratis, daglig spill for alle som liker gamle bilder og norsk historie. Hver dag får alle de samme fem bildene.</p>
<h2>Poeng</h2><p>For hvert bilde kan du få 5 000 poeng for årstallet og 5 000 poeng for stedet. Treffer du året eksakt, får du full pott; er du 40 år eller mer unna, får du null. For stedet får du full pott innenfor 5 km, og poengene faller jo lenger unna du er.</p>
<h2 id="kilder">Kilder og lisenser</h2><p>Alle bildene er hentet fra Wikimedia Commons og er enten falt i det fri eller har en fri lisens (som CC BY eller CC BY-SA). Mange kommer opprinnelig fra Nasjonalbiblioteket, Riksarkivet, Norsk Folkemuseum og andre norske samlinger. Fotograf, kilde og lisens står ved hvert bilde, med lenke til originalen. Bildetekstene er skrevet av oss.</p>
<p>Årstall og sted er så presise som kildene tillater. Ser du en feil? Det hjelper oss mye om du sier fra.</p>
<p>Kartet bygger på data fra Kartverket (CC BY 4.0).</p>
<h2 id="personvern">Personvern</h2><p>Tidsbilde har ingen innlogging og bruker ingen informasjonskapsler (cookies). Resultatene dine lagres bare i nettleseren din. Vi teller sidevisninger anonymt med GoatCounter, som ikke lagrer IP-adresser eller sporer deg på tvers av nettsteder.</p>
${playCta}</main>`,
}));
urls.push(['/om/', 'monthly']);

// 404, sitemap, robots
await write('404.html', layout({ title: 'Fant ikke siden | Tidsbilde', description: 'Siden finnes ikke.', canonical: '/404', noindex: true, body: `<main class="tekst"><h1>Denne siden finnes ikke</h1><p>Kanskje den har reist i tid.</p><p><a class="knapp hoved" href="/">Til dagens Tidsbilde</a></p></main>` }));
await write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, f]) => `<url><loc>${BASE}${u}</loc><changefreq>${f}</changefreq></url>`).join('\n')}\n</urlset>\n`);
await write('robots.txt', NOINDEX ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);
await write('.nojekyll', '');
// sider som er nye i dag (gårsdagens bilder) → IndexNow
const fresh = published.filter((p) => p.day === todayN - 1);
const freshUrls = new Set(['/', '/bilder/', '/arkiv/']);
for (const p of fresh) { freshUrls.add(`/bilde/${p.slug}/`); freshUrls.add(`/sted/${slugify(p.kommune || p.place)}/`); freshUrls.add(`/tiar/${decade(p.year)}/`); }
await write('indexnow.json', JSON.stringify([...freshUrls].map((u) => BASE + u)));
if (BP) {
  const c = await readFile('dist/js/config.js', 'utf8');
  await writeFile('dist/js/config.js', c.replace("export const BASE = '';", `export const BASE = '${BP}';`));
}
console.log(`Bygget ${TODAY} (dag ${todayN}): ${maxDay} dagsfiler, ${published.length} bildesider, ${steder.size} steder, ${tiar.size} tiår`);
