const CACHE_NAME = "rolos-app-v1-10-20260717-geocoding-i18n-r3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./sync-core.js",
  "./drive-backup-core.js",
  "./drive-backup-client.js",
  "./geocoding.js",
  "./i18n.js",
  "./app-config.js",
  "./manifest.webmanifest",
  "./firebase-config.js",
  "./icon.svg",
  "./vendor/lucide.min.js",
  "./vendor/LUCIDE-LICENSE.txt",
  "./assets/film-tab-texture.png",
  "./data/seed.json",
  "./data/seed.js",
  "./data/film-images.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
