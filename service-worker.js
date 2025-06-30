
const CACHE_NAME = 'decksim-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './main.js',
  './simulate.js',
  './manifest.json',
  './icon.png',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
