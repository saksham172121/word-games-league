// Client side of web push: ask permission, subscribe, tell the Worker. All no-ops until PUSH.workerUrl is set.
import { PUSH } from './push-config.js';

export const pushConfigured = () => !!PUSH.workerUrl;
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const b64ToBytes = (s) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

async function registration() {
  // serviceWorker.ready never resolves if no SW is registered (e.g. localhost dev), so don't wait forever.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, rej) => setTimeout(() => rej(new Error('no service worker')), 4000)),
  ]);
}

async function post(path, body) {
  const res = await fetch(PUSH.workerUrl + path, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`worker ${path} ${res.status}`);
  return res.json();
}

/** { supported, permission, subscribed } for this phone. */
export async function pushState() {
  if (!pushConfigured() || !pushSupported()) return { supported: false, permission: 'default', subscribed: false };
  try {
    const sub = await (await registration()).pushManager.getSubscription();
    return { supported: true, permission: Notification.permission, subscribed: !!sub };
  } catch {
    return { supported: true, permission: Notification.permission, subscribed: false };
  }
}

export async function enablePush(player) {
  const permission = await Notification.requestPermission(); // must be called from a tap
  if (permission !== 'granted') throw new Error('Notifications were blocked. Allow them in your phone settings.');
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(PUSH.vapidPublicKey) }));
  await post('/subscribe', { player, subscription: sub.toJSON() });
}

export async function disablePush(player) {
  const sub = await (await registration()).pushManager.getSubscription();
  if (!sub) return;
  await post('/unsubscribe', { player, endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

/** Called on every app launch: keeps this phone's subscription fresh on the Worker (it expires after 120 idle days). */
export async function refreshPush(player) {
  if (!pushConfigured() || !pushSupported() || Notification.permission !== 'granted') return;
  try {
    const sub = await (await registration()).pushManager.getSubscription();
    if (sub) await post('/subscribe', { player, subscription: sub.toJSON() });
  } catch { /* offline etc. */ }
}

/** Fire-and-forget: tell the Worker this player just posted (it notifies the other player if that switch is on). */
export function notifyPosted(player) {
  if (!pushConfigured()) return;
  fetch(PUSH.workerUrl + '/event', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'posted', player }), keepalive: true,
  }).catch(() => {});
}

export const sendTest = (player) => post('/test', { player });
