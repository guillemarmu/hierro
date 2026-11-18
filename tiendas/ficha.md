# Ficha de Hierro para las tiendas

Textos y respuestas listos para copiar en Google Play Console y App Store Connect. Revisar antes de enviar.

## Enlaces
- Política de privacidad: https://guillemarmu.github.io/hierro/privacidad.html
- Soporte (Apple lo exige): https://guillemarmu.github.io/hierro/soporte.html
- Borrar la cuenta sin la app (Google lo exige): https://guillemarmu.github.io/hierro/soporte.html#borrar-cuenta
- Condiciones (EULA propia para Apple, opcional): https://guillemarmu.github.io/hierro/condiciones.html
- Correo de contacto: soporte.hierro.app@gmail.com

## Textos
- **Nombre**: Hierro (si en Apple está cogido: «Hierro: diario de gym»).
- **Subtítulo de Apple** (30 caracteres): `Entrenos, récords y progreso`
- **Descripción corta de Google** (80 caracteres): `Apunta tus entrenos de gimnasio, bate tus récords y pica a tus amigos.`
- **Palabras clave de Apple** (100 caracteres): `gimnasio,gym,pesas,entreno,rutina,fuerza,musculación,récords,series,hevy,progreso,culturismo`
- **Categoría**: Salud y forma física (las dos tiendas).
- **Descripción larga**:

> Hierro es tu diario de gimnasio. Apunta cada serie en segundos, sigue tus rutinas y mira cómo subes.
>
> **Entrena**
> • Rutinas a tu medida y entrenos libres, con series de calentamiento, normales y al fallo.
> • Temporizador de descanso con aviso, aunque tengas el móvil bloqueado.
> • Funciona sin conexión: todo se guarda en el móvil y se sube solo.
>
> **Progresa**
> • Récords («chiquipuntos») al momento, 1RM estimado y gráficas por ejercicio.
> • Rangos de fuerza de Hierro a Simétrico, ajustados a tu peso, sexo y altura.
> • Calendario, rachas, meta semanal y resumen de cada entreno.
>
> **Con tus amigos**
> • Publica tus entrenos con una foto doble (trasera y frontal) y comenta los de tus amigos.
> • Clanes con liga semanal, alianzas y piques.
> • Perfil público o privado: tú decides quién ve qué.
>
> **Tus datos son tuyos**
> • Sin publicidad y sin analítica.
> • Exporta tus datos cuando quieras y borra tu cuenta desde la app.
> • ¿Vienes de Hevy? Importa tu historial con el CSV.

## Clasificación por edad
- Apple: **16+** (las condiciones piden 16 años). Respuestas: contenido generado por usuarios = sí; mensajes entre usuarios = sí (comentarios y muros de clan); sin violencia, sexo, drogas, apuestas ni compras.
- Google (cuestionario IARC): red social / contenido generado por usuarios = sí; los usuarios pueden interactuar = sí; comparte ubicación = no; compras digitales = no. Público objetivo: 16 años o más (no dirigida a niños).

## Privacidad de Apple (App Privacy)
- ¿Rastreo (tracking)? **No.** Sin publicidad ni SDK de terceros.
- Datos recogidos, **vinculados al usuario**, para **funcionalidad de la app**:
  - Información de contacto: correo electrónico, nombre.
  - Salud y forma física: salud (peso y medidas, solo con consentimiento) y forma física (entrenos).
  - Contenido del usuario: fotos, otro contenido (publicaciones, comentarios, mensajes de clan).
  - Identificadores: ID de usuario.
  - Diagnóstico: otros datos de diagnóstico (estado de la sincronización y navegador del móvil, que la app guarda en tu cuenta).
  - Identificadores: la suscripción de avisos push del navegador (solo si activas los avisos).
- Datos para **prevenir el fraude** (reCAPTCHA de Google en App Check, solo con cuenta): identificadores del dispositivo y datos de uso técnicos. No vinculados a la identidad para publicidad.

## Seguridad de los datos de Google (Data safety)
- ¿Recoge o comparte datos? Recoge: **sí**. Comparte con terceros: **no** (Google Firebase y Cloudflare son encargados del tratamiento, no cuenta como compartir).
- Cifrado en tránsito: **sí** (todo por HTTPS).
- Se puede pedir el borrado: **sí**, desde la app y en la URL de soporte. **Ojo**: hoy el botón de la app no borra los comentarios en publicaciones ajenas, los mensajes de los muros, los «me gusta» ni los datos de diagnóstico (lo explica `soporte.html`); antes de enviar a las tiendas conviene que la app los borre también (ver `LEEME.md`).
- Tipos de datos (todos para «Funciones de la app» y «Gestión de la cuenta»; los de reCAPTCHA también para «Prevención de fraudes, seguridad y cumplimiento»):
  - Información personal: nombre, correo electrónico, ID de usuario.
  - Salud y actividad física: información de salud (peso y medidas, opcional), información de actividad física (entrenos).
  - Fotos y vídeos: fotos (opcional, solo si publicas).
  - Mensajes: otros mensajes en la app (comentarios y muros de clan, opcional).
  - Información y rendimiento de la app: diagnósticos (estado de la sincronización y navegador del móvil).
  - ID de dispositivo u otros ID: la suscripción de avisos push (opcional) y los que use reCAPTCHA (prevención de fraudes).
- Nada es obligatorio para usar la app sin cuenta salvo el almacenamiento local.

## Notas para los revisores
- Cuenta de prueba: **la crea Guillermo** (correo y contraseña) y la pone en el campo de acceso de cada tienda. Para llenarla: Perfil › Tus datos › «Importar CSV de Hevy» con `revisores-hevy.csv` (en el proyecto «HIERRO» de Claude) (24 entrenos inventados en 8 semanas), crear una rutina, poner un nombre de usuario en Social y publicar un entreno con la foto doble. Mejor que siga a otra cuenta con alguna publicación, para que el feed no salga vacío.
- Texto (pegar en «Notas para la revisión»):

> Hierro es un diario de gimnasio. Para entrar usa la cuenta de prueba. Desde Entrenar puedes empezar un entreno vacío o una rutina, apuntar series y terminarlo; al guardarlo puedes publicarlo con una foto doble (cámara trasera y frontal). En Social están el feed y los comentarios. Para denunciar: menú de los tres puntos de una publicación, botón «Denunciar» de cada comentario o «Denunciar perfil» en un perfil; para bloquear: «Bloquear» en el perfil. La cuenta se borra en Perfil › Cuenta › «Eliminar mi cuenta y mis datos», con todo su contenido (también comentarios y me gusta en publicaciones de otros). En la app de iOS, Perfil › Ajustes › «Guardar mis entrenos en Salud» apunta cada entreno terminado en la app Salud; la vibración es nativa. El contenido denunciado lo revisa el administrador; el contacto es soporte.hierro.app@gmail.com.

## Capturas
- Google: 2-8 capturas de móvil (vertical, 1080×1920 o similar) y un gráfico de 1024×500.
- Apple: capturas de iPhone de 6,9" (1320×2868) como mínimo.
- Pantallas: Inicio con la meta semanal, entreno en curso, resumen de un entreno, estadísticas, rangos y feed de Social. Claude las puede sacar con la cuenta de prueba.
