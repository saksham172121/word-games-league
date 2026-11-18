// Local-time date helpers. Dates are 'YYYY-MM-DD' strings in the player's own timezone.

const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const fromISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (iso, n) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const monthKey = (iso) => iso.slice(0, 7);
/** Monday of the week containing `iso`. */
export const weekStart = (iso) => {
  const d = fromISO(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return toISO(d);
};
export const prettyDate = (iso) =>
  fromISO(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
export const monthTitle = (key) =>
  fromISO(key + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
export const shiftMonth = (key, n) => {
  const d = fromISO(key + '-01');
  d.setMonth(d.getMonth() + n);
  return toISO(d).slice(0, 7);
};
