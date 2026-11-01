// Service worker: lets the installed home-screen app run offline.
//
// Strategy is network-first: when online you always get the latest files you
// pushed (no stale-cache surprises while iterating), and every successful
// response is saved so the game still loads with no connection.
//
// Only bump CACHE if you rename/remove files and want old copies purged.

const CACHE = 'unicorn-golf-v1';
const SHELL = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'src/course.js',
  'src/draw.js',
  'src/game.js',
  'src/hud.js',
  'src/main.js',
  'fonts/fredoka-latin.woff2',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/favicon-32.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
