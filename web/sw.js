// Service worker: caches the whole app so it opens and works with no internet.
const CACHE = 'campusguard-v8';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'engine.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match('index.html'))));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const locationId = data.locationId, fireAt = data.fireAt;
  if (!locationId) return;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    for (const client of clients) {
      if (client.url.startsWith(self.location.origin)) {
        client.postMessage({ type: 'nearest-exit', locationId, fireAt });
        return client.focus();
      }
    }
    return self.clients.openWindow(`./?nearestExit=${encodeURIComponent(locationId)}&fireAt=${encodeURIComponent(fireAt || '')}`);
  }));
});
