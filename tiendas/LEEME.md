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

- **Borrado completo de la cuenta**: hecho en la versión 4.13.2. «Eliminar mi cuenta y mis datos» borra también los comentarios en publicaciones ajenas, los mensajes de los muros, los «me gusta», los avisos enviados, los `diag-*`, las solicitudes (`freqs`) y los bloqueos (`blocks`). Necesita las reglas nuevas de Firestore y los índices de abajo (ya publicados); si faltaran, la app avisa y ofrece «Borrar igualmente». `soporte.html#borrar-cuenta` ya lo dice.
- **Privacidad y condiciones**: quitar la nota «borrador pendiente de revisión» cuando estén revisadas.
- **Capturas** y **cuenta de prueba** para los revisores (ver `ficha.md`). Para llenar la cuenta de prueba: `revisores-hevy.csv` (8 semanas inventadas, 24 entrenos; está en el proyecto «HIERRO» de Claude) se importa en Perfil › Tus datos › «Importar entrenos (CSV)».

### Índices de Firestore para el borrado completo (ya creados)
- Grupo de colección, de un campo (Firestore › Índices › De un solo campo › Agregar exención, con «Grupo de colecciones» activado, ascendente): `comments.uid`, `msgs.uid` e `items.from`.
- Compuestos de `posts`: `aud` ↑ + `likes` (array-contains) y `uid` ↑ + `likes` (array-contains).

## Los 5 motivos más frecuentes de rechazo de Apple (TikTok de @lacaveapps, 19 nov)

| Motivo | Estado en Hierro |
|---|---|
| 1. Sin acceso de prueba o la app falla | Pendiente: la cuenta la crea Guillermo; datos en `revisores-hevy.csv` (proyecto «HIERRO»). Probar la app de iOS en TestFlight antes de enviar. |
| 2. Cobrar productos digitales fuera de Apple | No aplica: Hierro no tiene pagos. |
| 3. App que es una copia de la web (norma 4.2) | Preparado: Salud (guardar entrenos) y vibración nativa. Siguiente paso, con la cuenta de Apple: avisos push nativos (el Worker tiene que mandar a APNs con la clave .p8). Ver `ios/LEEME.md`. Mejora futura: el descanso en la pantalla de bloqueo. |
| 4. Pedir permisos sin explicar para qué | Preparado: textos de cámara y Salud en `ios/preparar.sh` (tabla en `ios/LEEME.md`). La cámara solo se pide al publicar y Salud solo al activar el interruptor. En la app de iOS no salen los avisos web, que ahí no funcionan. |
| 5. Que falte bloquear o denunciar usuarios | Hecho desde la 4.9: denunciar publicaciones, comentarios y perfiles, bloquear y panel de administrador. Las denuncias se atienden a mano desde soporte.hierro.app@gmail.com. |
| Extra: borrar la cuenta desde la app | Hecho (ver arriba). |

## iOS (App Store) — preparado para compilar; falta la cuenta de Apple

- **Cómo es**: Capacitor 8 cargando la web publicada (`server.url`), así las peticiones salen desde `guillemarmu.github.io` y siguen valiendo la clave de API y reCAPTCHA. Con `WKAppBoundDomains` para que funcione el service worker. Todo en `tiendas/ios/` (ver su `LEEME.md`).
- **Nativo (norma 4.2)**: guardar los entrenos en Salud (interruptor en Perfil › Ajustes, solo en la app), vibración nativa; el push nativo es el siguiente paso. La web habla con lo nativo a través de `hierro-pwa/native.js`, que fuera de la app no hace nada.
- **Compilar sin Mac**: GitHub › Actions › **iOS** compila para el simulador sin firmar (comprueba que compila). Con cuenta de Apple: firmar con una clave de la API de App Store Connect + fastlane, capacidad HealthKit en el App ID y, para el push, capacidad Push y clave APNs .p8 para el Worker.
- **Para revisión**: cuenta de prueba con datos (ver `ficha.md`).

## Lo que tiene que hacer Guillermo

1. **Google Play Console** (25 $ una vez, cuenta personal): identidad con el DNI y **verificar con un móvil Android de verdad** (Android 10 o más) usando la app Play Console. Si no tienes Android, pide uno prestado un rato.
2. **Repo `guillemarmu.github.io`** (público, vacío) y añadir a GuilleDitay de colaborador para que Claude suba los dos archivos.
3. **Clave de subida**: Claude la genera y te la pasa; tú la guardas en un sitio seguro y la pones como secretos del repo.
4. **12 testers con Android** durante 14 días seguidos en la prueba cerrada (sus correos de Google).
5. **Apple Developer** (99 €/año, persona física) cuando vayamos a por iOS.
6. **Cuenta de prueba para los revisores** (Apple y Google): una cuenta de Hierro con algunos entrenos; Claude no crea cuentas ni escribe contraseñas.
