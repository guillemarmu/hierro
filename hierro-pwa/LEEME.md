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

## Límites del plan gratuito (Spark)
Sin tarjeta y sin cobros posibles: si algún día se superara el límite, la app dejaría de sincronizar hasta el día siguiente (los datos siguen en el móvil). Límites diarios: 50.000 lecturas, 20.000 escrituras y 1 GB de datos. Un grupo de amigos entrenando a diario usa una mínima parte.

## Cuando haya una versión nueva
Sube los archivos nuevos al repositorio (paso 6) **sin pisar tu `config.js`**. Los móviles verán **«Hay una versión nueva → Actualizar»**.
