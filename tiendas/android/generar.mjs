// Genera el proyecto Android (TWA) a partir de twa-manifest.json con @bubblewrap/core, sin preguntas.
// Uso: node generar.mjs <carpeta-destino> [codigoDeVersion] [nombreDeVersion]
// SITE_BASE=<url de hierro-pwa/> cambia de dónde se bajan los iconos y el manifest (para probar sin conexión al sitio real).
import { TwaGenerator, TwaManifest, ConsoleLog } from '@bubblewrap/core';
import fs from 'node:fs';
import path from 'node:path';

const [dest, code, name] = process.argv.slice(2);
if (!dest) { process.stderr.write('Falta la carpeta de destino\n'); process.exit(1); }
const json = JSON.parse(fs.readFileSync(new URL('./twa-manifest.json', import.meta.url), 'utf8'));
if (code) json.appVersionCode = parseInt(code, 10);
if (name) json.appVersion = name;
if (process.env.SITE_BASE) for (const k of ['iconUrl', 'maskableIconUrl', 'webManifestUrl']) json[k] = process.env.SITE_BASE + json[k].split('/hierro-pwa/')[1];
const manifest = new TwaManifest(json);
const err = manifest.validate();
if (err) { process.stderr.write('twa-manifest.json no vale: ' + err + '\n'); process.exit(1); }
fs.mkdirSync(dest, { recursive: true });
await new TwaGenerator().createTwaProject(path.resolve(dest), manifest, new ConsoleLog('generar'));
await manifest.saveToFile(path.join(dest, 'twa-manifest.json'));
process.stdout.write(`Proyecto generado en ${dest} (versión ${manifest.appVersion}, código ${manifest.appVersionCode})\n`);
