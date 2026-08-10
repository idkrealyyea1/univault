// =====================================================================
// Studora — Service worker (§20)
// 1) Push notifications + notification clicks.
// 2) Offline-first static asset cache (stale-while-revalidate) so repeat
//    visits load instantly. HTML is network-first so deploys show up.
// API + Supabase requests are NEVER cached.
// =====================================================================

// NOTE: bump the cache version whenever you change CSS/JS so visitors get the new design.

const CACHE = 'studora-static-v5';
const SHELL = [
  './css/main.css',
  './js/config.js',
  './js/supabase-client.js',
  './js/auth.js',
  './js/i18n.js',
  './js/main.js',
  './js/push.js',
  './img/bg.webp',
  './img/bg.jpg',
  './img/bg-mobile.webp',
  './img/bg-mobile.jpg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './manifest.json'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL).catch(function () { /* some entries may 404 on first deploy — that's fine */ });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never cache API calls or Supabase endpoints — always live.
  if (url.hostname.includes('onrender.com') || url.hostname === 'wipxygagzpykdohtxsfk.supabase.co') return;

  // HTML documents: network-first, cached-pages as offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          const copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
          return res;
        })
        .catch(function () { return caches.match(req); })
    );
    return;
  }

  // Static assets: serve cache instantly, refresh in the background.
  event.respondWith(
    caches.match(req).then(function (cached) {
      const network = fetch(req)
        .then(function (res) {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
          }
          return res;
        })
        .catch(function () { return cached; });
      return cached || network;
    })
  );
});

// ---- Push ----
self.addEventListener('push', function (event) {
  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'Studora', body: event.data.text(), url: './' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: { url: data.url }
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});