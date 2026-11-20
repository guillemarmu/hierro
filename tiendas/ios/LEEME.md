# Hierro para iOS (App Store)

App de iOS hecha con **Capacitor 8** (SPM, `App.xcodeproj`) que carga la web publicada (`server.url` = `https://guillemarmu.github.io/hierro/hierro-pwa/`). Así cada versión de la web llega sola; solo hay que reenviar a Apple si cambia la parte nativa.

Para no ser «una web metida en una app» (norma 4.2 de Apple) añade cosas nativas:

- **Salud**: guarda en Apple Salud los entrenos de fuerza terminados (plugin propio `plugins/hierro-health`, Swift + HealthKit, `HKWorkoutBuilder`, tipo `traditionalStrengthTraining`). Solo escribe el entreno (inicio, fin y nombre), no lee nada ni guarda calorías. Ningún plugin de npm guarda workouts (`@capgo/capacitor-health` los trata como solo lectura), por eso es local.
- **Vibración nativa** (`@capacitor/haptics`) en lugar de `navigator.vibrate`, que iOS no tiene.

El push nativo **no está incluido todavía** (ver «Qué falta»).

El puente entre la web y lo nativo es `hierro-pwa/native.js`: no hace nada fuera de la app. Contrato:

- Evento que lanza la web al terminar un entreno: `window.dispatchEvent(new CustomEvent('hierro:workout-saved', {detail: {start: ms, end: ms, name: 'Pecho'}}))`. Solo se guarda en Salud si `localStorage['hierro.health'] === '1'`.
- `window.Native = {is: true, platform: 'ios', health: {available(), enable(), disable()}}`. `enable()` pide el permiso de Salud y guarda la preferencia.
- Con `server.url` remoto iOS solo inyecta `native-bridge.js`, así que `native.js` lee los plugins de `Capacitor.Plugins[jsName]` (no existe `registerPlugin`).
- El user agent lleva `HierroiOS` (`appendUserAgent`).

## Archivos

| Archivo | Qué es |
|---|---|
| `package.json` | Capacitor 8.6.2, Haptics 8.0.2 y el plugin local (versiones exactas; sin `package-lock.json`, que no se puede subir cómodamente con el editor web) |
| `capacitor.config.json` | appId `io.github.guillemarmu.hierro`, URL remota, dominios, `contentInset: never` |
| `www/index.html` | Página mínima que redirige (Capacitor exige una carpeta web) |
| `plugins/hierro-health/` | Plugin Swift de Salud (`isAvailable`, `requestAuthorization`, `saveWorkout`) |
| `App.entitlements` | HealthKit y solo HealthKit |
| `preparar.sh` | Crea y parchea el proyecto de Xcode (solo macOS) |

La carpeta `ios/` que genera Capacitor **no se guarda** en el repo (`.gitignore`): se crea siempre con `preparar.sh`.

## Compilar (sin Mac, sin cuenta de Apple)

GitHub › Actions › **iOS** › Run workflow (también se lanza al cambiar `tiendas/ios/`). Ejecuta `preparar.sh` y `xcodebuild … -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build`. Solo comprueba que compila; no genera `.ipa` ni sirve para instalar en un iPhone.

`preparar.sh` hace: `npm install` (o `npm ci` si hay `package-lock.json`), `npx cap add ios` (si no existe), `npx cap sync ios`, parchea `Info.plist` con PlistBuddy, copia `App.entitlements` y lo enlaza con `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` en el proyecto, y copia `assets/icon-1024.png` (1024 px, opaco) como icono de la app. Si el enlace de entitlements diera problemas al compilar sin firmar, `SIN_ENTITLEMENTS=1 ./preparar.sh` lo salta; al firmar de verdad hay que quitar esa variable.

## Permisos (texto exacto de `Info.plist`)

| Clave | Texto |
|---|---|
| `NSCameraUsageDescription` | Hierro usa la cámara para la foto doble (trasera y frontal) que acompaña a un entreno cuando decides publicarlo. Sin permiso puedes seguir entrenando, solo que sin publicar. |
| `NSHealthUpdateUsageDescription` | Hierro guarda en Salud los entrenos de fuerza que terminas, con su hora de inicio y de fin, solo si lo activas en los ajustes de la app. Puedes desactivarlo cuando quieras. |
| `NSHealthShareUsageDescription` | Hierro no lee ningún dato de Salud: solo escribe los entrenos de fuerza que terminas, y únicamente si lo activas en los ajustes de la app. |

Otros ajustes: sin modos en segundo plano (Apple rechaza los que no se usan, norma 2.5.4); orientación solo vertical en iPhone; `WKAppBoundDomains` = `guillemarmu.github.io`; `ITSAppUsesNonExemptEncryption` = false; idioma `es`.

Para App Review: la interfaz de la app tiene que ofrecer el interruptor de Salud (llamando a `Native.health.enable()`) y explicar para qué se usa; la política de privacidad debe mencionar Salud y la cámara.

## Cuenta de Apple Developer (activa desde el 20 nov 2026)

- Persona física «Guillermo Martín Muñoz», **Team ID `P8TDPVJAT8`**.
- **App ID** `io.github.guillemarmu.hierro` registrado con **HealthKit** (y la compra dentro de la app que Apple pone siempre).
- **App en App Store Connect**: «Hierro», iOS, español (España), SKU `hierro-ios`, acceso ilimitado de usuarios.
- **Clave de la API** «GitHub Actions» (función Administración): Key ID `U85TUDM496`, Issuer ID `8a7cb5bd-8ca6-4805-b3fe-e4a834e90684`. El `.p8` solo se descarga una vez: lo guarda Guillermo fuera de GitHub.

### Subir a TestFlight

1. Secretos del repo (Settings › Secrets and variables › Actions; solo puede guillemarmu): `ASC_KEY_ID` = `U85TUDM496`, `ASC_ISSUER_ID` = `8a7cb5bd-8ca6-4805-b3fe-e4a834e90684` y `ASC_KEY_P8` = el contenido entero del `.p8` (con las líneas BEGIN/END).
2. Actions › **iOS TestFlight** › Run workflow (`.github/workflows/ios-testflight.yml`). Prepara el proyecto, archiva en Release con **firma automática** (`-allowProvisioningUpdates` + la clave de la API; Xcode crea solo el certificado de distribución y el perfil) y sube el `.ipa` a App Store Connect con `xcodebuild -exportArchive` (`destination` = `upload`).
3. Versión = `APP_VERSION`; compilación = 100 + número de ejecución (o el manual, que tiene que ser mayor que el último subido).
4. A los 10-30 min sale en TestFlight. Para probarla: App Store Connect › Hierro › TestFlight › añadir probadores internos (tu Apple ID) y la app TestFlight en el iPhone.

3. **Push nativo (siguiente paso)**: se ha quitado hasta que el Worker pueda enviar a APNs. Hará falta: clave APNs (`.p8`) como secreto del Worker de Cloudflare (`hierro-avisos`); que el Worker envíe a APNs (JWT ES256, `api.push.apple.com`, topic = appId) y guarde los tokens; volver a añadir `@capacitor/push-notifications`, `UIBackgroundModes` = `remote-notification` y `aps-environment` en `App.entitlements`; la capacidad Push en el App ID; y `Native.push.token()` en `native.js`.
4. **Capturas** de iPhone, ficha, cuenta de prueba para los revisores (ver `../ficha.md`) y política de privacidad actualizada.
5. **Mejora futura**: Live Activity del descanso en la pantalla de bloqueo (ActivityKit + extensión de widget; requiere Xcode/Swift y notificaciones push de Live Activity).

## Sin verificar

No hay macOS aquí: la compilación real (SPM, plugin Swift, entitlements, PlistBuddy) solo se ve en Actions. Puntos a vigilar en el primer run: que `xcodebuild` resuelva el paquete local `HierroHealth`, que `limitsNavigationsToAppBoundDomains` no bloquee reCAPTCHA/Firebase (solo los dominios de la lista pueden usar el service worker y la inyección de scripts; el resto de iframes cargan sin ellos) y el icono (`assets/icon-1024.png` es opaco y de 1024 px; sale de `hierro-pwa/icons/favicon.svg` sin esquinas redondeadas).
