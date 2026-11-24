/* ---------- 4.26: avisos sociales por push (APNs para la app de iOS y Web Push para la web) ----------
   La app registra cada aparato con su sesión de Firebase (POST /dev/reg) y, al crear un aviso en Firestore
   (solicitud, aceptación, seguimiento, me gusta, comentario, petición de clan o entrada en clan), pide POST /notify.
   El Worker comprueba la sesión (idToken firmado por Google), comprueba en Firestore, con la sesión de quien lo manda,
   que el aviso es real (la solicitud existe, el me gusta está, el comentario es suyo…) y manda el push a los aparatos
   del destinatario. El texto lo pone el Worker (nunca el cliente). Los aparatos se guardan en el Durable Object Coach
   (una sola instancia): 'd:<uid>' → [{k: 'apns'|'web', t, keys?, at}] y 't:<huella del aparato>' → uid.
   Secreto: APNS_P8 (clave .p8 entera, con BEGIN/END; APNS_KEY_ID opcional). Sin él no se manda a iOS (la web sí). */
const FB_PROJECT = 'ascendant-talon-449510-r9';
const APNS_TEAM = 'P8TDPVJAT8', APNS_TOPIC = 'io.github.guillemarmu.hierro', APNS_KID = 'SC2Y29588J'; // clave «Hierro APNs» (24 nov)
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/`;
const SOC_TYPES = ['freq', 'fok', 'follow', 'like', 'comment', 'creq', 'cok'];
const SAFE_ID = /^[A-Za-z0-9_.-]{1,160}$/;
const DEV_MAX = 5, NOTIFY_PER_HOUR = 60;

// --- Sesión de Firebase: verifica el idToken (RS256) con las claves públicas de Google ---
let gKeys = null, gKeysAt = 0;
async function googleKeys(){
  if (gKeys && Date.now() - gKeysAt < 3600e3) return gKeys;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!r.ok) throw new Error('jwk ' + r.status);
  const j = await r.json(); gKeys = {}; gKeysAt = Date.now();
  for (const k of j.keys || []) gKeys[k.kid] = await crypto.subtle.importKey('jwk', {kty: k.kty, n: k.n, e: k.e, alg: 'RS256', ext: true}, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify']);
  return gKeys;
}
const jpart = s => JSON.parse(new TextDecoder().decode(unb64u(s)));
export async function verifyIdToken(tok, now = Date.now()){
  if (typeof tok !== 'string' || tok.length > 4096) return null;
  const p = tok.split('.'); if (p.length !== 3) return null;
  let h, c; try { h = jpart(p[0]); c = jpart(p[1]); } catch (e) { return null; }
  if (h.alg !== 'RS256' || typeof h.kid !== 'string') return null;
  const t = now / 1000;
  if (c.aud !== FB_PROJECT || c.iss !== 'https://securetoken.google.com/' + FB_PROJECT || typeof c.sub !== 'string' || !SAFE_ID.test(c.sub)) return null;
  if (!(c.exp > t) || !(c.iat < t + 300) || !(c.auth_time < t + 300)) return null;
  let keys = await googleKeys(); let key = keys[h.kid];
  if (!key) { gKeysAt = 0; keys = await googleKeys(); key = keys[h.kid]; } // Google rota las claves
  if (!key) return null;
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(p[2]), te.encode(p[0] + '.' + p[1]));
  return ok ? c.sub : null;
}

// --- Firestore por REST con la sesión de quien manda el aviso (así las reglas deciden qué puede ver) ---
const fsv = v => !v ? undefined : 'stringValue' in v ? v.stringValue : 'integerValue' in v ? +v.integerValue : 'doubleValue' in v ? v.doubleValue : 'booleanValue' in v ? v.booleanValue
  : 'arrayValue' in v ? (v.arrayValue.values || []).map(fsv) : 'nullValue' in v ? null : undefined;
async function fsGet(path, idToken){
  const r = await fetch(FS_BASE + path, {headers: {Authorization: 'Bearer ' + idToken}});
  if (r.status === 403) console.log('fs 403', path.split('/')[0]); // sin permiso (o App Check obligatorio): el aviso no se manda
  if (r.status === 404 || r.status === 403) return null;
  if (!r.ok) throw new Error('fs ' + r.status);
  const d = await r.json(), o = {}; for (const [k, v] of Object.entries(d.fields || {})) o[k] = fsv(v);
  return o;
}
const enc = s => encodeURIComponent(s);
const short = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

// Comprueba que el aviso es real y devuelve {title, body} o null. f = remitente (uid del idToken), b = cuerpo de /notify.
export async function socialMessage(f, b, idToken, get = fsGet){
  const to = b.to, type = b.type;
  if (!SOC_TYPES.includes(type) || !SAFE_ID.test(to) || to === f) return null;
  const pid = typeof b.pid === 'string' && SAFE_ID.test(b.pid) ? b.pid : '', cid = typeof b.cid === 'string' && SAFE_ID.test(b.cid) ? b.cid : '';
  const clanId = typeof b.clan === 'string' && SAFE_ID.test(b.clan) ? b.clan : '';
  const prof = await get('profiles/' + enc(f), idToken).catch(() => null);
  const who = short((prof && (prof.name || (prof.username && '@' + prof.username))) || 'Alguien', 40);
  if (type === 'freq') { const d = await get('freqs/' + enc(f + '_' + to), idToken); return d && d.from === f && d.to === to ? {title: 'Solicitud para seguirte', body: `${who} quiere seguirte`} : null; }
  if (type === 'fok') { const d = await get('follows/' + enc(to + '_' + f), idToken); return d && d.from === to && d.to === f ? {title: 'Solicitud aceptada', body: `${who} ha aceptado tu solicitud. Ya puedes ver sus entrenos`} : null; }
  if (type === 'follow') { const d = await get('follows/' + enc(f + '_' + to), idToken); return d && d.from === f && d.to === to ? {title: 'Nuevo seguidor', body: `${who} ha empezado a seguirte`} : null; }
  if (type === 'like' || type === 'comment') {
    if (!pid) return null;
    const p = await get('posts/' + enc(pid), idToken); if (!p || p.uid !== to) return null;
    const tt = p.title ? ` «${short(p.title, 40)}»` : '';
    if (type === 'like') return Array.isArray(p.likes) && p.likes.includes(f) ? {title: 'Me gusta', body: `A ${who} le gusta tu entreno${tt}`, pid} : null;
    if (!cid) return null;
    const c = await get('posts/' + enc(pid) + '/comments/' + enc(cid), idToken);
    return c && c.uid === f ? {title: `${who} ha comentado${tt}`, body: short(c.text, 120) || 'Nuevo comentario', pid} : null;
  }
  if (type === 'creq' || type === 'cok') {
    if (!clanId) return null;
    const c = await get('clans/' + enc(clanId), idToken); if (!c) return null;
    const cn = short(c.name, 30);
    if (type === 'creq') return c.owner === to && Array.isArray(c.requests) && c.requests.includes(f) ? {title: 'Petición para tu clan', body: `${who} quiere entrar en ${cn}`} : null;
    return c.owner === f && Array.isArray(c.members) && c.members.includes(to) ? {title: 'Ya estás en el clan', body: `Te han aceptado en ${cn}`} : null;
  }
  return null;
}

// --- APNs (HTTP/2 lo negocia Cloudflare; autenticación con JWT ES256 de la clave .p8) ---
let apnsKey = null, apnsJwt = null, apnsJwtAt = 0;
async function apnsToken(env){
  if (apnsJwt && Date.now() - apnsJwtAt < 40 * 60e3) return apnsJwt; // Apple: renovarlo entre 20 y 60 min
  if (!apnsKey) {
    const pem = String(env.APNS_P8).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    apnsKey = await crypto.subtle.importKey('pkcs8', unb64u(pem.replace(/\+/g, '-').replace(/\//g, '_')), {name: 'ECDSA', namedCurve: 'P-256'}, false, ['sign']);
  }
  const e = o => b64u(te.encode(JSON.stringify(o)));
  const data = e({alg: 'ES256', kid: env.APNS_KEY_ID || APNS_KID}) + '.' + e({iss: APNS_TEAM, iat: Math.floor(Date.now() / 1000)});
  const sig = new Uint8Array(await crypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, apnsKey, te.encode(data)));
  apnsJwt = data + '.' + b64u(sig); apnsJwtAt = Date.now(); return apnsJwt;
}
const APNS_HEX = /^[0-9a-f]{64,200}$/;
// apns-collapse-id admite 64 bytes y los ids de los me gusta pasan de eso: se usa un hash FNV-1a de 64 bits (16 caracteres)
const idHash = s => { let h = 0xcbf29ce484222325n; for (const c of te.encode(s)) h = BigInt.asUintN(64, (h ^ BigInt(c)) * 0x100000001b3n); return h.toString(16).padStart(16, '0'); };
// Devuelve {status, gone}: gone = el token ya no vale (hay que borrarlo)
async function sendApns(token, msg, env, opt = {}){
  if (!env.APNS_P8) return {status: 0, gone: false};
  const body = JSON.stringify({aps: {alert: {title: msg.title, body: msg.body}, sound: 'default', 'thread-id': opt.thread || 'social'}, hierro: {t: opt.t || '', ...(msg.pid ? {pid: msg.pid} : {})}});
  const go = host => fetch(`https://${host}/3/device/${token}`, {method: 'POST', body, headers: {
    authorization: 'bearer ' + apnsJwt, 'apns-topic': APNS_TOPIC, 'apns-push-type': 'alert', 'apns-priority': opt.urgency === 'normal' ? '5' : '10',
    'apns-expiration': String(Math.floor(Date.now() / 1000) + (opt.ttl || 24 * 3600)), ...(opt.collapse ? {'apns-collapse-id': idHash(opt.collapse)} : {})}});
  await apnsToken(env);
  let r = await go('api.push.apple.com'), why = r.ok ? '' : await r.text();
  if (r.status === 400 && /BadDeviceToken/.test(why)) { r = await go('api.sandbox.push.apple.com'); why = r.ok ? '' : await r.text(); } // compilaciones de desarrollo
  if (!r.ok) console.log('apns', r.status, why.slice(0, 200));
  return {status: r.status, gone: r.status === 410 || (r.status === 400 && /BadDeviceToken|DeviceTokenNotForTopic/.test(why))};
}
// Un aparato (registro del Coach o de avisos sociales) puede ser web ({endpoint, keys}) o iOS ({apns})
async function sendAny(sub, msg, env, opt = {}){
  if (sub.apns) return sendApns(sub.apns, msg, env, opt);
  const r = await sendPush(sub, {...msg, ...(opt.tag ? {tag: opt.tag} : {}), ...(opt.url ? {url: opt.url} : {})}, env, opt);
  if (!r.ok) console.log('webpush', new URL(sub.endpoint).hostname, r.status, (await r.text()).slice(0, 200));
  return {status: r.status, gone: r.status === 404 || r.status === 410};
}

// Valida el aparato que manda la app: {kind: 'apns', token} o {kind: 'web', sub}. Devuelve {k, t, keys?} o null.
function parseDev(b){
  if (b.kind === 'apns') { const t = String(b.token || '').toLowerCase(); return APNS_HEX.test(t) ? {k: 'apns', t} : null; }
  if (b.kind === 'web') {
    const s = b.sub || {}, k = s.keys || {};
    if (typeof s.endpoint !== 'string' || s.endpoint.length > 1024) return null;
    try { const u = new URL(s.endpoint); if (u.protocol !== 'https:' || !PUSH_HOSTS.test(u.hostname)) return null; } catch (e) { return null; }
    if (typeof k.p256dh !== 'string' || typeof k.auth !== 'string' || k.p256dh.length > 200 || k.auth.length > 50) return null;
    return {k: 'web', t: s.endpoint, keys: {p256dh: k.p256dh, auth: k.auth}};
  }
  return null;
}
const devKey = d => 't:' + d.k + ':' + d.t;
const devSub = d => d.k === 'apns' ? {apns: d.t} : {endpoint: d.t, keys: d.keys};

// Rutas /dev/reg, /dev/off y /notify (ya se ha comprobado el origen)
async function socialRoute(path, b, env, out, ip){
  const stub = env.COACH.get(env.COACH.idFromName('coach'));
  const call = async (p, body) => { const r = await stub.fetch('https://coach' + p, {method: 'POST', body: JSON.stringify(body)}); const t = await r.text(); return out(t, r.status); };
  if (path === '/dev/off') { const d = parseDev(b); return d ? call('/dev/off', {d}) : out('bad device', 400); }
  let uid; try { uid = await verifyIdToken(b.idToken); } catch (e) { console.log('jwk', String(e).slice(0, 100)); return out('error', 503); }
  if (!uid) return out('bad token', 401);
  if (path === '/dev/reg') { const d = parseDev(b); return d ? call('/dev/reg', {uid, d, ip}) : out('bad device', 400); }
  // /notify: límite por remitente antes de leer Firestore (cada aviso cuesta hasta 3 lecturas)
  const lim = await stub.fetch('https://coach/rl', {method: 'POST', body: JSON.stringify({k: 'n:' + uid, max: NOTIFY_PER_HOUR})});
  if (!lim.ok) return out('busy', 429);
  // El id del aviso lo calcula el servidor (el cliente no puede inventarse uno nuevo en cada llamada para saltarse la deduplicación)
  const id = socialId(uid, b); if (!id || b.id !== id) return out('bad id', 400);
  let msg; try { msg = await socialMessage(uid, b, b.idToken); } catch (e) { console.log('notify fs', String(e).slice(0, 100)); return out('error', 502); }
  if (!msg) return out('skip');
  return call('/notify', {to: b.to, id, type: b.type, msg});
}
// Mismos ids deterministas que pone la app al crear el aviso (Social.notify)
export function socialId(f, b){
  const ok = v => typeof v === 'string' && SAFE_ID.test(v) ? v : '';
  const t = b.type, pid = ok(b.pid), cid = ok(b.cid), clan = ok(b.clan);
  if (t === 'freq' || t === 'fok' || t === 'follow') return f + '_' + t;
  if (t === 'like') return pid && f + '_like_' + pid;
  if (t === 'comment') return cid && f + '_c_' + cid;
  if (t === 'creq' || t === 'cok') return clan && f + '_' + t + '_' + clan;
  return '';
}
