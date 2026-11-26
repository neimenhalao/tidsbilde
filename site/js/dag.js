// Dagnummer etter norsk tid. Delt mellom spillet og delingssidene /dag/N/.
import { START } from './config.js';

export function osloDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
export function dayNumber(iso = osloDate()) {
  const [y, m, d] = iso.split('-').map(Number), [sy, sm, sd] = START.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(sy, sm - 1, sd)) / 864e5) + 1;
}
