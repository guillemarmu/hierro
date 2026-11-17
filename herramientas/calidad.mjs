#!/usr/bin/env node
// Hierro · control de calidad («árbitro anti-slop»).
// Uso:  node herramientas/calidad.mjs                 → revisa hierro-pwa/ y falla (exit 1) si algo está mal o empeora
//       node herramientas/calidad.mjs --actualizar    → igual, y si todo pasa baja la línea base a lo que hay ahora
//       node herramientas/calidad.mjs --forzar "motivo" → acepta que un trinquete suba (el revisor tiene que aprobar el motivo)
//       APP=<carpeta> para revisar otra copia de la app.
// Necesita: npm i acorn acorn-walk  (en la carpeta herramientas/ o global)
//
// Dos tipos de reglas:
//  · BLOQUEANTES: tienen que estar a 0 siempre.
//  · TRINQUETE: miden deuda que ya existe; pueden bajar pero no subir respecto a calidad-base.json.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(process.env.APP || path.join(HERE, '..', 'hierro-pwa'));
const BASE_FILE = path.join(HERE, 'calidad-base.json');
const args = process.argv.slice(2);
const UPDATE = args.includes('--actualizar');
const fi = args.indexOf('--forzar');
const FORCE = fi >= 0 ? (args[fi + 1] || '').trim() : null;
if (fi >= 0 && !FORCE) { console.error('--forzar necesita un motivo entre comillas'); process.exit(2); }

const LONG_FN = 80;      // líneas: a partir de aquí una función es «larga»
const LONG_LINE = 400;   // caracteres
const DUP_WIN = 6;       // líneas seguidas iguales para contar como copia y pega
const LONG_CH = 4000;    // caracteres: con las líneas largas de Hierro, el tamaño real de una función se mide mejor así

const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const html = read('index.html'), sw = read('sw.js'), cfg = read('config.js');
const rules = fs.existsSync(path.join(APP, 'firestore.rules')) ? read('firestore.rules') : '';
const lineOf = i => html.slice(0, i).split('\n').length;

const fails = [];   // [regla, detalle]
const metrics = {}; // trinquetes
const info = [];
const bad = (id, msg) => fails.push([id, msg]);

// ── Scripts en línea ────────────────────────────────────────────────────────
const scripts = [];
for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  if (/\ssrc=/.test(m[1] || '')) continue;
  const start = m.index + m[0].indexOf('>') + 1;
  scripts.push({code: m[2], line0: lineOf(start) - 1, start});
}
const parse = (code, name) => {
  try { return acorn.parse(code, {ecmaVersion: 'latest', sourceType: 'script', locations: true, allowHashBang: true}); }
  catch (e) { bad('C02 sintaxis', `${name}: ${e.message}`); return null; }
};
const asts = scripts.map((s, i) => ({...s, ast: parse(s.code, `index.html <script> nº${i + 1} (línea ${s.line0 + 1})`)}));
parse(sw, 'sw.js'); parse(cfg, 'config.js');
const jsAll = scripts.map(s => s.code).join('\n');

// C01 versión
const av = (html.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
const sv = (sw.match(/VERSION\s*=\s*'hierro-([^']+)'/) || [])[1];
if (!av || !sv || av !== sv) bad('C01 versión', `APP_VERSION=${av} y VERSION de sw.js=${sv}: tienen que ser iguales`);
info.push(`versión ${av}`);

// C03 restos de depuración · C04 marcas pendientes · C05 código peligroso
const scan = (re, id, what) => { for (const m of html.matchAll(re)) bad(id, `línea ${lineOf(m.index)}: ${what} «${m[0].trim().slice(0, 40)}»`); };
scan(/\bconsole\.(log|debug|trace|dir)\s*\(/g, 'C03 depuración', 'console');
scan(/\bdebugger\b\s*;?/g, 'C03 depuración', 'debugger');
scan(/(?<![\w.])alert\s*\(/g, 'C03 depuración', 'alert()');
scan(/(\/\/|\/\*)[^\n]*\b(TODO|FIXME|XXX|HACK)\b/g, 'C04 pendiente', 'marca pendiente');
scan(/(?<![\w.])eval\s*\(|new\s+Function\s*\(|document\.write\s*\(/g, 'C05 peligroso', 'código dinámico');
scan(/set(Timeout|Interval)\(\s*['"`]/g, 'C05 peligroso', 'temporizador con texto');
for (const [f, src] of [['sw.js', sw], ['config.js', cfg]])
  for (const m of src.matchAll(/\bconsole\.(log|debug)\(|\bdebugger\b|\b(TODO|FIXME)\b/g)) bad('C03 depuración', `${f}: «${m[0]}»`);

// Recorrido del árbol: claves de objetos, funciones, catch vacíos
const keyName = p => p.computed ? (p.key.type === 'Literal' ? String(p.key.value) : null) : (p.key.name ?? String(p.key.value));
const aKeys = new Map(); // clave de A → línea
const fns = []; const topFns = []; let emptyCatch = 0;
for (const s of asts) {
  if (!s.ast) continue;
  const L = n => n.loc.start.line + s.line0;
  const addA = obj => {
    for (const p of obj.properties) {
      if (p.type !== 'Property') continue;
      const k = keyName(p); if (k == null) continue;
      if (aKeys.has(k)) bad('C06 A duplicado', `A['${k}'] definido en las líneas ${aKeys.get(k)} y ${L(p)}: gana el último y el otro es código muerto`);
      else aKeys.set(k, L(p));
    }
  };
  walk.fullAncestor(s.ast, (n, _st, anc) => {
    if (n.type === 'ObjectExpression') {
      const seen = new Map();
      for (const p of n.properties) {
        if (p.type !== 'Property') continue;
        const k = keyName(p); if (k == null) continue;
        const id = (p.kind || 'init') + ':' + k;
        if (seen.has(id)) bad('C07 clave repetida', `línea ${L(p)}: «${k}» ya estaba en la línea ${seen.get(id)} del mismo objeto`);
        else seen.set(id, L(p));
      }
    }
    if (n.type === 'VariableDeclarator' && n.id.name === 'A' && n.init?.type === 'ObjectExpression') addA(n.init);
    if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.name === 'Object' && n.callee.property.name === 'assign'
        && n.arguments[0]?.name === 'A' && n.arguments[1]?.type === 'ObjectExpression') addA(n.arguments[1]);
    if (/Function/.test(n.type)) {
      const lines = n.loc.end.line - n.loc.start.line + 1;
      const par = anc[anc.length - 2];
      const name = n.id?.name || (par?.type === 'Property' || par?.type === 'MethodDefinition' ? keyName(par) : par?.type === 'VariableDeclarator' ? par.id.name : '(anónima)');
      fns.push({name, line: L(n), lines, chars: n.end - n.start});
    }
    if (n.type === 'CatchClause' && n.body.body.length === 0) {
      const txt = s.code.slice(n.body.start, n.body.end);
      if (!/\/[/*]/.test(txt)) emptyCatch++; // un catch vacío con comentario que lo explique vale
    }
  });
  // funciones de nivel superior
  const declNames = new Map();
  for (const st of s.ast.body) {
    const names = st.type === 'FunctionDeclaration' ? [st.id.name]
      : st.type === 'VariableDeclaration' ? st.declarations.filter(d => d.init && /Function/.test(d.init.type)).map(d => d.id.name) : [];
    for (const nm of names) {
      if (declNames.has(nm)) bad('C07 función repetida', `${nm}() declarada en las líneas ${declNames.get(nm)} y ${L(st)}`);
      declNames.set(nm, L(st)); topFns.push(nm);
    }
  }
}

// C08 data-act sin manejador · R05 manejadores sin usar
const acts = new Set();
for (const m of html.matchAll(/data-act=(?:\\?["'])([a-zA-Z0-9_-]+)(?:\\?["'])/g)) acts.add(m[1]);
for (const m of html.matchAll(/dataset\.act\s*===\s*'([a-zA-Z0-9_-]+)'/g)) aKeys.has(m[1]) || aKeys.set(m[1], lineOf(m.index)); // manejadores de input/change
for (const a of acts) if (!aKeys.has(a)) bad('C08 botón sin acción', `data-act="${a}" no tiene A['${a}']: el botón no hace nada`);
const tokenCount = t => (html.match(new RegExp(`(?<![\\w-])${t.replace(/[$]/g, '\\$')}(?![\\w-])`, 'g')) || []).length;
const unusedA = [...aKeys.keys()].filter(k => !k.startsWith('_') && k !== 'tab' && tokenCount(k) <= 1);
const unusedFn = [...new Set(topFns)].filter(n => tokenCount(n) <= 1);

// C09 ids duplicados en el HTML estático
const staticHtml = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
const ids = {}; for (const m of staticHtml.matchAll(/\sid="([^"]+)"/g)) ids[m[1]] = (ids[m[1]] || 0) + 1;
for (const [k, n] of Object.entries(ids)) if (n > 1) bad('C09 id repetido', `id="${k}" aparece ${n} veces`);

// C10 dominios fuera de la CSP
const csp = (html.match(/Content-Security-Policy"\s+content="([^"]+)"/) || [])[1] || '';
if (!csp) bad('C10 CSP', 'no hay CSP');
for (const m of html.matchAll(/https:\/\/([a-zA-Z0-9.-]+)/g)) {
  if (csp.includes('https://' + m[1])) continue;
  const before = html.slice(Math.max(0, m.index - 8), m.index);
  if (/href=["']?$/.test(before) || m.index < 40 + html.indexOf('Content-Security-Policy')) continue;
  bad('C10 CSP', `línea ${lineOf(m.index)}: https://${m[1]} no está en la CSP (fallará en el navegador)`);
}

// C11 archivos del service worker
for (const m of sw.matchAll(/'\.\/([^']+)'/g)) if (!fs.existsSync(path.join(APP, m[1]))) bad('C11 sw.js', `${m[1]} no existe y está en la lista de caché`);

// C12 secretos · C13 reglas abiertas
const secret = /-----BEGIN [A-Z ]*PRIVATE KEY|"private_key"|\bsk_(live|test)_[0-9a-zA-Z]{8,}|\bghp_[0-9a-zA-Z]{20,}|\bxox[bp]-[0-9a-zA-Z-]{10,}|"d"\s*:\s*"[A-Za-z0-9_-]{40,}"/;
for (const [f, src] of [['index.html', html], ['config.js', cfg], ['sw.js', sw]]) if (secret.test(src)) bad('C12 secreto', `${f} parece llevar una clave privada`);
if (/AIza[0-9A-Za-z_-]{30,}/.test(html)) bad('C12 secreto', 'index.html lleva una clave de API: va en config.js');
for (const m of rules.matchAll(/allow\s+[^;]*\bif\s+true\s*;/g)) bad('C13 reglas', `firestore.rules: «${m[0]}» deja la colección abierta a cualquiera`);

// R07 texto de usuario metido en HTML sin esc()
let unesc = 0; const unescAt = [];
const userField = /^(?![A-Z_]+\.)[\w$.?]+\.(name|title|text|bio|username|note|notes|desc|comment|msg|motto|nick)$/;
for (const m of jsAll.matchAll(/`[^`]*<[a-z][^`]*`/g)) {
  for (const e of m[0].matchAll(/\$\{([^{}]+)\}/g)) if (userField.test(e[1].trim())) { unesc++; unescAt.push(e[1].trim()); }
}

// R09 copia y pega: bloques de DUP_WIN líneas iguales
const norm = jsAll.split('\n').map(l => l.trim()).filter(l => l.length > 12 && !/^(\/\/|\*|[}\])]+;?,?)$/.test(l));
const win = new Map();
for (let i = 0; i + DUP_WIN <= norm.length; i++) { const k = norm.slice(i, i + DUP_WIN).join('\n'); win.set(k, (win.get(k) || 0) + 1); }
const dupBlocks = [...win.values()].filter(n => n > 1).length;

// R10 CSS: !important y selectores repetidos
const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const important = (css.match(/!important/g) || []).length;
const selCount = {};
for (const m of css.replace(/@media[^{]*\{/g, '').matchAll(/([^{}]+)\{[^{}]*\}/g)) { const s = m[1].trim().replace(/\s+/g, ' '); if (s) selCount[s] = (selCount[s] || 0) + 1; }
const cssRepeat = Object.values(selCount).filter(n => n > 1).length;

const longFns = fns.filter(f => f.lines > LONG_FN || f.chars > LONG_CH).sort((a, b) => b.chars - a.chars);
Object.assign(metrics, {
  'R01 funciones largas (80+ líneas o 4000+ caracteres)': longFns.length,
  'R02 función más larga (caracteres)': Math.max(0, ...fns.filter(f => f.name !== '(anónima)' || f.lines < 2000).map(f => f.chars)),
  'R03 líneas de más de 400 caracteres': html.split('\n').filter(l => l.length > LONG_LINE).length,
  'R04 catch vacíos sin comentario': emptyCatch,
  'R05 acciones A sin usar': unusedA.length,
  'R06 funciones sin usar': unusedFn.length,
  'R07 texto de usuario sin esc()': unesc,
  'R08 bloques copiados (6+ líneas)': dupBlocks,
  'R09 !important en CSS': important,
  'R10 selectores CSS repetidos': cssRepeat,
});

// ── Línea base y resultado ──────────────────────────────────────────────────
let base = {}; try { base = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')); } catch {}
const bm = base.metricas || {};
const worse = Object.entries(metrics).filter(([k, v]) => k in bm && v > bm[k]);
const better = Object.entries(metrics).filter(([k, v]) => k in bm && v < bm[k]);

console.log(`Hierro · control de calidad · ${APP}\n${info.join(' · ')} · index.html ${(html.length / 1024).toFixed(0)} KB, ${html.split('\n').length} líneas, ${fns.length} funciones, ${aKeys.size} acciones\n`);
console.log('BLOQUEANTES');
if (!fails.length) console.log('  ✓ ninguno');
const byId = {}; for (const [id, m] of fails) (byId[id] ||= []).push(m);
for (const [id, ms] of Object.entries(byId)) { console.log(`  ✗ ${id} (${ms.length})`); for (const m of ms.slice(0, 15)) console.log('     · ' + m); if (ms.length > 15) console.log(`     · … y ${ms.length - 15} más`); }
console.log('\nTRINQUETE (puede bajar, no subir)');
for (const [k, v] of Object.entries(metrics)) {
  const b = bm[k]; const mark = b == null ? '·' : v > b ? '✗' : v < b ? '↓' : '✓';
  console.log(`  ${mark} ${k}: ${v}${b == null ? ' (sin base)' : v !== b ? ` (base ${b})` : ''}`);
}
if (process.env.DETALLE || worse.length) {
  console.log('\nDETALLE');
  console.log('  funciones largas: ' + longFns.slice(0, 12).map(f => `${f.name} (${f.chars} c, ${f.lines} l, l.${f.line})`).join(', '));
  console.log('  acciones sin usar: ' + unusedA.join(', '));
  console.log('  funciones sin usar: ' + unusedFn.join(', '));
  console.log('  texto sin esc(): ' + unescAt.join(', '));
}

let ok = !fails.length;
if (worse.length && !FORCE) { ok = false; console.log(`\n✗ Empeora: ${worse.map(([k]) => k).join('; ')}. Arréglalo o, si está justificado, --forzar "motivo".`); }
if (ok && (UPDATE || FORCE || !base.metricas)) {
  const nb = {actualizado: new Date().toISOString().slice(0, 10), version: av, metricas: {...bm, ...metrics}, forzados: base.forzados || []};
  if (!UPDATE && !FORCE) nb.metricas = metrics;
  if (UPDATE) for (const [k, v] of better) nb.metricas[k] = v;
  if (!FORCE) for (const [k] of worse) nb.metricas[k] = bm[k];
  if (FORCE) { for (const [k, v] of worse) nb.metricas[k] = v; nb.forzados.push({version: av, fecha: nb.actualizado, motivo: FORCE, subidas: Object.fromEntries(worse)}); }
  fs.writeFileSync(BASE_FILE, JSON.stringify(nb, null, 2) + '\n');
  console.log(`\nLínea base guardada en ${path.relative(process.cwd(), BASE_FILE)}`);
}
console.log(ok ? '\n✓ PASA' : '\n✗ NO PASA');
process.exit(ok ? 0 : 1);
