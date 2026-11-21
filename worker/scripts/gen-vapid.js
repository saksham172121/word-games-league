// One-time: generate the VAPID key pair used to sign web-push messages.
//   node scripts/gen-vapid.js
// Prints the PUBLIC key (safe to commit: it goes in js/push-config.js and wrangler.toml) and writes the
// PRIVATE key to worker/.vapid-private.txt (git-ignored). Never commit or share the private key.
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', '.vapid-private.txt');
if (existsSync(out)) { console.error('Refusing to overwrite existing', out); process.exit(1); }
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });
const b64 = (s) => Buffer.from(s, 'base64url');
const raw = Buffer.concat([Buffer.from([4]), b64(pub.x), b64(pub.y)]).toString('base64url'); // uncompressed point
writeFileSync(out, priv.d + '\n', { mode: 0o600 });
console.log('PUBLIC KEY:', raw);
console.log('Private key saved to', out, '(git-ignored)');
