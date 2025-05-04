// service-worker.js

const CACHE_NAME = 'assets-cache-v1';
const ASSETS_TO_CACHE = [
  '/assets/*',  // This caches everything in the assets folder (you can list specific files here as needed)
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  // Only cache requests to the /assets path
  if (event.request.url.includes('/assets')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // If we have a cached response, return it
        if (cachedResponse) {
          return cachedResponse;
        }
        // Otherwise, fetch from network and cache the response
        return fetch(event.request).then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
  }
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
