// Sfærisk transversal Mercator sentrert på Norge. Enheter: km.
// Brukes både i byggeskript og i nettleseren (kopieres til site/js/proj.js).
const R = 6371;
const D = Math.PI / 180;
const L0 = 15 * D; // sentralmeridian
const P0 = 65 * D; // referansebredde

export function project(lon, lat) {
  const l = lon * D - L0, p = lat * D;
  const B = Math.cos(p) * Math.sin(l);
  const x = 0.5 * Math.log((1 + B) / (1 - B));
  const y = Math.atan2(Math.tan(p), Math.cos(l)) - P0;
  return [x * R, -y * R]; // y nedover i SVG
}

export function unproject(X, Y) {
  const x = X / R, d = -Y / R + P0;
  const lat = Math.asin(Math.sin(d) / Math.cosh(x));
  const lon = L0 + Math.atan2(Math.sinh(x), Math.cos(d));
  return [lon / D, lat / D];
}

export function distanceKm(lat1, lon1, lat2, lon2) {
  const a = Math.sin(((lat2 - lat1) * D) / 2) ** 2 +
    Math.cos(lat1 * D) * Math.cos(lat2 * D) * Math.sin(((lon2 - lon1) * D) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
