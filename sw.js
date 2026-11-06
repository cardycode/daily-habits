// © 2026 Carol Morris. All rights reserved.
// Offline support. When the phone is online, the app always loads the newest files
// from the website (skipping the browser's own cache). When offline, or if the network
// takes longer than 3 seconds, it falls back to the last saved copy.
const CACHE = 'daily-habits-v8';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'fonts/roboto-mono.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (err) => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;
  if (!sameOrigin) return; // the app never loads anything from other websites

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Same-origin files: ask the server for the newest copy, ignoring the browser cache.
    const fresh = sameOrigin
      ? fetch(req.mode === 'navigate' ? req.url : req, { cache: 'no-cache' })
      : fetch(req);
    const update = fresh.then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    });
    e.waitUntil(update.catch(() => {}));
    try {
      return await withTimeout(update, 3000);
    } catch (err) {
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const shell = await cache.match('index.html');
        if (shell) return shell;
      }
      return update; // nothing cached yet, so keep waiting for the network
    }
  })());
});
