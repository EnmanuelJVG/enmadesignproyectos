/* Service worker: guarda la app para abrirla sin internet. Si cambias archivos, sube el número de VERSION. */
const VERSION = 'enma-studio-v6-iphone-sync';
const CORE = ['./', 'index.html', 'css/styles.css', 'js/core.js', 'js/ui.js', 'js/views.js', 'js/views2.js', 'js/forms.js', 'js/cloud-vercel.js', 'js/sync.js', 'js/app.js',
  'manifest.webmanifest', 'assets/isotipo-blanco.png', 'assets/isotipo-negro.png', 'assets/logo-blanco.png', 'assets/logo-negro.png',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon-32.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const fonts = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !fonts) return;
  /* Nunca guardar respuestas privadas ni sesiones de las funciones API. */
  if (sameOrigin && url.pathname.startsWith('/api/')) return;

  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const critical = sameOrigin && (
      req.mode === 'navigate' || /\.(html?|js|css|webmanifest)$/.test(url.pathname)
    );

    /*
     * HTML, JavaScript y CSS usan network-first: cuando hay conexión, el icono
     * de inicio recibe la versión publicada y no se queda ejecutando scripts
     * antiguos. Si no hay internet, se utiliza la copia local.
     */
    if (critical) {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        if (fresh && fresh.ok) {
          await cache.put(req, fresh.clone());
          return fresh;
        }
        if (hit) return hit;
        if (req.mode === 'navigate') return (await cache.match('index.html')) || fresh;
        return fresh;
      } catch (_) {
        if (hit) return hit;
        if (req.mode === 'navigate') return cache.match('index.html');
        return new Response('', { status: 504, statusText: 'Sin conexión' });
      }
    }

    /* Recursos pesados (iconos, imágenes y fuentes): caché primero. */
    if (hit) return hit;
    try {
      const fresh = await fetch(req);
      if (fresh && (fresh.ok || fresh.type === 'opaque')) await cache.put(req, fresh.clone());
      return fresh;
    } catch (_) {
      return new Response('', { status: 504, statusText: 'Sin conexión' });
    }
  }));
});
