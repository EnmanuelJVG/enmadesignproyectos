/* Service worker: permite abrir la app sin internet y, cuando hay internet, SIEMPRE usa la versión publicada
   (así el icono del iPhone no se queda con archivos viejos).
   Si cambias archivos de la app, sube el número de VERSION aquí y APP_BUILD en js/core.js (deben coincidir). */
const VERSION = 'enma-studio-v3';
const CORE = ['./', 'index.html', 'css/styles.css', 'js/core.js', 'js/ui.js', 'js/views.js', 'js/views2.js', 'js/forms.js', 'js/extras.js',
  'js/firebase-config.js', 'js/cloud-firebase.js', 'js/sync.js', 'js/app.js',
  'manifest.webmanifest', 'assets/isotipo-blanco.png', 'assets/isotipo-negro.png', 'assets/logo-blanco.png', 'assets/logo-negro.png',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon-32.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(cs => cs.forEach(c => c.postMessage({ type: 'sw-activated', version: VERSION })))
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const fonts = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  const fbsdk = url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0;   // librería de Firebase (la versión va en la URL)
  if (!sameOrigin && !fonts && !fbsdk) return;

  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const critical = sameOrigin && (req.mode === 'navigate' || /\.(html?|js|css|webmanifest)$/.test(url.pathname));

    /* Páginas, scripts y estilos: primero la red (versión nueva); si no hay internet, la copia guardada. */
    if (critical) {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        if (fresh && fresh.ok) { cache.put(req, fresh.clone()); return fresh; }
        if (hit) return hit;
        if (req.mode === 'navigate') return (await cache.match('index.html')) || fresh;
        return fresh;
      } catch (_) {
        if (hit) return hit;
        if (req.mode === 'navigate') return cache.match('index.html');
        return new Response('', { status: 504, statusText: 'Sin conexión' });
      }
    }

    /* Imágenes, iconos, tipografías y la librería de Firebase: primero lo guardado; en segundo plano se renueva. */
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    return res || new Response('', { status: 504, statusText: 'Sin conexión' });
  }));
});
