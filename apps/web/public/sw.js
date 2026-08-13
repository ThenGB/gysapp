/* GYSApp service worker: bounded offline shell.
 * Strategi:
 * - Navigasi + file app lokal (js/css/html): network-first, fallback cache.
 * - Konten besar (pdf/midi/soundfont/chord JSON): SELALU network (dikelola
 *   sendiri oleh IndexedDB / lazy cache, tidak pernah dobel di Cache API).
 * - Aset statis lokal (font/icon/image/manifest): cache-first.
 * - API, analytics, dan request lintas-origin tidak disimpan oleh shell cache.
 */
const CACHE_NAME = 'gysapp-shell-v2';
const NEVER_CACHE = ['/pdf/', '/assets/midi/', '/assets/soundfont/', '.chord.json'];
const STATIC_EXTENSIONS = /\.(?:avif|gif|ico|jpe?g|png|svg|webp|woff2?|webmanifest)$/i;
const APP_EXTENSIONS = /\.(?:css|html|js|mjs)$/i;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Keep the offline shell deliberately same-origin and static. Dynamic API and
  // cross-origin data own their freshness/caching policy outside Cache Storage.
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
  if (NEVER_CACHE.some((fragment) => url.pathname.includes(fragment))) return;

  const isNavigation = event.request.mode === 'navigate';
  const isAppFile =
    isNavigation ||
    APP_EXTENSIONS.test(url.pathname) ||
    url.pathname === '/' ||
    url.pathname.endsWith('/');

  if (isAppFile) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        fetch(event.request)
          .then((response) => {
            if (response.status === 200) {
              void cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => cache.match(event.request).then((cached) => cached || Response.error())),
      ),
    );
    return;
  }

  if (!STATIC_EXTENSIONS.test(url.pathname)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.status === 200) {
              void cache.put(event.request, response.clone());
            }
            return response;
          }),
      ),
    ),
  );
});
