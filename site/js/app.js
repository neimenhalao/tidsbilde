// Tidsbilde – dagens spill
import { NorgesKart } from './map.js';
import { distanceKm } from './proj.js';
import { START, MIN_YEAR, MAX_YEAR, SITE, BASE } from './config.js';

const $ = (s, r = document) => r.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const fmt = (n) => n.toLocaleString('nb-NO');

import { dayNumber } from './dag.js';
export const yearPoints = (diff) => (diff >= 40 ? 0 : Math.round(5000 * (1 - diff / 40) ** 1.6));
export const placePoints = (km) => (km <= 5 ? 5000 : Math.round(5000 * Math.exp(-(km - 5) / 250)));
const yearEmoji = (d) => (d <= 2 ? '🟩' : d <= 8 ? '🟨' : d <= 20 ? '🟧' : '🟥');
const placeEmoji = (k) => (k <= 25 ? '🟩' : k <= 100 ? '🟨' : k <= 300 ? '🟧' : '🟥');

const today = Math.max(1, dayNumber()); // før lansering: vis dag 1
const params = new URLSearchParams(location.search);
const wanted = Number(params.get('dag')) || today;
const dayN = Math.min(Math.max(1, wanted), today);
const isToday = dayN === today;
const key = `tb:dag:${dayN}`;

let day, state, round = 0, year = 1950, kart;

async function init() {
  const app = $('#spill');
  try {
    const res = await fetch(`${BASE}/data/dag/${dayN}.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    day = await res.json();
  } catch {
    app.innerHTML = `<div class="kort melding"><h2>Dagens bilder er ikke klare ennå</h2><p>Prøv igjen om litt.</p></div>`;
    return;
  }
  state = store.get(key, { guesses: [] });
  $('#dagnr').textContent = `#${dayN}`;
  $('#dato').textContent = new Date(day.date + 'T12:00:00').toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
  if (!isToday) $('#arkivmerke').hidden = false;
  kart = new NorgesKart($('#kart'), { onPick: () => updateButton() });
  bindControls();
  // forhåndslast alle bildene
  day.photos.forEach((p) => { const i = new Image(); i.src = p.img; });
  if (state.guesses.length >= day.photos.length) return showSummary();
  round = state.guesses.length;
  showRound();
}

function bindControls() {
  const slider = $('#aar');
  slider.min = MIN_YEAR; slider.max = MAX_YEAR;
  slider.addEventListener('input', () => setYear(+slider.value));
  $('#aar-minus').addEventListener('click', () => setYear(year - 1));
  $('#aar-pluss').addEventListener('click', () => setYear(year + 1));
  $('#zoom-inn').addEventListener('click', () => kart.zoom(1 / 1.6));
  $('#zoom-ut').addEventListener('click', () => kart.zoom(1.6));
  $('#zoom-hele').addEventListener('click', () => kart.reset());
  $('#gjett').addEventListener('click', submitGuess);
  $('#neste').addEventListener('click', nextRound);
  $('#foto').addEventListener('click', () => openZoom());
  $('#zoomlag').addEventListener('click', () => { $('#zoomlag').hidden = true; });
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    if (e.key === 'ArrowLeft' && !e.target.matches('input')) setYear(year - 1);
    if (e.key === 'ArrowRight' && !e.target.matches('input')) setYear(year + 1);
    if (e.key === 'Escape') $('#zoomlag').hidden = true;
  });
}

function setYear(y) {
  year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, y));
  $('#aar').value = year; $('#aarvisning').textContent = year;
  $('#aar').style.setProperty('--pos', ((year - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100 + '%');
  state.touchedYear = true;
  updateButton();
}

function updateButton() {
  const pin = !!kart.guessLonLat();
  const b = $('#gjett');
  b.disabled = !pin;
  b.textContent = pin ? `Gjett ${year}` : 'Sett en nål på kartet';
}

function showRound() {
  const p = day.photos[round];
  $('#runde').textContent = `Bilde ${round + 1} av ${day.photos.length}`;
  $('#dagnr').textContent = `#${dayN}`;
  $('#poengsum').textContent = fmt(total());
  const img = $('#foto img');
  img.src = p.img; img.alt = 'Historisk bilde fra Norge. Gjett året og stedet.';
  img.width = p.w; img.height = p.h;
  $('#spill').dataset.fase = 'gjett';
  $('#fasit').hidden = true; $('#kontroller').hidden = false; $('#handlingsrad').hidden = false;
  kart.locked = false; kart.clear(); kart.reset();
  setYear(1950);
  updateButton();
  renderDots();
}

function renderDots() {
  $('#prikker').innerHTML = day.photos.map((_, i) => {
    const g = state.guesses[i];
    const cls = g ? 'ferdig' : i === round ? 'aktiv' : '';
    return `<span class="prikk ${cls}"></span>`;
  }).join('');
}

function total() { return state.guesses.reduce((s, g) => s + g.yp + g.pp, 0); }

function submitGuess() {
  const ll = kart.guessLonLat(); if (!ll) return;
  const p = day.photos[round];
  const diff = Math.abs(year - p.year);
  const km = distanceKm(ll[1], ll[0], p.lat, p.lon);
  const g = { year, lon: +ll[0].toFixed(4), lat: +ll[1].toFixed(4), diff, km: Math.round(km), yp: yearPoints(diff), pp: placePoints(km) };
  state.guesses[round] = g;
  store.set(key, state);
  kart.locked = true;
  kart.showAnswer(p.lon, p.lat, ll);
  showReveal(p, g);
  track('gjett');
}

function showReveal(p, g) {
  $('#spill').dataset.fase = 'fasit';
  $('#kontroller').hidden = true; $('#handlingsrad').hidden = true;
  const f = $('#fasit'); f.hidden = false;
  const aarTekst = g.diff === 0 ? 'Helt riktig år!' : `Du gjettet ${g.year} – ${g.diff} år unna`;
  const stedTekst = g.km <= 5 ? 'Midt i blinken!' : `${fmt(g.km)} km unna`;
  $('#fasit-innhold').innerHTML = `
    <div class="fasitrad"><span class="stor">${p.year}</span><span>${aarTekst}</span><b>+${fmt(g.yp)}</b></div>
    <div class="fasitrad"><span class="stor sted">${esc(p.place)}</span><span>${stedTekst}</span><b>+${fmt(g.pp)}</b></div>
    <h3>${esc(p.title)}</h3>
    <p>${esc(p.caption)}</p>
    <p class="kreditt">${esc(p.credit)} · <a href="${p.source}" target="_blank" rel="noopener">${esc(p.license)}</a></p>`;
  $('#neste').textContent = round + 1 < day.photos.length ? 'Neste bilde →' : 'Se resultatet';
  $('#poengsum').textContent = fmt(total());
  renderDots();
  $('#fasit').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function nextRound() {
  round++;
  if (round >= day.photos.length) return showSummary(true);
  showRound();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function shareText() {
  const sum = total(), max = day.photos.length * 10000;
  return `Tidsbilde #${dayN} · ${fmt(sum)}/${fmt(max)}\n📅 ${state.guesses.map((g) => yearEmoji(g.diff)).join('')}\n📍 ${state.guesses.map((g) => placeEmoji(g.km)).join('')}\nKlarer du å slå meg? ${SITE}/dag/${dayN}`;
}

function updateStats() {
  if (!isToday || state.counted) return;
  const s = store.get('tb:stats', { played: 0, sum: 0, best: 0, streak: 0, maxStreak: 0, last: 0 });
  const sum = total();
  s.played++; s.sum += sum; s.best = Math.max(s.best, sum);
  s.streak = s.last === dayN - 1 ? s.streak + 1 : 1; s.maxStreak = Math.max(s.maxStreak, s.streak); s.last = dayN;
  store.set('tb:stats', s);
  state.counted = true; store.set(key, state);
  track('ferdig');
}

function showSummary(fresh = false) {
  updateStats();
  const s = store.get('tb:stats', { played: 0, sum: 0, best: 0, streak: 0, maxStreak: 0 });
  const sum = total();
  const max = day.photos.length * 10000;
  const pct = sum / max;
  const dom = pct > 0.85 ? 'Tidsreisende på eliteplan!' : pct > 0.7 ? 'Imponerende!' : pct > 0.55 ? 'Godt jobbet!' : pct > 0.4 ? 'Helt greit!' : 'Historien er vanskelig!';
  $('#spill').dataset.fase = 'ferdig';
  $('#runde').textContent = 'Ferdig';
  $('#poengsum').textContent = fmt(sum);
  renderDots();
  $('#spill').innerHTML = `
  <section class="kort oppsummering">
    <p class="etikett">Tidsbilde #${dayN}${isToday ? '' : ' (arkiv)'}</p>
    <h2>${dom}</h2>
    <p class="totalt"><span>${fmt(sum)}</span> av ${fmt(max)} poeng</p>
    <ol class="resultater">
      ${day.photos.map((p, i) => { const g = state.guesses[i]; return `
      <li><img src="${p.thumb || p.img}" alt="" loading="lazy">
        <div><b>${esc(p.title)}</b><span>${p.year} · ${esc(p.place)}</span>
        <span class="liten">${yearEmoji(g.diff)} ${g.diff} år unna · ${placeEmoji(g.km)} ${fmt(g.km)} km unna</span></div>
        <b class="p">${fmt(g.yp + g.pp)}</b></li>`; }).join('')}
    </ol>
    <pre class="deletekst">${esc(shareText())}</pre>
    <button id="del" class="knapp hoved">Del resultatet</button>
    <p id="kopiert" class="liten" hidden>Kopiert! Lim inn i familiechatten.</p>
    ${isToday ? `
    <div class="statistikk">
      <div><b>${s.played}</b><span>spilt</span></div>
      <div><b>${s.played ? fmt(Math.round(s.sum / s.played)) : 0}</b><span>snitt</span></div>
      <div><b>${fmt(s.best)}</b><span>beste</span></div>
      <div><b>${s.streak}</b><span>dager på rad</span></div>
    </div>
    <p class="nedtelling">Nye bilder om <b id="tid"></b></p>` : `<p><a class="knapp" href="${BASE}/">Spill dagens bilder</a></p>`}
    <p class="lenker"><a href="${BASE}/arkiv/">Spill tidligere dager</a> · <a href="${BASE}/om/">Om Tidsbilde</a></p>
  </section>`;
  $('#del').addEventListener('click', share);
  if (isToday) tick();
  if (fresh) window.scrollTo({ top: 0 });
}

async function share() {
  const text = shareText();
  track('del');
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ text }); return; } catch {}
  }
  try { await navigator.clipboard.writeText(text); } catch {
    const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
  }
  $('#kopiert').hidden = false;
}

function tick() {
  const el = $('#tid'); if (!el) return;
  const now = new Date();
  const osloNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Oslo' }));
  const midnight = new Date(osloNow); midnight.setHours(24, 0, 0, 0);
  const ms = midnight - osloNow;
  const h = Math.floor(ms / 36e5), m = Math.floor((ms % 36e5) / 6e4), s = Math.floor((ms % 6e4) / 1e3);
  el.textContent = `${h} t ${String(m).padStart(2, '0')} min ${String(s).padStart(2, '0')} s`;
  if (ms < 1000) setTimeout(() => location.reload(), 1500); else setTimeout(tick, 1000);
}

function openZoom() {
  const z = $('#zoomlag'); $('#zoomlag img').src = day.photos[round]?.img || ''; z.hidden = false;
}

function track(ev) { try { window.goatcounter?.count({ path: 'hendelse-' + ev, event: true }); } catch {} }
function esc(s = '') { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

init();
