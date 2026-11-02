// Service worker: app shell cached, API always from network
const CACHE = 'ff-v3';
const SHELL = ['/', '/index.html', '/manager.html', '/restaurant.html', '/app.css', '/common.js', '/manager.js', '/parser.js', '/restaurant.js', '/manifest.webmanifest', '/icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.startsWith('/api/')) return;
  // network first, fall back to cache (so updates show up immediately when online)
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('/'))));
});
