#!/usr/bin/env bash
# Prepara el proyecto de iOS de Hierro a partir de esta carpeta (hace falta macOS por PlistBuddy y sips).
# Uso: cd tiendas/ios && ./preparar.sh
# Crea ios/ con Capacitor si no existe, sincroniza los plugins y deja Info.plist, entitlements e icono listos.
# Variables: SIN_ENTITLEMENTS=1 no enlaza App.entitlements (por si estorbara al compilar sin firmar).
set -euo pipefail
cd "$(dirname "$0")"

PB=/usr/libexec/PlistBuddy
[ -x "$PB" ] || { echo "Falta PlistBuddy: este script solo funciona en macOS." >&2; exit 1; }

if [ -f package-lock.json ]; then npm ci; else npm install; fi
[ -d ios ] || npx cap add ios
npx cap sync ios

APP=ios/App
PLIST="$APP/App/Info.plist"
[ -f "$PLIST" ] || { echo "No existe $PLIST: algo ha fallado en 'cap add ios'." >&2; exit 1; }

# Borra una clave si existe y la vuelve a crear (así el script se puede repetir)
poner() { # poner <clave> <tipo> [valor]
  "$PB" -c "Delete :$1" "$PLIST" >/dev/null 2>&1 || true
  if [ $# -ge 3 ]; then "$PB" -c "Add :$1 $2 $3" "$PLIST"; else "$PB" -c "Add :$1 $2" "$PLIST"; fi
}
lista() { # lista <clave> <elemento>...
  local clave="$1"; shift
  poner "$clave" array
  local i=0 e
  for e in "$@"; do "$PB" -c "Add :$clave:$i string $e" "$PLIST"; i=$((i + 1)); done
}

poner CFBundleDisplayName string Hierro
poner CFBundleDevelopmentRegion string es
lista CFBundleLocalizations es
lista WKAppBoundDomains guillemarmu.github.io
lista UISupportedInterfaceOrientations UIInterfaceOrientationPortrait
poner ITSAppUsesNonExemptEncryption bool false

poner NSCameraUsageDescription string "Hierro usa la cámara para la foto doble (trasera y frontal) que acompaña a un entreno cuando decides publicarlo. Sin permiso puedes seguir entrenando, solo que sin publicar."
poner NSHealthUpdateUsageDescription string "Hierro guarda en Salud los entrenos de fuerza que terminas, con su hora de inicio y de fin, solo si lo activas en los ajustes de la app. Puedes desactivarlo cuando quieras."
poner NSHealthShareUsageDescription string "Hierro no lee ningún dato de Salud: solo escribe los entrenos de fuerza que terminas, y únicamente si lo activas en los ajustes de la app."

# Entitlements (HealthKit). Sin firmar no se aplican, pero dejan el proyecto listo.
if [ "${SIN_ENTITLEMENTS:-0}" != 1 ]; then
  cp App.entitlements "$APP/App/App.entitlements"
  PBX="$APP/App.xcodeproj/project.pbxproj"
  if ! grep -q 'CODE_SIGN_ENTITLEMENTS' "$PBX"; then
    perl -0pi -e 's/(\t+)(PRODUCT_BUNDLE_IDENTIFIER = [^;]+;)/$1CODE_SIGN_ENTITLEMENTS = App\/App.entitlements;\n$1$2/g' "$PBX"
  fi
  grep -q 'CODE_SIGN_ENTITLEMENTS = App/App.entitlements' "$PBX" || { echo "No se pudo enlazar App.entitlements." >&2; exit 1; }
fi

# Live Activity: entreno en curso en la pantalla de bloqueo y la Dynamic Island.
# La app declara que usa Live Activities y se le añade la extensión de widget de live/ (gema xcodeproj de CocoaPods).
poner NSSupportsLiveActivities bool true
ruby -rxcodeproj -e1 2>/dev/null || gem install xcodeproj --no-document
ruby live/anadir.rb "$APP/App.xcodeproj"

# Icono: assets/icon-1024.png (1024 px, sin canal alfa y con el fondo de la marca, como exige la tienda)
ICONO="$APP/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
if [ -f assets/icon-1024.png ] && [ -d "$(dirname "$ICONO")" ]; then
  cp assets/icon-1024.png "$ICONO"
fi

# Solo iPhone (21 nov): sin capturas de iPad en la ficha y sin Salud en iPad (HealthKit no existe allí)
PBX="$APP/App.xcodeproj/project.pbxproj"
perl -pi -e 's/TARGETED_DEVICE_FAMILY = "?1,2"?;/TARGETED_DEVICE_FAMILY = 1;/g' "$PBX"
grep -q 'TARGETED_DEVICE_FAMILY = "\?1,2' "$PBX" && { echo "No se pudo dejar la app solo para iPhone." >&2; exit 1; }
grep -q 'TARGETED_DEVICE_FAMILY = 1;' "$PBX" || { echo "No encuentro TARGETED_DEVICE_FAMILY en el proyecto." >&2; exit 1; }

echo "Listo: proyecto en tiendas/ios/$APP"
