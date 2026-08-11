/* GYSApp service worker: offline shell.
 * Strategi:
 * - File app lokal (js/css/html): network-first, fallback cache.
 * - Konten besar (pdf/midi/soundfont/chord JSON): SELALU network (dikelola
 *   sendiri oleh IndexedDB / lazy cache, tidak pernah dobel di Cache API).
 * - Aset statis lain (font/icon/manifest): cache-first.
 */
const CACHE_NAME = 'gysapp-shell-v1';
const NEVER_CACHE = ['/pdf/', '/assets/midi/', '/assets/soundfont/', '.chord.json'];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (NEVER_CACHE.some((prefix) => url.pathname.includes(prefix))) return;

  const isAppFile =
    url.origin === self.location.origin &&
    (url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('.webmanifest') ||
      url.pathname.endsWith('.svg') ||
      url.pathname === '/' ||
      url.pathname.endsWith('/'));

  if (isAppFile) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        fetch(event.request)
          .then((res) => {
            if (res && res.status === 200) cache.put(event.request, res.clone());
            return res;
          })
          .catch(() => cache.match(event.request).then((cached) => cached || Response.error())),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((res) => {
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        }),
    ),
  );
});
