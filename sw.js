// Tiny service worker: makes the app open instantly and work offline.
// Bump VERSION whenever you change files so phones pick up the update.
const VERSION = 'v7';
const CACHE = `wgl-${VERSION}`;
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js', 'js/scoring.js', 'js/stats.js', 'js/dates.js', 'js/jokes.js', 'js/store.js',
  'js/firebase-config.js', 'js/confetti.js', 'js/dadjokes.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const cacheable =
    url.origin === self.location.origin ||
    url.hostname === 'www.gstatic.com' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';
  if (!cacheable) return; // Firestore/Auth traffic goes straight to the network

  // Stale-while-revalidate
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: false });
      const net = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        })
        .catch(() => hit || (req.mode === 'navigate' ? cache.match('index.html') : undefined));
      return hit || net;
    }),
  );
});
