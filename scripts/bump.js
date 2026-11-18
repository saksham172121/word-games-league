// Usage: npm run bump -- patch|minor|major
// Bumps the version in js/version.js and sw.js together (the sw.js one busts phones' caches).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vPath = join(root, 'js/version.js');
const swPath = join(root, 'sw.js');
const kind = process.argv[2];
if (!['patch', 'minor', 'major'].includes(kind)) {
  console.error('Usage: npm run bump -- patch|minor|major');
  process.exit(1);
}

const src = readFileSync(vPath, 'utf8');
const cur = src.match(/APP_VERSION = '(\d+)\.(\d+)\.(\d+)'/);
if (!cur) throw new Error('Could not find APP_VERSION in js/version.js');
let [maj, min, pat] = cur.slice(1).map(Number);
if (kind === 'major') { maj++; min = 0; pat = 0; }
else if (kind === 'minor') { min++; pat = 0; }
else pat++;
const next = `${maj}.${min}.${pat}`;

writeFileSync(vPath, src.replace(/APP_VERSION = '[^']+'/, `APP_VERSION = '${next}'`));
const sw = readFileSync(swPath, 'utf8');
writeFileSync(swPath, sw.replace(/const VERSION = '[^']+'/, `const VERSION = '${next}'`));
console.log(`Version → ${next}`);
