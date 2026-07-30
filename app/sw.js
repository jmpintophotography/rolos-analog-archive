const CACHE_NAME = "rolos-app-v2-8-1-20260726-r1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manual.html",
  "./styles.css",
  "./app.js",
  "./v25-core.js",
  "./cost-center-core.js",
  "./integrity-core.js",
  "./calendar-dates.js",
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
  "./assets/film-packages/adox-chs-100-ii.jpg",
  "./assets/film-packages/adox-hr-50.jpg",
  "./assets/film-packages/cinestill-800t.jpg",
  "./assets/film-packages/fomapan-100.jpg",
  "./assets/film-packages/fomapan-200.jpg",
  "./assets/film-packages/fomapan-400.jpg",
  "./assets/film-packages/fujifilm-200.jpg",
  "./assets/film-packages/fujifilm-400.jpg",
  "./assets/film-packages/fujifilm-provia-100f.jpg",
  "./assets/film-packages/harman-phoenix-200.jpg",
  "./assets/film-packages/ilford-delta-400.jpg",
  "./assets/film-packages/ilford-delta-3200.jpg",
  "./assets/film-packages/ilford-hp5-plus-400.jpg",
  "./assets/film-packages/ilford-panf-plus-50.jpg",
  "./assets/film-packages/jch-streetpan-400.jpg",
  "./assets/film-packages/kentmere-pan-400.jpg",
  "./assets/film-packages/kodak-colorplus-200.jpg",
  "./assets/film-packages/kodak-ektar-100.jpg",
  "./assets/film-packages/kodak-gold-200.jpg",
  "./assets/film-packages/kodak-tri-x-400.jpg",
  "./assets/film-packages/kodak-ultramax-400.jpg",
  "./assets/film-packages/rollei-blackbird-64.jpg",
  "./assets/film-packages/rollei-superpan-200.jpg",
  "./assets/film-packages/santacolor-100.jpg",
  "./assets/film-packages/agfa-apx-400.jpg",
  "./assets/film-packages/fujifilm-fujicolor-100.jpg",
  "./assets/film-packages/fujifilm-acros-100.jpg",
  "./assets/film-packages/fujifilm-c200.jpg",
  "./assets/film-packages/fujifilm-pro-400h.jpg",
  "./assets/film-packages/fujifilm-provia-400f.jpg",
  "./assets/film-packages/fujifilm-superia-100.jpg",
  "./assets/film-packages/fujifilm-superia-400.jpg",
  "./assets/film-packages/fujifilm-velvia-100.jpg",
  "./assets/film-packages/fujifilm-velvia-100f.jpg",
  "./assets/film-packages/ilford-fp4-plus-125.jpg",
  "./assets/film-packages/ilford-xp2-super-400.jpg",
  "./assets/film-packages/kodak-ektachrome-100vs.jpg",
  "./assets/film-packages/kodak-portra-160.jpg",
  "./assets/film-packages/kodak-portra-400.jpg",
  "./assets/film-packages/kodak-proimage-100.jpg",
  "./assets/film-packages/kodak-tmax-100.jpg",
  "./assets/film-packages/kodak-tmax-3200.jpg",
  "./assets/film-packages/lomo-color-negative-400.jpg",
  "./assets/film-packages/lomo-color-negative-800.jpg",
  "./assets/film-packages/lomo-metropolis.jpg",
  "./assets/film-packages/lomo-purple.jpg",
  "./assets/film-packages/rollei-retro-400s.jpg",
  "./assets/film-packages/rollei-rpx-400.jpg",
  "./assets/film-packages/shanghai-gp3-100.jpg",
  "./assets/film-packages/wolfen-np100.jpg",
  "./assets/film-packages/film-agfa-vista-800.jpg",
  "./assets/film-packages/film-cinemot-fado-200.jpg",
  "./assets/film-packages/film-era-pan-100.jpg",
  "./assets/film-packages/film-ferrania-solaris-100.jpg",
  "./assets/film-packages/film-flicfilm-ultrapan-100.jpg",
  "./assets/film-packages/film-flicfilm-ultrapan-400.jpg",
  "./assets/film-packages/film-fujifilm-neopan-1600.jpg",
  "./assets/film-packages/film-funghi-liquen-250d.jpg",
  "./assets/film-packages/film-ilford-pan-400.jpg",
  "./assets/film-packages/film-kodak-double-x-250.jpg",
  "./assets/film-packages/film-kodak-ektar-g-100-120.jpg",
  "./assets/film-packages/film-kodak-gold-100.jpg",
  "./assets/film-packages/film-kodak-gold-400.jpg",
  "./assets/film-packages/film-kodak-gold-800.jpg",
  "./assets/film-packages/film-kodak-tmax-400.jpg",
  "./assets/film-packages/film-kodak-vision-250d.jpg",
  "./assets/film-packages/film-kodak-vision-500t.jpg",
  "./assets/film-packages/film-leica-monopan-50.jpg",
  "./assets/film-packages/film-samsung-c200.jpg",
  "./assets/film-packages/film-santa-rae-1000.jpg",
  "./assets/equipment/accessory-doomo-meter-s.jpg",
  "./assets/equipment/accessory-godox-fs-r.jpg",
  "./assets/equipment/accessory-godox-im30pro.jpg",
  "./assets/equipment/accessory-hama-mechanical-timer.jpg",
  "./assets/equipment/accessory-nikon-as-4.jpg",
  "./assets/equipment/accessory-ttartisan-super-mini-led.jpg",
  "./assets/equipment/camera-canon-canonet-ql17.jpg",
  "./assets/equipment/camera-leica-cl.jpg",
  "./assets/equipment/camera-leica-m6.jpg",
  "./assets/equipment/camera-lomo-mc-a.jpg",
  "./assets/equipment/camera-nikon-f3.jpg",
  "./assets/equipment/camera-olympus-mju-zoom.jpg",
  "./assets/equipment/camera-pentax-k1000.jpg",
  "./assets/equipment/camera-seagull-4b.jpg",
  "./assets/equipment/flash-ulanzi-sl02.jpg",
  "./assets/equipment/flash-zeniko-za12.jpg",
  "./assets/equipment/lens-artizlab-classic-35-f14.jpg",
  "./assets/equipment/lens-brightin-star-28-f28.jpg",
  "./assets/equipment/lens-leica-elmarit-90-f28.jpg",
  "./assets/equipment/lens-leica-summicron-c-40-f2.jpg",
  "./assets/equipment/lens-nikon-af-35-70.jpg",
  "./assets/equipment/lens-nikon-af-70-200-f4.jpg",
  "./assets/equipment/lens-nikon-nikkor-ai-50-f14.jpg",
  "./assets/equipment/lens-nikon-series-e-35-f25.jpg",
  "./assets/equipment/lens-pentax-50-f14.jpg",
  "./assets/equipment/lens-pentax-fa-28-200.jpg",
  "./assets/equipment/lens-voigtlander-color-skopar-35-f25.jpg",
  "./assets/equipment/lens-voigtlander-nokton-50-f15.jpg",
  "./data/seed.json",
  "./data/seed.js",
  "./data/film-images.js",
  "./data/equipment-images.js",
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
