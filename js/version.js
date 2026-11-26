// App version (semver): MAJOR.MINOR.PATCH. Keep in sync with sw.js; `npm run bump -- patch|minor|major` does both.
//   patch = fix or copy tweak · minor = new feature · major = big change
export const APP_VERSION = '1.11.2';

/** Oldest version that has push notifications (the 🔔 card). */
export const MIN_PUSH_VERSION = '1.9.1';

/** -1 if a < b, 0 if equal, 1 if a > b (semver MAJOR.MINOR.PATCH). */
export function compareVersions(a, b) {
  const x = String(a).split('.').map(Number);
  const y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}
