const CACHE_NAME = 'pg-admin-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // A minimal fetch handler to satisfy PWA requirements
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response("You are offline. Please reconnect to use the application.");
    })
  );
});
