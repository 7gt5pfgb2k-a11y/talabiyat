// طلبيات — يشتغل بدون إنترنت: الملفات من الذاكرة فوراً، وتحديثها بالخلفية
const CACHE = 'talabiyat-v6';
const SHELL = ['./', 'index.html', 'app.css', 'store.js', 'common.js', 'parser.js', 'manager.js', 'avatar.js', 'icons/avatar-ahmed.jpg', 'icons/ahmed-full.webp', 'fonts/IBMPlexSansArabic-400-arabic.woff2', 'fonts/IBMPlexSansArabic-400-latin.woff2', 'fonts/IBMPlexSansArabic-700-arabic.woff2', 'fonts/IBMPlexSansArabic-700-latin.woff2', 'fonts/ReemKufi-600-arabic.woff2', 'fonts/ReemKufi-600-latin.woff2', 'manifest.webmanifest', 'favicon.png',
  'icons/icon-192.png', 'icons/apple-touch-icon.png', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'vendor/leaflet/images/marker-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // الخريطة وغيرها من الإنترنت مباشرة
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || (e.request.mode === 'navigate' ? c.match('index.html') : Response.error());
  }));
});
