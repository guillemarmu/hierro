# Hierro: cuentas, social y estadísticas

Hierro es una web instalable (PWA). Cada persona crea su cuenta con email y contraseña, y sus entrenos se guardan en su cuenta (y en su móvil, para que funcione sin cobertura). Si cambia de móvil, entra con su cuenta y lo tiene todo.

Necesitas dos cosas gratis: **Firebase** (cuentas y datos) y **GitHub** (donde vive la web). Ninguna pide tarjeta.

---

## Parte 1 · Firebase (10 minutos)

### 1. Crea el proyecto
1. Entra en https://console.firebase.google.com con tu cuenta de Google.
2. **Crear un proyecto** → nombre: `hierro` → continuar.
3. Google Analytics: **desactívalo** (no hace falta) → **Crear proyecto**.

### 2. Registra la app web y copia dos datos
1. En la portada del proyecto pulsa el icono **`</>`** (Web).
2. Apodo: `Hierro`. **No** marques Firebase Hosting. → **Registrar app**.
3. Aparece un bloque `firebaseConfig`. Copia estos dos valores:
   - `apiKey: "AIza…"`
   - `projectId: "hierro-xxxxx"`
4. Ábrelos en `config.js` (dentro de esta carpeta) y pégalos entre las comillas:
   ```js
   window.HIERRO_CONFIG = {
     apiKey: "AIza…",
     projectId: "hierro-xxxxx"
   };
   ```
   *(O mándamelos y te devuelvo el ZIP ya configurado. La apiKey de Firebase no es secreta: va dentro de la app; lo que protege los datos son las reglas del paso 4.)*

### 3. Activa el inicio de sesión con email
1. Menú izquierdo: **Compilación → Authentication → Comenzar**.
2. Pestaña **Método de inicio de sesión** → **Correo electrónico/contraseña** → activa el **primer** interruptor → **Guardar**.
3. Pestaña **Configuración → Dominios autorizados → Agregar dominio** → `TUUSUARIO.github.io` (lo tendrás en la parte 2).

Firebase envía gratis el email de "He olvidado mi contraseña" en español.

### 4. Crea la base de datos y ponle las reglas de seguridad
1. Menú izquierdo: **Compilación → Firestore Database → Crear base de datos**.
2. Ubicación: `eur3 (europe-west)` o `europe-southwest1 (Madrid)` → siguiente.
3. Elige **Iniciar en modo de producción** → **Crear**.
4. Pestaña **Reglas**: borra lo que haya, pega el contenido de `firestore.rules` y pulsa **Publicar**.

Con esas reglas, los datos privados (entrenos, rutinas, medidas) solo los ve su dueño. Lo social (perfil público, entrenos publicados, me gusta, comentarios, seguidores) lo ven las personas con cuenta en Hierro, y cada uno solo puede cambiar lo suyo.

---

## Parte 2 · GitHub (10 minutos)

### 5. Cuenta y repositorio
1. Crea la cuenta en https://github.com/signup. El **nombre de usuario** formará parte de la dirección: `https://TUUSUARIO.github.io/hierro/`.
2. Botón **+** (arriba a la derecha) → **New repository** → nombre `hierro` → **Public** → **Create repository**.

### 6. Sube los archivos
1. En el repositorio, pulsa **uploading an existing file**.
2. Arrastra **lo que hay dentro** de la carpeta `hierro-pwa` (con `config.js` ya rellenado): `index.html`, `config.js`, `manifest.webmanifest`, `sw.js`, `firestore.rules`, `LEEME.md` y las carpetas `icons` y `fonts`.
3. **Commit changes**.

### 7. Activa la web
1. **Settings → Pages**.
2. *Source*: **Deploy from a branch** · *Branch*: **main** y **/ (root)** → **Save**.
3. En 1–2 minutos: *Your site is live at* `https://TUUSUARIO.github.io/hierro/`.

---

## Usarla

- **Instalar:** iPhone → Safari → Compartir → **Añadir a pantalla de inicio**. Android → Chrome → **Instalar app**.
- **Cada persona** abre el enlace, pulsa **Crear cuenta** (nombre, email y contraseña) y empieza con su app vacía.
- **Tus datos de antes:** si en el móvil había entrenos guardados sin cuenta, al entrar la app te pregunta si los añade a tu cuenta. También puedes usar **Restaurar copia** o **Importar CSV de Hevy**.
- **Sin cobertura en el gimnasio:** se guarda en el móvil y se sube solo al volver la conexión (arriba verás "Sincronizado" o "Pendiente de subir").
- **Cuenta:** en Perfil puedes cambiar nombre y contraseña, cerrar sesión o eliminar la cuenta con todos sus datos.
- **Social:** en la pestaña Social cada uno elige su @usuario. Busca a tus amigos, síguelos y verás sus entrenos en el feed; puedes dar me gusta, comentar, copiar su entreno o guardarlo como rutina y compararte con ellos. Al terminar un entreno eliges si se publica. Con perfil privado no se publica nada.
- **Clanes:** en la pestaña Clanes (donde antes estaba Ejercicios) cada uno funda un clan o se une a uno (máximo 30 personas, uno por persona). Hay una liga semanal de lunes a domingo pensada para que no gane siempre el que más levanta: **constancia** (10 puntos por día entrenado, hasta 5), **chiquipuntos** (3 por ejercicio con marca personal, hasta 30) y **mejora** (tu mejor marca de la semana frente a tu mejor marca de las 8 semanas anteriores: 2 puntos por cada 1 %, máximo 10 % por ejercicio y 40 puntos). Además hay clasificación de **fuerza relativa** (1RM estimado ÷ peso corporal; es opcional y solo se publica el cociente, nunca el peso), de **constancia** (semanas seguidas), premios de la semana pasada, clan contra clan (media por miembro activo) y logros. El jefe del clan puede editarlo, expulsar gente y borrarlo. Los ejercicios que crea cada uno siguen en **Perfil › Ejercicios propios** (y al añadir ejercicios a una rutina o a un entreno).

- **Semana, mes y año:** las clasificaciones del clan (puntos, mejora y constancia), clan contra clan, la alianza y los piques tienen selector **Semana / Mes / Año**. Cada semana cuenta entera en el mes en que cae su lunes (la del 29 de diciembre al 4 de enero es de diciembre); el mes suma sus semanas y el año suma sus meses.
- **Piques y alianzas entre clanes:** el jefe de un clan puede **lanzar un pique** o **proponer una alianza** a otro clan (desde «Clan contra clan» o desde los botones de la pestaña); el jefe del otro clan recibe un aviso y acepta o rechaza. Dos clanes son aliados o rivales, nunca las dos cosas, y cada clan tiene como mucho 5 alianzas y 5 piques. En un **pique** hay marcador (media por miembro activo), cara a cara por puestos (1.º contra 1.º…), categorías, historial semana a semana y un **muro de piques** para picarse (solo escriben los dos clanes). En una **alianza** hay clasificación conjunta y «nosotros contra aliados». Tocando a cualquiera en una clasificación te comparas con él.

> **Ojo con las reglas:** esta versión trae reglas nuevas (relaciones entre clanes, muro de piques y resumen mensual). **Hay que volver a publicar las reglas:** copia `firestore.rules` en Firebase › Firestore › Reglas y pulsa **Publicar**, mejor antes de subir la web. Si se sube la web antes, no se rompe nada: la liga sigue funcionando sin el resumen mensual y los piques y alianzas no aparecen hasta publicar las reglas. Las versiones antiguas de la app siguen funcionando con las reglas nuevas.

## Límites del plan gratuito (Spark)
Sin tarjeta y sin cobros posibles: si algún día se superara el límite, la app dejaría de sincronizar hasta el día siguiente (los datos siguen en el móvil). Límites diarios: 50.000 lecturas, 20.000 escrituras y 1 GB de datos. Un grupo de amigos entrenando a diario usa una mínima parte.

## Cuando haya una versión nueva
Sube los archivos nuevos al repositorio (paso 6) **sin pisar tu `config.js`**. Los móviles verán **«Hay una versión nueva → Actualizar»**.
