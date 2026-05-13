self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (url.origin !== location.origin) {
    return;
  }

  if (e.request.method !== 'GET') return;

  if (
    e.request.mode === 'navigate' ||
    e.request.headers.get('accept')?.includes('text/html')
  ) {
    e.respondWith(
      fetch(e.request)
        .catch(() =>
          new Response(
            '<html><head><meta http-equiv="refresh" content="0"></head></html>',
            { headers: { 'Content-Type': 'text/html' } }
          )
        )
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response.ok && response.status === 200) {
          const clone = response.clone();
          caches.open('mc-assets-v1')
            .then(cache => { cache.put(e.request, clone); });
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
