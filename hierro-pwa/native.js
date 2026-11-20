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

  let plataforma = 'ios';
  try { if (typeof cap.getPlatform === 'function') plataforma = cap.getPlatform() || 'ios'; } catch (e) { /* se queda en ios */ }
  window.Native = {is: true, platform: plataforma, health: salud};
})();
