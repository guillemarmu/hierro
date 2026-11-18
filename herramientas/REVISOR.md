# Hierro · revisor anti-slop

Instrucciones para el **agente revisor** que mira cada versión antes de publicarla. El revisor no ha escrito el código: no lo arregla, lo **aprueba o lo rechaza**. Si rechaza, la sesión principal corrige y vuelve a pedir revisión. No se publica una versión rechazada.

## Cómo se lanza (desde la sesión principal)
1. `node herramientas/calidad.mjs` y `node herramientas/visual.mjs` tienen que dar **✓ PASA**. Si no, ni se pide revisión.
2. Sacar el diff contra `origin/main`: `git diff origin/main -- hierro-pwa/ > /tmp/rev.diff`.
3. Lanzar un agente nuevo (modelo Opus; nunca Fable) con este archivo, el diff, la salida de `calidad.mjs` y `visual.mjs`, la carpeta de capturas (`/tmp/hierro-visual`, con `informe.json`) y una línea de qué pidió Guillermo. Darle acceso de lectura al repo para mirar el contexto de cada cambio.
   - Si la versión toca la interfaz, el revisor **mira las capturas** de las pantallas afectadas (claro y oscuro; a 390 px y, si hay dudas, a 360) y aplica también las reglas V1…V10. Si no la toca, basta con que `visual.mjs` pase.
4. Si dice **RECHAZADO**, arreglar lo que diga y repetir desde el paso 1 (como mucho 3 vueltas; si sigue rechazando, contárselo a Guillermo).

## Qué devuelve
La primera línea es `APROBADO` o `RECHAZADO`. Después, una lista de hallazgos, cada uno con: regla (R1…R20 o V1…V10), archivo y línea (o captura), qué pasa en concreto y qué cambiar. Nada de «considera revisar»: si no puede señalar un fallo concreto, no lo pone. Un solo hallazgo **grave** basta para rechazar; los **leves** se apuntan pero no rechazan.

## Las 20 reglas

**Graves (rechazan)**
- **R1 · Hace lo que se pidió.** El cambio resuelve lo que pidió Guillermo, entero, y nada más. Funciones a medias, botones que no hacen nada o cosas «para más adelante» rechazan.
- **R2 · Nada de trampas para las pruebas.** Prohibido: tocar una prueba para que pase en vez de arreglar el código, `if` especiales para el entorno de pruebas, resultados escritos a mano, datos de ejemplo que se cuelan en producción.
- **R3 · Nada de código de relleno.** Funciones que devuelven un valor fijo, `catch` que se tragan el error sin motivo, «simulaciones» o «de momento» que se quedan en el código.
- **R4 · Texto de usuario siempre escapado.** Todo lo que viene de la nube o de otra persona (nombres, @, bio, títulos, notas, comentarios, mensajes) entra en HTML solo con `esc()`; fotos solo con `safePhoto()`/`phUrlOk()`; ids en selectores o rutas con `SAFE_DOC_ID`.
- **R5 · Reglas de Firestore.** Si cambia `firestore.rules`: nadie puede leer o escribir lo de otro sin causa, listas cerradas de campos, sin `if true`. Y la app no puede depender de una regla que no se ha publicado (avisar a Guillermo; publicar necesita su permiso).
- **R6 · No rompe a los que no han actualizado.** Datos nuevos compatibles con versiones viejas (campos opcionales, lecturas que toleran lo que falta). Ver el ejemplo de `aud` en 4.11.
- **R7 · No pierde datos.** Migraciones idempotentes, nada que borre o sobrescriba entrenos, rutinas o ajustes sin querer; la sincronización no reenvía en bucle.
- **R8 · Versión coherente.** `APP_VERSION` y `VERSION` de sw.js suben juntas al siguiente número libre de `origin/main`; archivos nuevos que deban ir sin conexión, en `CORE` o `EXTRA`.
- **R9 · Sin restos.** `console.log`, `debugger`, código comentado, marcas TODO, funciones o acciones `A[...]` que se quedan sin usar tras el cambio, CSS de clases que ya no existen.
- **R10 · Sin duplicar.** Si ya existe una función que hace lo mismo (`fmtDate`, `esc`, `modal`, `toast`, `navTo`, `Cloud.fs`, `Social.*`…), se usa; nada de copiar y pegar otra versión parecida.

**Leves (se apuntan)**
- **R11 · Encaja en la arquitectura.** Acciones por `data-act` + `A`, pantallas por `navTo`/`go`, estado en `S`/`UI`, guardado por `Store`/`Sync`. Nada de `onclick` sueltos ni estados paralelos.
- **R12 · Tamaño.** Una función nueva que pase de ~80 líneas o ~4000 caracteres se parte en piezas con nombre (el trinquete R01/R02 lo vigila).
- **R13 · Nombres claros.** Nombres que dicen qué hacen; los cortos (`ED`, `S`, `UI`) solo los que ya existen.
- **R14 · Comentarios útiles.** Explican el porqué («iPhone no deja abrir las dos cámaras a la vez»), no repiten el código. Los de versión (`4.12.1: …`) solo donde ayudan a entender un caso raro.
- **R15 · Errores visibles.** Si algo falla, el usuario lo ve con un `toast` claro en español, no se queda colgado; sin red, la app sigue funcionando.
- **R16 · Móvil primero.** Se ve bien a 360 px y en el iPhone (zona segura, teclado, `kbFit`), objetivos táctiles de 40 px o más, respeta «reducir movimiento».
- **R17 · Coste.** No multiplica lecturas de Firestore (cuota del plan Spark), ni evaluaciones de reCAPTCHA, ni el peso de `index.html` sin motivo.
- **R18 · CSS ordenado.** Variables de tema (`--…`) en vez de colores fijos, sin `!important` nuevos, reglas nuevas en el bloque «Pulido de diseño» y acotadas (ojo con `.hd`).
- **R19 · Textos.** Español de España, tono de la app, sin anglicismos innecesarios ni textos de ejemplo («Lorem», «Test»).
- **R20 · Pruebas de verdad.** Hay una prueba nueva (`tXXX.js`) que comprueba lo que se ha hecho en el navegador, incluido al menos un caso que falla si se quita el arreglo.

## Reglas de interfaz (V1…V10, se miran en las capturas)
Inspiradas en las guías de interfaz web de Vercel y en el estilo propio de Hierro (Glaciar en claro, Aurora en oscuro). `visual.mjs` mide lo que se puede medir (desbordes, texto cortado, objetivos táctiles, contraste, nombres accesibles, solapes, `alt`, errores); el contraste es aproximado (no ve pseudoelementos ni el cristal), así que **manda lo que se ve en la captura**.

**Graves (rechazan)**
- **V1 · Nada roto a la vista.** Nada se sale de la pantalla, se corta a medias o se monta encima de otra cosa; los textos largos (nombres de ejercicio o de entreno) hacen salto de línea o «…».
- **V2 · Se lee.** Texto normal con contraste 4,5:1 o más; texto grande o en negrita de 19 px o más, 3:1. En los dos temas. Nada de gris claro sobre cristal claro.
- **V3 · Se puede tocar.** Botones y controles de 40 px o más (44 ideal), separados lo suficiente para no tocar el de al lado; lo importante, al alcance del pulgar.
- **V4 · Los dos temas.** Lo nuevo se ve bien en claro y en oscuro: nada de colores fijos que solo funcionan en uno, iconos visibles en los dos.
- **V5 · Accesible.** Todo botón o campo tiene nombre (texto, `aria-label` o `<label>`); imágenes con `alt`; estado activo/pulsado con `aria-pressed`/`aria-current`; foco visible al navegar con teclado.

**Leves (se apuntan)**
- **V6 · Coherente con Hierro.** Usa las piezas que ya existen (`.card`, `.btn`, `.chip`, `.seg`, `.pill`, `EI()` para vacíos), las variables del tema y las tipografías (Sora en títulos, Plus Jakarta Sans en texto). Nada que parezca de otra app ni plantilla genérica.
- **V7 · Jerarquía clara.** Una acción principal por pantalla (`.btn.primary`); títulos, cifras y textos secundarios con tamaños que se distinguen; alineaciones y márgenes consistentes (múltiplos de 4 px).
- **V8 · Estados completos.** Vacío (qué hacer ahora), cargando (sin saltos de diseño al llegar los datos), error (qué ha pasado y cómo seguir) y desactivado.
- **V9 · Movimiento con cabeza.** Animaciones cortas (≤300 ms) que explican algo; con «reducir movimiento», sin animación.
- **V10 · Números y textos.** Cifras con formato español (`12,5 kg`; punto de miles desde 5 cifras, `12.500`, y sin punto en 4 como pide la RAE: `8505`), unidades siempre separadas con espacio duro (`5 %`, `30 t`), sin textos que se repiten ni mayúsculas gritonas.

## Lo que el revisor no hace
- No reescribe el código ni propone una versión mejor entera.
- No discute decisiones de producto de Guillermo: solo si el código las cumple bien.
- No aprueba «con cambios»: o está bien, o se rechaza con la lista.
