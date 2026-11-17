# Hierro en Google Play y App Store

Plan para publicar Hierro en las tiendas sin dejar de ser una web: la app de las tiendas abre la misma web de GitHub Pages, así que **cada versión nueva llega sola** (no hay que volver a enviarla a revisión salvo que cambie la parte nativa).

## Android (Google Play) — preparado

- **Cómo es**: una TWA (Trusted Web Activity) generada con Bubblewrap. Es Chrome a pantalla completa abriendo `https://guillemarmu.github.io/hierro/hierro-pwa/`, con el icono y la pantalla de inicio de Hierro. Funcionan igual que en la web el inicio de sesión, App Check, la cámara, los avisos push y el modo sin conexión.
- **Paquete**: `io.github.guillemarmu.hierro`. Versión = `APP_VERSION`; código de versión = 100 + número de ejecución del workflow, o el que se ponga a mano al lanzarlo (campo «codigo»). Ojo: si se renombra o se recrea `android.yml`, el número de ejecución vuelve a empezar y hay que poner a mano un código mayor que el último subido (Play rechaza uno menor).
- **Archivos**: `tiendas/android/twa-manifest.json` (configuración) y `tiendas/android/generar.mjs` (genera el proyecto Android con `@bubblewrap/core`, sin preguntas). El proyecto generado no se guarda en el repo.
- **Compilar**: GitHub › Actions › **Android** › Run workflow (también se lanza solo al cambiar `tiendas/android/`). Deja en «Artifacts» un `.aab` (para Google Play) y un `.apk` (para instalar a mano), y en el resumen la huella SHA-256 de la clave.
- **Clave de firma**: sin secretos, el workflow usa una clave de prueba de usar y tirar (solo sirve para comprobar que compila). Para subir a Play hace falta la **clave de subida** guardada como secretos del repo `ANDROID_KEYSTORE_B64` (el `.keystore` en base64) y `ANDROID_KEYSTORE_PASS`. La clave tiene que tener el alias `hierro` y la misma contraseña para el almacén y para la clave. Los secretos solo los puede poner el dueño del repo (guillemarmu) en Settings › Secrets and variables › Actions. **Hay que guardar una copia del `.keystore` y su contraseña fuera de GitHub**: si se pierde, Google permite cambiar la clave de subida, pero es un engorro.
- **Verificar el dominio** (sin esto, la app enseña una barra con la dirección arriba): crear el repo **`guillemarmu.github.io`** (público) con dos archivos:
  - `.nojekyll` (vacío; si no, GitHub Pages no publica la carpeta `.well-known`).
  - `.well-known/assetlinks.json` con las huellas SHA-256 de la **clave de firma de Google Play** (Play Console › Configuración › Integridad de la app) y de la clave de subida. El workflow deja un `assetlinks-clave-de-subida.json` de ejemplo.
- **Probar**: el `.apk` se instala en cualquier Android (permitir «orígenes desconocidos»).

## Antes de enviar a las tiendas

- **Borrado completo de la cuenta** (versión de la app): que «Eliminar mi cuenta y mis datos» borre también los comentarios en publicaciones ajenas, los mensajes de los muros de piques y alianzas, los «me gusta», los `users/{uid}/state/diag-*`, las solicitudes (`freqs`) y los bloqueos (`blocks`). Google pide declarar con exactitud qué se borra; hoy `soporte.html` dice lo que queda.
- **Privacidad y condiciones**: quitar la nota «borrador pendiente de revisión» cuando estén revisadas.
- **Capturas** y **cuenta de prueba** para los revisores (ver `ficha.md`).

## iOS (App Store) — por hacer, cuando haya cuenta de Apple

- **Cómo será**: Capacitor cargando la web publicada (`server.url`), así las peticiones salen desde `guillemarmu.github.io` y siguen valiendo la clave de API y reCAPTCHA tal como están. Con `WKAppBoundDomains` para que funcione el service worker (sin conexión).
- **Para pasar la norma 4.2 de Apple** (no aceptan «una web metida en una app») hay que añadir cosas nativas: avisos push nativos (el push web no funciona dentro de una app de iOS; el Worker de Cloudflare tendría que mandar también a APNs), guardar los entrenos en Salud, vibración nativa y, más adelante, el descanso en la pantalla de bloqueo.
- **Compilar sin Mac**: GitHub Actions con macOS (gratis en repos públicos) + fastlane, firmando con una clave de la API de App Store Connect guardada como secreto.
- **Para revisión**: Apple necesita una cuenta de prueba con datos (ver `ficha.md`).

## Lo que tiene que hacer Guillermo

1. **Google Play Console** (25 $ una vez, cuenta personal): identidad con el DNI y **verificar con un móvil Android de verdad** (Android 10 o más) usando la app Play Console. Si no tienes Android, pide uno prestado un rato.
2. **Repo `guillemarmu.github.io`** (público, vacío) y añadir a GuilleDitay de colaborador para que Claude suba los dos archivos.
3. **Clave de subida**: Claude la genera y te la pasa; tú la guardas en un sitio seguro y la pones como secretos del repo.
4. **12 testers con Android** durante 14 días seguidos en la prueba cerrada (sus correos de Google).
5. **Apple Developer** (99 €/año, persona física) cuando vayamos a por iOS.
6. **Cuenta de prueba para los revisores** (Apple y Google): una cuenta de Hierro con algunos entrenos; Claude no crea cuentas ni escribe contraseñas.
