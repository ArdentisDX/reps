// Service Worker de REPS — estrategia offline-first.
// Versión del cache: súbela (v2, v3...) cada vez que cambies HTML/CSS/JS,
// para que los dispositivos descarguen la copia nueva.
const CACHE = 'reps-v56';

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
// OJO: 'reps-datos' NO es una versión — es el espejo de datos para push; se conserva.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== 'reps-datos').map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// PUSH: llega un "tick" VACÍO del Worker (el servidor no sabe nada de ti).
// El texto se arma AQUÍ, leyendo el espejo local de tu rutina (reps-datos):
// privacidad total — el contenido nunca viaja por internet.
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let titulo = 'REPS', cuerpo = 'Tu día te espera. 🔥';
    try {
      const c = await caches.open('reps-datos');
      const r = await c.match('./rutina-espejo.json');
      if (r) {
        const rutina = await r.json();
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        // el bloque cuya hora quedó a ≤7 min del tick es el que anuncia
        let mejor = null;
        rutina.forEach((s) => {
          const [h, m] = String(s.hora).split(':').map(Number);
          const diff = (nowMin - (h * 60 + m) + 1440) % 1440;
          if (diff <= 7 && (!mejor || diff < mejor.diff)) mejor = { s, diff };
        });
        if (mejor) {
          titulo = '⏰ ' + mejor.s.hora + ' · ' + mejor.s.nombre;
          cuerpo = mejor.s.desc || 'Es la hora de este bloque.';
        }
      }
    } catch (err) {}
    await self.registration.showNotification(titulo, {
      body: cuerpo,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: 'reps-bloque', // reemplaza la anterior en vez de apilar
    });
  })());
});

// tocar la notificación abre (o enfoca) la app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
      for (const w of ws) { if ('focus' in w) return w.focus(); }
      return clients.openWindow('./');
    })
  );
});

// FETCH: intercepta CADA petición de la app.
// Estrategia cache-first: responde desde el cache (instantáneo, funciona sin
// internet) y solo va a la red si el archivo no está guardado. Lo que traiga
// de la red lo guarda para la próxima vez.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return; // solo cacheamos lecturas

  e.respondWith(
    // en navegaciones se ignora el query (?tab=...): los atajos del ícono
    // deben servir el mismo index.html cacheado aunque no haya internet
    caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate' }).then((cached) => {
      if (cached) return cached;

      return fetch(e.request).then((res) => {
        // guarda copia SOLO si la respuesta fue exitosa (res.ok) y es de
        // nuestro propio origen — jamás inmortalizar un 404 en el cache
        if (res.ok && e.request.url.startsWith(self.location.origin)) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(e.request, copy));
        }
        return res;
      }).catch(() => {
        // sin internet y no está en cache: si es navegación, sirve la app
        if (e.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
