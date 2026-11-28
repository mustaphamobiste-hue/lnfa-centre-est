/* Mobistes : service worker (ouverture plus rapide et mode hors connexion) */
const VERSION = 'mobistes-v1';
const PRECACHE = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => Promise.all(PRECACHE.map((u) => cache.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Pages du site : le reseau d'abord (toujours la derniere version), le cache si hors connexion
  if (req.mode === 'navigate' || (sameOrigin && (url.pathname.endsWith('/') || /\.html?$/.test(url.pathname)))) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./')))
    );
    return;
  }

  // Fichiers du site et bibliotheque Firebase : cache d'abord, mise a jour en arriere-plan
  const isFirebaseLib = url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0;
  if (sameOrigin || isFirebaseLib) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req)
          .then((res) => {
            if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
            return res;
          })
          .catch(() => hit);
        return hit || net;
      })
    );
  }
  // Le reste (base de donnees Firebase, Analytics, polices, images externes) : reseau normal
});
