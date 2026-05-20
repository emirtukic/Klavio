const CACHE_NAME = 'klavio-v1';
const STATIC_ASSETS = [
  '/',
  '/assets/css/style.css',
  '/assets/js/auth.js',
  '/assets/js/api.js',
  '/assets/js/utils.js',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API calls: network-first, fall back to cached response
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Static assets: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (e.request.mode === 'navigate') return caches.match('/');
      });
    })
  );
});

// Push notification handler
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'Klavio', body: 'Nova obavijest' };
  e.waitUntil(
    self.registration.showNotification(data.title || 'Klavio', {
      body: data.body || '',
      icon: '/assets/img/icon-192.png',
      badge: '/assets/img/icon-192.png',
      tag: data.tag || 'klavio-notif',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'));
});
