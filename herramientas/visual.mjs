#!/usr/bin/env node
// Hierro · revisión visual. Abre la app en Chromium con datos de ejemplo, hace capturas de las pantallas principales
// en tema claro y oscuro, a 360 y 390 px, y comprueba lo que se puede medir de la interfaz.
// Uso:  node herramientas/visual.mjs [--actualizar | --forzar "motivo"]     (APP=<carpeta> para otra copia; SALIDA=<carpeta> para las capturas)
//       SOLO=home,editor  para pasar solo algunas pantallas (no toca la línea base).
// Necesita Playwright con Chromium (en el contenedor ya está en /opt/npm-tools; en CI: npm i playwright && npx playwright install chromium).
// Igual que calidad.mjs: BLOQUEANTES a 0 siempre y TRINQUETE en visual-base.json (puede bajar, no subir).
// Las capturas quedan en SALIDA (por defecto /tmp/hierro-visual) para que el agente revisor las mire (ver REVISOR.md, parte visual).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(process.env.APP || path.join(HERE, '..', 'hierro-pwa'));
const OUT = path.resolve(process.env.SALIDA || (process.env.SOLO ? '/tmp/hierro-visual-solo' : '/tmp/hierro-visual')); // SOLO no pisa las capturas completas que pueda estar mirando el revisor
const BASE_FILE = path.join(HERE, 'visual-base.json');
const args = process.argv.slice(2);
const UPDATE = args.includes('--actualizar');
const fi = args.indexOf('--forzar');
const FORCE = fi >= 0 ? (args[fi + 1] || '').trim() : null;
if (fi >= 0 && !FORCE) { console.error('--forzar necesita un motivo entre comillas'); process.exit(2); }
const ONLY = process.env.SOLO ? new Set(process.env.SOLO.split(',')) : null;

const req = createRequire(import.meta.url);
let chromium;
for (const p of ['playwright', '/opt/npm-tools/node_modules/playwright']) { try { ({chromium} = req(p)); break; } catch {} }
if (!chromium) { console.error('No encuentro Playwright (npm i playwright)'); process.exit(2); }

// ── Servidor estático de la app, con config.js vacío (sin nube) ────────────
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.css': 'text/css'};
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  if (p === '/config.js') { r.writeHead(200, {'content-type': TYPES['.js']}); return r.end('window.HIERRO_CONFIG = {apiKey: "", projectId: ""};'); }
  const f = path.join(APP, path.normalize(p).replace(/^([/\\])+/, ''));
  if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(r);
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const URL0 = `http://127.0.0.1:${server.address().port}/`;

// ── Datos de ejemplo: 3 meses de entrenos, medidas, rutina y ajustes ──────
function seed(){
  const ex = [...exMap.keys()].slice(0, 6), day = 864e5, now = Date.now(); S.workouts = [];
  for (let d = 0; d < 36; d++) {
    const st = now - (d * 2.5 + .3) * day, k = d % 3;
    S.workouts.push({id: 'w' + d, title: ['Torso pesado', 'Pierna', 'Empuje y tirón con un nombre largo de verdad'][k], start: st, end: st + (50 + d % 4 * 9) * 6e4, notes: d === 0 ? 'Buenas sensaciones, subir peso la próxima' : '',
      exercises: ex.slice(k, k + 3).map((e, j) => ({exId: e, notes: '', sets: [{t: 'w', kg: 20, reps: 12, done: true}, ...[0, 1, 2].map(i => ({t: 'n', kg: 50 + j * 15 + (36 - d) * .8 + i * 2.5, reps: 10 - i, done: true}))]})), prs: []});
  }
  S.measures = [0, 1, 2, 3, 4, 5].map(i => ({id: 'm' + i, date: now - i * 14 * day, weight: 82 - i * .6, waist: 86 - i * .3}));
  Object.assign(S.settings, {sex: 'm', height: 180, healthOk: now, weekGoal: 4});
  S.routines = [{id: 'r1', name: 'Torso pesado', exercises: ex.slice(0, 3).map(e => ({exId: e, sets: [{t: 'n', kg: 60, reps: 8}, {t: 'n', kg: 60, reps: 8}]}))}];
  try { rkReset(); } catch (e) { /* sin caché de rangos todavía */ }
  Store.mark(); Store.mark('meta');
}
const go_ = (t, v) => { tab = t; navStack[t] = v ? [v] : []; render(); };
const SCREENS = {
  home: () => go_('home'), train: () => go_('train'), social: () => go_('social'), clan: () => go_('clan'), me: () => go_('me'),
  workout: () => go_('me', {type: 'workout', id: 'w0'}), stats: () => go_('me', {type: 'stats'}), ranks: () => go_('me', {type: 'ranks'}),
  rankhow: () => go_('me', {type: 'rankhow'}), exercise: () => go_('me', {type: 'exercise', id: [...exMap.keys()][0]}),
  month: () => { const d = new Date(); go_('me', {type: 'month', ym: d.getFullYear() * 12 + d.getMonth()}); }, plan: () => go_('me', {type: 'plan'}), myex: () => go_('me', {type: 'myex'}),
  editor: () => { go_('train'); A['start-empty'](); const ks = [...exMap.keys()]; ED.data.exercises.push({exId: ks[0], notes: '', sets: [{t: 'w', kg: 20, reps: 12, done: true}, {t: 'n', kg: 62.5, reps: 8, done: true}, {t: 'n', kg: null, reps: null, done: false}]}, {exId: ks[1], notes: '', sets: [{t: 'n', kg: 40, reps: 10, done: false}]}); renderEditor(); },
  picker: () => { SCREENS.editor(); openPicker('add'); const q = document.querySelector('#pkSearch'); q.value = 'press'; q.dispatchEvent(new Event('input', {bubbles: true})); }, // filtrado: la lista entera mide más de 9.000 px
  medida: () => { go_('me'); A['add-measure'](); },
  meta: () => { go_('home'); A['goal-pick'](); },
};
const names = Object.keys(SCREENS).filter(n => !ONLY || ONLY.has(n));

// ── Comprobaciones dentro de la página ─────────────────────────────────────
function audit(){
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && el.checkVisibility({checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true}) && !el.closest('details:not([open]) > :not(summary)'); };
  const fixedish = el => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky' || (p === 'absolute' && e !== el)) return e; } return null; }; // capa flotante (barra, pie de ventana)
  const desc = el => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '') + (el.dataset.act ? `[${el.dataset.act}]` : '') + ' «' + (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24) + '»');
  const out = {overflow: 0, clip: [], small: [], contrast: [], noname: [], overlap: [], noalt: []};
  out.overflow = Math.max(0, document.scrollingElement.scrollWidth - innerWidth);
  // capa de arriba: si hay ventana abierta, solo se mira la ventana
  const modal = document.querySelector('#modal.open .sheet');
  const root = modal || document.querySelector('#editor.open') || document.body; // la capa de arriba tapa lo de debajo
  const inter = [...root.querySelectorAll('button, a[href], [data-act], input:not([type=hidden]), select, textarea, [role=button]')].filter(vis)
    .filter(el => !el.closest('[aria-hidden="true"]') && !(el.parentElement && el.parentElement.closest('button, a[href], [role=button]')));
  // V02 texto cortado sin puntos suspensivos
  for (const el of root.querySelectorAll('*')) {
    if (!vis(el) || el.children.length > 3) continue; const cs = getComputedStyle(el);
    if (!(el.innerText || '').trim() || cs.textOverflow === 'ellipsis' || /^(INPUT|TEXTAREA|SELECT|svg|path)$/i.test(el.tagName)) continue;
    const ox = cs.overflowX === 'hidden' || cs.overflow === 'hidden' || cs.overflowX === 'clip';
    if (ox && el.scrollWidth > el.clientWidth + 2) out.clip.push(desc(el));
  }
  // V03 objetivos táctiles de menos de 40 px (los enlaces dentro de un párrafo no cuentan)
  for (const el of inter) { const r = el.getBoundingClientRect(); if ((r.width < 40 || r.height < 40) && !(el.tagName === 'A' && /^(P|SPAN|SMALL|LI)$/.test(el.parentElement.tagName)) && !/^(checkbox|radio)$/.test(el.type)) out.small.push(desc(el) + ` ${Math.round(r.width)}×${Math.round(r.height)}`); }
  // V05 sin nombre accesible
  for (const el of inter) {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) { if (!(el.labels && el.labels.length) && !el.getAttribute('aria-label') && !el.getAttribute('placeholder') && !el.title) out.noname.push(desc(el)); continue; }
    const name = (el.innerText || '').trim() || el.getAttribute('aria-label') || el.title || [...el.querySelectorAll('img[alt]')].map(i => i.alt).join('');
    if (!name) out.noname.push(desc(el));
  }
  // V08 imágenes sin alt
  for (const im of root.querySelectorAll('img')) if (vis(im) && !im.hasAttribute('alt')) out.noalt.push(desc(im) + ' ' + (im.src || '').slice(-30));
  // V06 solapes entre elementos tocables (más del 30 % del más pequeño)
  const rs = inter.map(el => [el, el.getBoundingClientRect()]);
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const [a, A1] = rs[i], [b, B1] = rs[j]; if (a.contains(b) || b.contains(a) || fixedish(a) !== fixedish(b)) continue; // barra fija sobre contenido que se desplaza: normal
    const w = Math.min(A1.right, B1.right) - Math.max(A1.left, B1.left), h = Math.min(A1.bottom, B1.bottom) - Math.max(A1.top, B1.top);
    if (w > 0 && h > 0 && w * h > .3 * Math.min(A1.width * A1.height, B1.width * B1.height)) out.overlap.push(desc(a) + ' × ' + desc(b));
  }
  // V04 contraste (WCAG AA: 4,5 normal, 3 grande). Fondo = mezcla de los fondos de los antepasados sobre el fondo de la página.
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const mix = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  const pageBg = document.documentElement.dataset.theme === 'light' ? [232, 237, 250, 1] : [7, 11, 26, 1]; // color base del tema (el fondo de body/html es decorativo)
  const bgOf = el => { const chain = []; for (let e = el; e && e.nodeType === 1 && e !== document.body && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); let c = parse(cs.backgroundColor); if (cs.backgroundImage !== 'none') { const st = [...cs.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(m => parse(m[0])); if (/url\(/.test(cs.backgroundImage) && !st.length) return null; if (st.length) { const avg = [0, 1, 2, 3].map(i => st.reduce((s, x) => s + x[i], 0) / st.length); c = c && c[3] > 0 ? mix(avg, c) : avg; } } /* degradado: la media de sus colores */ if (c && c[3] > 0) { chain.push(c); if (c[3] >= .99) break; } } let bg = pageBg; for (const c of chain.reverse()) bg = mix(c, bg); return bg; };
  const seen = new Set();
  for (const el of root.querySelectorAll('*')) {
    if (!vis(el) || el.closest('[aria-hidden="true"]')) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!own) continue;
    const cs = getComputedStyle(el), fg = parse(cs.color); if (!fg) continue; const bg = bgOf(el); if (!bg) continue; // sobre degradado: no se puede medir
    const f = mix([fg[0], fg[1], fg[2], fg[3] * +cs.opacity], bg), L1 = lum(f), L2 = lum(bg), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
    if (ratio < (big ? 3 : 4.5) && !el.closest('[disabled], .disabled')) { const k = desc(el); if (!seen.has(k)) { seen.add(k); out.contrast.push(k + ' ' + ratio.toFixed(2)); } }
  }
  return out;
}

// ── Recorrido ──────────────────────────────────────────────────────────────
fs.rmSync(OUT, {recursive: true, force: true}); fs.mkdirSync(OUT, {recursive: true});
const browser = await chromium.launch({args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']});
const found = {V01: [], V02: new Set(), V03: new Set(), V04: new Set(), V05: new Set(), V06: new Set(), V07: [], V08: new Set()};
const shots = [], ratios = {};
for (const theme of ['dark', 'light']) for (const w of [360, 390]) {
  const ctx = await browser.newContext({viewport: {width: w, height: 780}, deviceScaleFactor: 1, reducedMotion: 'reduce', hasTouch: true, colorScheme: theme, timezoneId: 'Europe/Madrid', locale: 'es-ES'});
  await ctx.clock.setFixedTime(new Date('2026-11-18T12:00:00+01:00')); // fecha y zona fijas: las cifras no cambian según el día ni la máquina (GitHub va en UTC)
  await ctx.addInitScript(t => { try { localStorage.setItem('hierro-theme', t); } catch (e) { /* sin almacenamiento */ } }, theme);
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load|ERR_|net::/.test(m.text())) errs.push(m.text()); });
  await p.goto(URL0); await p.waitForFunction(() => typeof exMap !== 'undefined' && typeof render === 'function');
  await p.evaluate(`(${seed})()`); await p.waitForTimeout(300);
  for (const n of names) {
    const e0 = errs.length;
    await p.evaluate(() => { try { closeModal(); } catch (e) { /* no había ventana */ } if (S.active) { S.active = null; ED.data = null; } document.querySelector('.dcam')?.remove(); });
    await p.evaluate(`(()=>{const go_=${go_};const SCREENS={${Object.entries(SCREENS).map(([k, f]) => `${JSON.stringify(k)}:${f}`).join(',')}};return SCREENS[${JSON.stringify(n)}]();})()`).catch(e => errs.push(n + ': ' + e.message));
    await p.waitForTimeout(450);
    // La app no desplaza el documento sino #view, #editor o la ventana: se alarga la pantalla hasta que quepa todo
    for (let k = 0; k < 3; k++) {
      const extra = await p.evaluate(() => Math.max(0, ...[...document.querySelectorAll('*')].filter(e => { const o = getComputedStyle(e).overflowY; return (o === 'auto' || o === 'scroll') && e.clientHeight > 50 && e.checkVisibility(); }).map(e => e.scrollHeight - e.clientHeight)));
      if (extra < 4) break; const h = p.viewportSize().height; await p.setViewportSize({width: w, height: Math.min(9000, h + extra)}); await p.waitForTimeout(250);
    }
    await p.evaluate(() => document.querySelectorAll('*').forEach(e => { if (e.scrollTop) e.scrollTop = 0; }));
    const file = `${theme}-${w}-${n}.png`; await p.screenshot({path: path.join(OUT, file)}); shots.push(file);
    const r = await p.evaluate(audit); const tag = `${n} (${theme} ${w})`, key = s => `${n}: ${s.replace(/\d+/g, '#')}`; // sin cifras: el día 10 y el 12 del calendario son el mismo fallo
    if (r.overflow > 0) found.V01.push(`${tag}: la página es ${r.overflow} px más ancha que la pantalla`);
    r.clip.forEach(s => found.V02.add(key(s))); r.small.forEach(s => found.V03.add(key(s.replace(/ \d+×\d+$/, '')))); r.contrast.forEach(s => { const k = key(s.replace(/ [\d.]+$/, '') + ` [${theme}]`); found.V04.add(k); ratios[k] = Math.min(ratios[k] || 99, +s.match(/[\d.]+$/)[0]); });
    r.noname.forEach(s => found.V05.add(key(s))); r.overlap.forEach(s => found.V06.add(key(s))); r.noalt.forEach(s => found.V08.add(key(s)));
    errs.slice(e0).forEach(e => found.V07.push(`${tag}: ${String(e).split('\n')[0]}`));
    await p.setViewportSize({width: w, height: 780});
  }
  await ctx.close();
}
await browser.close(); server.close();

// ── Resultado y línea base ─────────────────────────────────────────────────
const metrics = {
  'V02 texto cortado sin «…»': found.V02.size, 'V03 objetivos táctiles de menos de 40 px': found.V03.size, 'V04 textos con poco contraste': found.V04.size,
  'V05 botones o campos sin nombre accesible': found.V05.size, 'V06 elementos tocables que se solapan': found.V06.size, 'V08 imágenes sin alt': found.V08.size,
};
const fails = [...found.V01.map(m => ['V01 desborde horizontal', m]), ...found.V07.map(m => ['V07 errores de página', m])];
const detail = Object.fromEntries(Object.entries(found).map(([k, v]) => [k, [...v].sort().map(x => ratios[x] ? `${x} ${ratios[x].toFixed(2)}:1` : x)]));
fs.writeFileSync(path.join(OUT, 'informe.json'), JSON.stringify({app: APP, capturas: shots, ...detail}, null, 2));
let base = {}; try { base = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')); } catch {}
const bm = base.metricas || {};
const worse = Object.entries(metrics).filter(([k, v]) => k in bm && v > bm[k]);
console.log(`Hierro · revisión visual · ${names.length} pantallas × claro/oscuro × 360/390 px = ${shots.length} capturas en ${OUT}\n\nBLOQUEANTES`);
if (!fails.length) console.log('  ✓ ninguno'); for (const [id, m] of fails.slice(0, 20)) console.log(`  ✗ ${id}: ${m}`);
console.log('\nTRINQUETE (puede bajar, no subir)');
for (const [k, v] of Object.entries(metrics)) { const b = bm[k]; console.log(`  ${b == null ? '·' : v > b ? '✗' : v < b ? '↓' : '✓'} ${k}: ${v}${b == null ? ' (sin base)' : v !== b ? ` (base ${b})` : ''}`); }
if (process.env.DETALLE || worse.length) for (const [k, v] of Object.entries(detail)) if (v.length && !['V01', 'V07'].includes(k)) console.log(`\n${k}:\n  ` + v.slice(0, 40).join('\n  ') + (v.length > 40 ? `\n  … y ${v.length - 40} más (informe.json)` : ''));
let ok = !fails.length;
if (worse.length && !FORCE) { ok = false; console.log(`\n✗ Empeora: ${worse.map(([k]) => k).join('; ')}. Arréglalo o, si está justificado, --forzar "motivo".`); }
if (ok && !ONLY && (UPDATE || FORCE || !base.metricas)) {
  const nb = {actualizado: new Date().toISOString().slice(0, 10), metricas: base.metricas ? {...bm} : {...metrics}, forzados: base.forzados || []};
  for (const [k, v] of Object.entries(metrics)) if (!(k in nb.metricas) || (UPDATE && v < nb.metricas[k])) nb.metricas[k] = v;
  if (FORCE) { for (const [k, v] of worse) nb.metricas[k] = v; nb.forzados.push({fecha: nb.actualizado, motivo: FORCE, subidas: Object.fromEntries(worse)}); }
  fs.writeFileSync(BASE_FILE, JSON.stringify(nb, null, 2) + '\n'); console.log(`\nLínea base guardada en ${path.relative(process.cwd(), BASE_FILE)}`);
}
console.log(ok ? '\n✓ PASA' : '\n✗ NO PASA');
process.exit(ok ? 0 : 1);
