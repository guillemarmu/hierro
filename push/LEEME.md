# Servidor de avisos (Cloudflare Worker `hierro-avisos`)

El código completo desplegado se lee del panel de Cloudflare (Workers › hierro-avisos) o por la API
`GET /accounts/<id>/workers/scripts/hierro-avisos/content/v2` (multipart con `worker.js`).

Piezas de la versión de avisos sociales (24 nov 2026, con la app 4.25.0):
- `social-part.js`: se añade al final de `worker.js`. Verifica la sesión de Firebase, comprueba en Firestore que el aviso
  es real, guarda los aparatos (APNs y Web Push) y manda a APNs (clave «Hierro APNs», Key ID `SC2Y29588J`, equipo `P8TDPVJAT8`).
- `coach-part.js`: rutas nuevas dentro de `Coach.fetch` (`/rl`, `/dev/reg`, `/dev/off`, `/notify`).
- En `worker.js` además: el router acepta `/dev/reg`, `/dev/off` y `/notify` (→ `socialRoute`); `/coach` acepta `apns`
  en vez de `sub`; el Coach manda con `sendAny` (web o APNs).
- Secreto `APNS_P8` (contenido del `.p8`, lo pone Guillermo). Sin él, todo funciona menos el envío a iOS.
