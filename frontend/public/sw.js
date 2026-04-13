/**
 * Service Worker — Port Terminal ERP
 *
 * Strategy:
 *   - App shell (JS/CSS/HTML): cache-first, update in background
 *   - API calls (/api/*):      network-first, no caching (live data must be fresh)
 *   - Static assets:           stale-while-revalidate
 */

const CACHE_NAME    = 'pte-shell-v1';
const API_PREFIX    = '/api/';

// Assets to pre-cache on install (add build fingerprinted assets via workbox or manually)
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API: always network-first, no cache
  if (url.pathname.startsWith(API_PREFIX)) {
    event.respondWith(fetch(request));
    return;
  }

  // Socket.io long-poll / websocket upgrade — skip
  if (url.pathname.startsWith('/socket.io')) return;

  // App shell: cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached); // offline fallback to cached copy

      return cached || networkFetch;
    })
  );
});

// ── Push notifications (stub — enable when push backend is ready) ─────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Port Terminal ERP', {
      body:    data.body    || '',
      icon:    '/icons/icon-192.png',
      badge:   '/icons/icon-192.png',
      data:    data.url ? { url: data.url } : {},
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.notification.data?.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});
