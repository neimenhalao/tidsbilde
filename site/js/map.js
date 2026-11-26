// Enkelt SVG-kart over Norge med panorering, zoom og nål.
import { VIEWBOX, FYLKER, NABO } from './norge.js';
import { project, unproject } from './proj.js';

const NS = 'http://www.w3.org/2000/svg';
const BYER = [
  ['Oslo', 10.75, 59.91], ['Bergen', 5.32, 60.39], ['Trondheim', 10.4, 63.43], ['Stavanger', 5.73, 58.97],
  ['Kristiansand', 7.99, 58.15], ['Tromsø', 18.96, 69.65], ['Bodø', 14.4, 67.28], ['Ålesund', 6.15, 62.47],
  ['Lillehammer', 10.47, 61.12], ['Alta', 23.27, 69.97], ['Kirkenes', 30.05, 69.73], ['Narvik', 17.43, 68.44],
];
const el = (n, a = {}) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };

export class NorgesKart {
  constructor(host, { onPick } = {}) {
    this.host = host; this.onPick = onPick; this.locked = false;
    this.svg = el('svg', { class: 'kart', role: 'img', 'aria-label': 'Kart over Norge. Trykk for å sette nål.' });
    this.g = el('g');
    this.g.append(el('path', { d: NABO, class: 'nabo' }));
    for (const f of FYLKER) { const p = el('path', { d: f.d, class: 'fylke' }); const t = el('title'); t.textContent = f.name; p.append(t); this.g.append(p); }
    this.byer = el('g', { class: 'byer' });
    for (const [navn, lon, lat] of BYER) {
      const [x, y] = project(lon, lat);
      const c = el('circle', { cx: x, cy: y, r: 2.5, class: 'by' });
      const t = el('text', { x: x + 6, y: y + 3, class: 'bynavn' }); t.textContent = navn;
      this.byer.append(c, t);
    }
    this.lag = el('g');
    this.svg.append(this.g, this.byer, this.lag);
    host.append(this.svg);
    this.full = [...VIEWBOX];
    this.vb = [...VIEWBOX];
    this.apply();
    this.#events();
    new ResizeObserver(() => this.apply()).observe(this.svg);
  }

  apply() {
    this.svg.setAttribute('viewBox', this.vb.join(' '));
    // hold markører og tekst like store på skjermen
    const s = this.scale();
    this.svg.style.setProperty('--s', s);
    this.lag.querySelectorAll('[data-r]').forEach((c) => c.setAttribute('r', c.dataset.r * s));
    this.byer.querySelectorAll('circle').forEach((c) => c.setAttribute('r', 2.6 * s));
    this.byer.querySelectorAll('text').forEach((t) => { t.style.fontSize = 11 * s + 'px'; });
    this.svg.querySelectorAll('.fylke').forEach((p) => p.style.strokeWidth = 0.8 * s);
    this.lag.querySelectorAll('line').forEach((l) => { l.style.strokeWidth = 2 * s; l.style.strokeDasharray = `${6 * s} ${4 * s}`; });
  }
  scale() { const w = this.svg.clientWidth || 300, h = this.svg.clientHeight || 300; return Math.max(this.vb[2] / w, this.vb[3] / h); }

  toMap(cx, cy) {
    const r = this.svg.getBoundingClientRect();
    const s = this.scale();
    // preserveAspectRatio xMidYMid meet
    const ox = this.vb[0] - (r.width * s - this.vb[2]) / 2, oy = this.vb[1] - (r.height * s - this.vb[3]) / 2;
    return [ox + (cx - r.left) * s, oy + (cy - r.top) * s];
  }

  zoom(f, cx, cy) {
    const [mx, my] = cx == null ? [this.vb[0] + this.vb[2] / 2, this.vb[1] + this.vb[3] / 2] : this.toMap(cx, cy);
    let w = this.vb[2] * f, h = this.vb[3] * f;
    const min = 40, max = this.full[2] * 1.1;
    if (w < min) { h *= min / w; w = min; }
    if (w > max) { h *= max / w; w = max; }
    const k = w / this.vb[2];
    this.vb = [mx - (mx - this.vb[0]) * k, my - (my - this.vb[1]) * k, w, h];
    this.apply();
  }
  reset() { this.vb = [...this.full]; this.apply(); }

  fit(points, pad = 60) {
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
    let x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) - x0 + pad, h = Math.max(...ys) - y0 + pad;
    const r = this.svg.getBoundingClientRect(), ar = (r.width || 1) / (r.height || 1);
    if (w / h < ar) { const nw = h * ar; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / ar; y0 -= (nh - h) / 2; h = nh; }
    if (w < 120) { const k = 120 / w; x0 -= (w * k - w) / 2; y0 -= (h * k - h) / 2; w *= k; h *= k; }
    this.vb = [x0, y0, w, h]; this.apply();
  }

  #events() {
    const pts = new Map(); let moved = 0, last = null, pinch = null;
    this.svg.addEventListener('pointerdown', (e) => {
      this.svg.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) { moved = 0; last = [e.clientX, e.clientY]; }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); moved = 99; }
    });
    this.svg.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        this.zoom(pinch / d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); pinch = d; return;
      }
      if (pts.size === 1 && last) {
        const dx = e.clientX - last[0], dy = e.clientY - last[1]; moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 6) { const s = this.scale(); this.vb[0] -= dx * s; this.vb[1] -= dy * s; this.apply(); }
        last = [e.clientX, e.clientY];
      }
    });
    const end = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size === 0) {
        if (moved <= 6 && !this.locked && e.type === 'pointerup') {
          const [x, y] = this.toMap(e.clientX, e.clientY);
          this.setGuess(x, y);
          this.onPick?.(unproject(x, y));
        }
        pinch = null; last = null;
      }
    };
    this.svg.addEventListener('pointerup', end);
    this.svg.addEventListener('pointercancel', end);
    this.svg.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(e.deltaY > 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY); }, { passive: false });
  }

  clear() { this.lag.replaceChildren(); this.guess = null; }
  setGuess(x, y) {
    this.lag.querySelector('.gjett')?.remove();
    const c = el('circle', { cx: x, cy: y, class: 'gjett', 'data-r': 7 });
    this.lag.append(c); this.guess = [x, y]; this.apply();
  }
  guessLonLat() { return this.guess ? unproject(...this.guess) : null; }
  showAnswer(lon, lat, guessLonLat) {
    const a = project(lon, lat);
    const items = [];
    if (guessLonLat) {
      const g = project(...guessLonLat);
      items.push(el('line', { x1: g[0], y1: g[1], x2: a[0], y2: a[1], class: 'avstand' }));
    }
    items.push(el('circle', { cx: a[0], cy: a[1], class: 'fasit', 'data-r': 8 }));
    this.lag.prepend(...items);
    this.fit(guessLonLat ? [a, project(...guessLonLat)] : [a]);
  }
}
