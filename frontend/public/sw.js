const CACHE = 'smeehive-v1';

self.addEventListener('install', () => {
  // Don't precache authenticated pages — they redirect and fail SW install
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Cache static assets (JS, CSS, images, fonts); network-first for pages
  const isAsset = /\.(?:js|css|png|svg|ico|woff2?|ttf)$/.test(url.pathname);

  if (isAsset) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, clone));
            return res;
          })
      )
    );
  } else {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
