/* Hierro · service worker: guarda la app en el móvil para que abra sin conexión.
   Al publicar una versión nueva, cambia VERSION para que los móviles la descarguen. */
const VERSION = 'hierro-4.5.11';
const PHOTOS = 'hierro-fotos'; // fotos de ejercicios: se guardan al verlas y no se borran al actualizar
const FONTS = 'hierro-fuentes'; // tipografías de Google Fonts (Sora y Plus Jakarta Sans): se guardan la primera vez y funcionan sin conexión
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon.svg', './config.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, {cache: 'reload'})))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== PHOTOS && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
// Aviso del servidor (descanso terminado con la pantalla bloqueada o la app cerrada)
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) {}
  // quita el aviso fijo «Descanso · termina a las…» que se puso al bloquear el móvil
  if (!d.tag || d.tag === 'hierro-descanso') e.waitUntil(self.registration.getNotifications({tag: 'hierro-rest'}).then(ns => ns.forEach(n => n.close())).catch(() => {}));
  e.waitUntil(self.registration.showNotification(d.title || '¡Descanso terminado!', {body: d.body || 'A por la siguiente serie', tag: d.tag || 'hierro-descanso', renotify: true, silent: false, vibrate: [300, 120, 300, 120, 400], icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: {url: self.registration.scope}}));
});
// Al tocar el aviso del descanso, vuelve a la app (o la abre)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(cs => {
    const c = cs.find(x => x.url.startsWith(self.registration.scope));
    return c ? c.focus() : self.clients.openWindow((e.notification.data && e.notification.data.url) || './');
  }));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/free-exercise-db/')) {
    e.respondWith(caches.open(PHOTOS).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }))));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    // primero lo guardado; la hoja de estilos (googleapis) se refresca por detrás
    e.respondWith(caches.open(FONTS).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; });
      if (hit) { net.catch(() => {}); return hit; }
      return net;
    })));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // La app: primero lo guardado (abre al instante y sin cobertura), si no, la red
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then(hit => hit || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req)));
});
