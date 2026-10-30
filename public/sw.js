// Service Worker — Business Pay PWA
// Gestion du cache et du mode hors-ligne pour les réseaux mobiles instables (Abidjan / UEMOA)

const CACHE_NAME = 'business-pay-pwa-v1';

// Fichiers et pages clés mis en cache à l'installation
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png'
];

// Événement d'installation : pré-mise en cache des ressources fondamentales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW Business Pay] Pré-mise en cache des fichiers PWA...');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Événement d'activation : purge des anciens caches obsolètes
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key.startsWith('business-pay-')) {
            console.log('[SW Business Pay] Nettoyage ancien cache :', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Événement fetch : stratégie de cache adaptée au mobile
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET et les requêtes hors domaine
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) {
    return;
  }

  // 1. Routes API : Network-Only avec réponse propre si coupure réseau
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Réseau mobile interrompu (hors-ligne)', offline: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // 2. Navigation HTML (Pages de l'application)
  // Stratégie Network-First avec repli sur cache puis page de secours offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          return caches.match('/offline.html');
        })
    );
    return;
  }

  // 3. Fichiers statiques (JS, CSS, Polices, Images)
  // Stratégie Stale-While-Revalidate : réponse ultra-rapide depuis le cache + mise à jour silencieuse
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
