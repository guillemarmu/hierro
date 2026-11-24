/* Puente nativo de Hierro (app de iOS con Capacitor). En la web y en la PWA no hace nada.
   La página es remota (server.url): iOS solo inyecta native-bridge.js, así que los plugins se leen de Capacitor.Plugins. */
(function () {
  'use strict';
  const cap = window.Capacitor;
  if (!(cap && cap.isNativePlatform && cap.isNativePlatform())) return;

  const plugin = (nombre) => {
    try {
      if (typeof cap.registerPlugin === 'function') return cap.registerPlugin(nombre);
      return (cap.Plugins && cap.Plugins[nombre]) || null;
    } catch (e) { return null; /* sin nativo */ }
  };
  const Haptics = plugin('Haptics');
  const Salud = plugin('HierroHealth');

  const leer = (k) => {
    try { return window.localStorage.getItem(k); } catch (e) { return null; /* almacenamiento bloqueado */ }
  };
  const guardar = (k, v) => {
    try { window.localStorage.setItem(k, v); } catch (e) { /* almacenamiento bloqueado */ }
  };
  const quitar = (k) => {
    try { window.localStorage.removeItem(k); } catch (e) { /* almacenamiento bloqueado */ }
  };
  const seguro = (p) => {
    try { return Promise.resolve(p).catch(() => null); } catch (e) { return Promise.resolve(null); }
  };

  // Vibración nativa: traduce el patrón de navigator.vibrate a hápticos de iOS
  const vibrar = (patron) => {
    try {
      if (!Haptics) return true;
      if (Array.isArray(patron)) {
        if (patron.length) seguro(Haptics.notification({type: 'SUCCESS'}));
      } else {
        const ms = Number(patron);
        if (ms > 0) seguro(Haptics.impact({style: ms <= 20 ? 'LIGHT' : 'MEDIUM'}));
      }
    } catch (e) { /* sin nativo */ }
    return true;
  };
  try {
    Object.defineProperty(navigator, 'vibrate', {value: vibrar, configurable: true, writable: true});
  } catch (e) {
    try { navigator.vibrate = vibrar; } catch (e2) { /* sin nativo */ }
  }

  // Salud: guardar en Apple Salud los entrenos de fuerza terminados
  const saludDisponible = async () => {
    try {
      if (!Salud) return false;
      const r = await Salud.isAvailable();
      return !!(r && r.available);
    } catch (e) { return false; }
  };
  const salud = {
    available: saludDisponible,
    enable: async () => {
      try {
        if (!(await saludDisponible())) return false;
        const r = await Salud.requestAuthorization();
        if (r && r.granted) { guardar('hierro.health', '1'); return true; }
      } catch (e) { /* sin nativo */ }
      return false;
    },
    disable: () => { quitar('hierro.health'); }
  };

  window.addEventListener('hierro:workout-saved', (ev) => {
    try {
      if (leer('hierro.health') !== '1' || !Salud) return;
      const d = (ev && ev.detail) || {};
      const start = Number(d.start);
      const end = Number(d.end);
      if (!(start > 0 && end > start)) return;
      const datos = {start, end, name: String(d.name || 'Hierro')};
      seguro(Salud.saveWorkout(datos));
    } catch (e) { /* sin nativo */ }
  });

  // Entreno en curso en la pantalla de bloqueo y la Dynamic Island (Live Activity) + aviso local de fin del descanso.
  // Lee el estado de la app (S.active, REST, nextSetInfo y liveNext de index.html) una vez por segundo y solo avisa a iOS si cambia.
  // Desde 4.20 la siguiente serie lleva un ✓ en la pantalla de bloqueo (iOS 17+): iOS la marca allí y la apunta;
  // al volver, pending() las devuelve y liveApply() las marca en la app antes de volver a mandar el estado.
  // Con una compilación sin el plugin (106 o anterior), Live es null o sus llamadas fallan: no pasa nada.
  const Live = plugin('HierroLive');
  const vivo = {on: true, clave: '', fin: 0, ocupado: false}; // on: true para que, sin entreno, se cierre la que quedara de antes
  const vivoApp = (nombre) => { const h = window.HierroVivo; return h && typeof h[nombre] === 'function' ? h[nombre] : null; }; // index.html 4.20+
  const estadoVivo = () => {
    let w = null, rest = null, nx = null, sig = [];
    try { w = typeof S !== 'undefined' && S ? S.active : null; } catch (e) { w = null; /* app sin cargar */ }
    if (!w || !Array.isArray(w.exercises)) return null;
    try { rest = typeof REST !== 'undefined' ? REST : null; } catch (e) { rest = null; /* app sin cargar */ }
    try { nx = typeof nextSetInfo === 'function' ? nextSetInfo() : null; } catch (e) { nx = null; /* sin ejercicios */ }
    try { sig = vivoApp('next') ? vivoApp('next')(5) : []; } catch (e) { sig = []; /* sin ejercicios */ }
    let done = 0, total = 0;
    w.exercises.forEach((e) => (Array.isArray(e && e.sets) ? e.sets : []).forEach((s) => { total++; if (s && s.done) done++; }));
    const end = rest && !rest.fired ? Number(rest.end) : 0;
    const resting = end > Date.now() + 1000;
    const serie = nx ? (nx.w ? 'Calentamiento' : 'Serie ' + nx.n + ' de ' + nx.total) : '';
    // Lo que se ve es la serie del ✓ (en superseries, la de la ronda), no la primera sin hacer del primer ejercicio
    if (Array.isArray(sig) && sig[0]) nx = {name: sig[0].name, detail: sig[0].detail};
    return {
      title: String(w.title || 'Entreno').slice(0, 60),
      start: Number(w.start) || Date.now(),
      exercise: nx ? String(nx.name || '').slice(0, 60) : (total ? 'Todo hecho' : ''),
      detail: nx ? (nx.detail || [serie, nx.val].filter(Boolean).join(' · ')).slice(0, 80) : (total ? 'Pulsa Terminar para guardarlo' : 'Añade un ejercicio'),
      done, total,
      restStart: resting ? Math.round(end - (Number(rest.total) || 0) * 1000) : 0,
      restEnd: resting ? Math.round(end) : 0,
      next: (Array.isArray(sig) ? sig : []).slice(0, 5).map((x) => ({k: String(x.k), name: String(x.name || '').slice(0, 60), detail: String(x.detail || '').slice(0, 80), rest: Number(x.rest) || 0, ok: !!x.ok}))
    };
  };
  // Solo con el entreno ya cargado (en frío S.active llega tras la sesión): si no, las series se quedan en la cola de iOS.
  const pendientes = async () => {
    let w = null;
    try { w = typeof S !== 'undefined' && S ? S.active : null; } catch (e) { w = null; /* app sin cargar */ }
    if (!w || !vivoApp('apply')) return;
    let items = [];
    try {
      const r = await Live.pending();
      items = r && Array.isArray(r.items) ? r.items : [];
    } catch (e) { return; /* compilación sin pending() */ }
    if (!items.length) return;
    const hechas = vivoApp('apply')(items);
    vivo.clave = '';
    if (Array.isArray(hechas) && hechas.length) seguro(Live.ack({keys: hechas}));
  };
  const pasoVivo = async () => {
    if (!Live || vivo.ocupado) return;
    vivo.ocupado = true;
    try {
      await pendientes();
      const st = estadoVivo();
      // Aviso de fin del descanso (sale con el móvil bloqueado, con la app en segundo plano y, desde 4.20, también con la app delante).
      // Solo se cancela si el descanso se corta antes de tiempo (saltar, descartar): al acabar solo, el aviso tiene que llegar.
      const fin = st && st.restEnd ? st.restEnd : 0;
      if (fin !== vivo.fin) {
        if (fin) {
          const sig = st.exercise && st.exercise !== 'Todo hecho' ? 'Ahora: ' + st.exercise + (st.detail ? ' · ' + st.detail : '') : 'A por la siguiente serie';
          seguro(Live.restNotify({end: fin, title: '¡Descanso terminado!', body: sig}));
        } else if (vivo.fin > Date.now() + 1500) seguro(Live.restCancel());
        vivo.fin = fin;
      }
      // Live Activity
      if (!st) {
        if (vivo.on) { vivo.on = false; vivo.clave = ''; seguro(Live.end()); }
        return;
      }
      const clave = JSON.stringify(st);
      if (clave === vivo.clave) return;
      vivo.clave = clave; vivo.on = true;
      seguro(Live.sync(st));
    } finally {
      vivo.ocupado = false;
    }
  };
  if (Live) {
    setInterval(pasoVivo, 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { vivo.clave = ''; pasoVivo(); } });
  }

  // 4.26: avisos push de iOS (APNs) con @capacitor/push-notifications. Las compilaciones antiguas de TestFlight no traen el plugin:
  // available() da false y la web no enseña nada nativo. El token sale en hexadecimal (minúsculas) y se guarda mientras dure la app.
  const Push = plugin('PushNotifications');
  const hayPush = () => { try { return typeof cap.isPluginAvailable === 'function' ? !!cap.isPluginAvailable('PushNotifications') : true; } catch (e) { return false; /* sin nativo */ } }; // registerPlugin devuelve un proxy aunque el plugin no esté compilado
  const pushOk = !!(Push && hayPush() && ['register', 'checkPermissions', 'requestPermissions', 'addListener'].every((m) => typeof Push[m] === 'function'));
  const apns = {tok: null, espera: null};
  const permisoPush = async (pedir) => {
    let r = await seguro(Push.checkPermissions());
    let p = r && r.receive;
    if (p === 'prompt' && pedir) { r = await seguro(Push.requestPermissions()); p = r && r.receive; }
    return p === 'granted';
  };
  const soltar = (hs) => hs.forEach((h) => { if (h && typeof h.remove === 'function') seguro(h.remove()); });
  // Escucha «registration» antes de llamar a register() (iOS contesta con un evento) y se rinde a los 10 s
  const registrarPush = async () => {
    let fin = null;
    const llega = new Promise((res) => { fin = res; });
    const hs = await Promise.all([
      seguro(Push.addListener('registration', (ev) => fin(ev && typeof ev.value === 'string' ? ev.value.toLowerCase() : null))),
      seguro(Push.addListener('registrationError', () => fin(null)))
    ]);
    const tope = setTimeout(() => fin(null), 10000);
    try {
      await Push.register();
      const t = await llega;
      return typeof t === 'string' && /^[0-9a-f]{64,200}$/.test(t) ? t : null;
    } catch (e) { return null; /* iOS rechazó el registro */ } finally { clearTimeout(tope); soltar(hs); }
  };
  // token(pedir): con pedir=false no sale ningún diálogo (solo registra si el permiso ya estaba dado)
  const tokenPush = async (pedir = true) => {
    if (!pushOk) return null;
    try {
      if (!(await permisoPush(pedir))) return null;
      if (apns.tok) return apns.tok;
      if (!apns.espera) apns.espera = registrarPush().then((t) => { apns.tok = t || apns.tok; apns.espera = null; return t; });
      return await apns.espera;
    } catch (e) { apns.espera = null; return null; /* sin nativo */ }
  };
  // Tocar un aviso social (lleva hierro.t) abre Social › Avisos. Si la web aún no escucha, queda marcado en Native.notifsPending.
  let avisosPendiente = false; // por si el aviso llega antes de que exista window.Native o de que la web escuche
  const abrirAvisos = () => {
    avisosPendiente = true;
    try { window.dispatchEvent(new CustomEvent('hierro:open-notifs')); } catch (e) { /* sin CustomEvent */ }
  };
  if (pushOk) {
    seguro(Push.addListener('pushNotificationActionPerformed', (ev) => {
      const d = ev && ev.notification && ev.notification.data;
      if (d && d.hierro && d.hierro.t) abrirAvisos();
    }));
  }

  let plataforma = 'ios';
  try { if (typeof cap.getPlatform === 'function') plataforma = cap.getPlatform() || 'ios'; } catch (e) { /* se queda en ios */ }
  window.Native = {is: true, platform: plataforma, health: salud, push: {available: () => pushOk, token: tokenPush, perm: async () => pushOk && !!(await seguro(permisoPush(false)))},
    get notifsPending() { return avisosPendiente; }, set notifsPending(v) { avisosPendiente = !!v; }};
})();
