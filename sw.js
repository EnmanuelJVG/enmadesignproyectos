/* Service worker: guarda la app para abrirla sin internet. Si cambias archivos, sube el número de VERSION. */
const VERSION = 'enma-studio-v5-etag-retry';
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
  /* No guardar respuestas privadas de las funciones API en la caché local. */
  if (sameOrigin && url.pathname.startsWith('/api/')) return;
  /* Primero lo guardado (rápido y sin internet); en segundo plano se actualiza. */
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (req.mode === 'navigate') return cache.match('index.html');
    return new Response('', { status: 504, statusText: 'Sin conexión' });
  }));
});
