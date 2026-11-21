// Word Games League push Worker (Cloudflare Workers, free plan).
//   POST /subscribe    { player, subscription }   store a phone's push subscription
//   POST /unsubscribe  { player, endpoint }
//   POST /event        { type: 'posted', player } "X just posted" -> push to the other player
//   POST /test         { player }                 send that player a test notification
//   cron (hourly)      morning greeting + evening nudge, in the configured time zone
// Subscriptions live in KV (binding SUBS). Switches/entries are read from Firestore via its REST API,
// signing in anonymously with the same public web API key the app uses.
import { buildPushPayload } from '@block65/webcrypto-web-push';
import { PLAYERS, otherOf, localParts, switches, postedMessage, cronMessages } from './logic.js';

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...extra } });

function corsHeaders(req, env) {
  const origin = req.headers.get('origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return {
    'access-control-allow-origin': ok ? origin : allowed[0] || '',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');

// ---------- Firestore (REST) ----------
async function idToken(env) {
  const cached = await env.SUBS.get('fb:idtoken', 'json');
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const key = env.FIREBASE_API_KEY;
  let res, data;
  const refresh = await env.SUBS.get('fb:refresh');
  if (refresh) {
    res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${key}`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refresh)}`,
    });
    if (res.ok) {
      data = await res.json();
      const token = data.id_token;
      await env.SUBS.put('fb:refresh', data.refresh_token);
      await env.SUBS.put('fb:idtoken', JSON.stringify({ token, exp: Date.now() + Number(data.expires_in) * 1000 }), { expirationTtl: 3000 });
      return token;
    }
  }
  res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${key}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!res.ok) throw new Error('firebase sign-in failed ' + res.status);
  data = await res.json();
  await env.SUBS.put('fb:refresh', data.refreshToken);
  await env.SUBS.put('fb:idtoken', JSON.stringify({ token: data.idToken, exp: Date.now() + Number(data.expiresIn) * 1000 }), { expirationTtl: 3000 });
  return data.idToken;
}

const fsUrl = (env, path) => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;

async function fsGet(env, path) {
  const res = await fetch(fsUrl(env, path), { headers: { authorization: `Bearer ${await idToken(env)}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`firestore ${path} ${res.status}`);
  return res.json();
}

async function readSwitches(env) {
  try {
    const doc = await fsGet(env, 'settings/push');
    const f = doc?.fields || {};
    return switches({ posted: f.posted?.booleanValue, morning: f.morning?.booleanValue, evening: f.evening?.booleanValue });
  } catch (e) {
    console.warn('could not read switches', e.message);
    return switches(null);
  }
}

// ---------- Sending ----------
async function subsFor(env, player) {
  const list = await env.SUBS.list({ prefix: `sub:${player}:` });
  const subs = await Promise.all(list.keys.map(async (k) => ({ key: k.name, sub: await env.SUBS.get(k.name, 'json') })));
  return subs.filter((s) => s.sub);
}

async function sendTo(env, player, msg) {
  const vapid = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  const subs = await subsFor(env, player);
  const results = await Promise.allSettled(subs.map(async ({ key, sub }) => {
    const payload = await buildPushPayload(
      { data: JSON.stringify({ title: msg.title, body: msg.body, tag: msg.tag, url: './' }), options: { ttl: 3600, urgency: 'normal' } },
      sub, vapid,
    );
    const res = await fetch(sub.endpoint, payload);
    if (res.status === 404 || res.status === 410) await env.SUBS.delete(key); // phone unsubscribed / app removed
    return res.status;
  }));
  return { devices: subs.length, statuses: results.map((r) => (r.status === 'fulfilled' ? r.value : 'error')) };
}

// ---------- HTTP ----------
async function handle(req, env) {
  const url = new URL(req.url);
  const cors = corsHeaders(req, env);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method === 'GET' && url.pathname === '/health') return json({ ok: true }, 200, cors);
  if (req.method !== 'POST') return json({ error: 'not found' }, 404, cors);

  const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim());
  if (!allowedOrigins.includes(req.headers.get('origin') || '')) return json({ error: 'forbidden' }, 403, cors);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400, cors); }
  const player = body.player;
  if (!(player in PLAYERS)) return json({ error: 'bad player' }, 400, cors);
  const tz = env.TZ_NAME || 'UTC';

  if (url.pathname === '/subscribe') {
    const s = body.subscription;
    if (!s?.endpoint?.startsWith('https://') || !s?.keys?.p256dh || !s?.keys?.auth) return json({ error: 'bad subscription' }, 400, cors);
    const clean = { endpoint: s.endpoint, expirationTime: s.expirationTime ?? null, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
    await env.SUBS.put(`sub:${player}:${await sha(s.endpoint)}`, JSON.stringify(clean), { expirationTtl: 60 * 60 * 24 * 120 });
    return json({ ok: true }, 200, cors);
  }

  if (url.pathname === '/unsubscribe') {
    if (typeof body.endpoint === 'string') await env.SUBS.delete(`sub:${player}:${await sha(body.endpoint)}`);
    return json({ ok: true }, 200, cors);
  }

  if (url.pathname === '/event' && body.type === 'posted') {
    const { ymd } = localParts(new Date(), tz);
    const onceKey = `sent:posted:${player}:${ymd}`; // at most one "X posted" push per person per day (edits don't re-notify)
    if (await env.SUBS.get(onceKey)) return json({ ok: true, skipped: 'already notified today' }, 200, cors);
    if (!(await readSwitches(env)).posted) return json({ ok: true, skipped: 'switch off' }, 200, cors);
    await env.SUBS.put(onceKey, '1', { expirationTtl: 60 * 60 * 36 });
    const r = await sendTo(env, otherOf(player), postedMessage(player));
    return json({ ok: true, ...r }, 200, cors);
  }

  if (url.pathname === '/test') {
    const throttle = `sent:test:${player}`;
    if (await env.SUBS.get(throttle)) return json({ error: 'slow down' }, 429, cors);
    await env.SUBS.put(throttle, '1', { expirationTtl: 60 });
    const r = await sendTo(env, player, { title: 'Test notification 🔔', body: 'If you can read this, push works.', tag: 'test' });
    return json({ ok: true, ...r }, 200, cors);
  }

  return json({ error: 'not found' }, 404, cors);
}

// ---------- Cron ----------
async function runCron(env) {
  const tz = env.TZ_NAME || 'UTC';
  const { hour, ymd } = localParts(new Date(), tz);
  const morningHour = Number(env.MORNING_HOUR ?? 8);
  const eveningHour = Number(env.EVENING_HOUR ?? 20);
  if (hour !== morningHour && hour !== eveningHour) return; // nothing to do this hour: skip all network calls
  const sw = await readSwitches(env);
  if (!sw.morning && !sw.evening) return;

  const posted = { saksham: false, soukhya: false };
  if (sw.evening && hour === eveningHour) {
    for (const p of Object.keys(posted)) posted[p] = !!(await fsGet(env, `entries/${ymd}_${p}`));
  }
  for (const m of cronMessages({ hour, posted, morningHour, eveningHour, sw })) await sendTo(env, m.to, m);
}

export default {
  fetch: (req, env, ctx) => handle(req, env).catch((e) => { console.error(e); return json({ error: 'server error' }, 500); }),
  scheduled: (event, env, ctx) => ctx.waitUntil(runCron(env)),
};
