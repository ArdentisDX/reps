// Service Worker de REPS — estrategia offline-first.
// Versión del cache: súbela (v2, v3...) cada vez que cambies HTML/CSS/JS,
// para que los dispositivos descarguen la copia nueva.
const CACHE = 'reps-v6';

// El "app shell": todos los archivos que la app necesita para funcionar.
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

// INSTALL: se dispara una sola vez, cuando el navegador ve un SW nuevo.
// Descarga todos los archivos del shell y los guarda en el cache.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // activa esta versión sin esperar a que se cierren pestañas viejas
});

// ACTIVATE: se dispara cuando esta versión toma el control.
// Borra los caches de versiones anteriores (reps-v1 cuando llegue reps-v2, etc.).
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// FETCH: intercepta CADA petición de la app.
// Estrategia cache-first: responde desde el cache (instantáneo, funciona sin
// internet) y solo va a la red si el archivo no está guardado. Lo que traiga
// de la red lo guarda para la próxima vez.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return; // solo cacheamos lecturas

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;

      return fetch(e.request).then((res) => {
        // guarda una copia de lo descargado (p. ej. los íconos)
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(e.request, copy));
        return res;
      }).catch(() => {
        // sin internet y no está en cache: si es navegación, sirve la app
        if (e.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
