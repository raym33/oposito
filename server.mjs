// Servidor para uso LOCAL (node server.mjs). En Vercel se usan las funciones de api/*.
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  leerOposiciones,
  filtrarOposiciones,
  contarOrganismos,
  calcularStats,
  obtenerNovedades,
} from './lib/datos.mjs';

const PUERTO = Number(process.env.PORT || 8090);
const HOST = process.env.HOST || '127.0.0.1';
const RAIZ_PUBLICA = resolve(process.cwd(), 'public');

const TIPOS_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function responderJson(res, estado, datos) {
  res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(datos));
}

function rutaEstaticaSegura(rutaUrl) {
  const rutaLimpia = normalize(decodeURIComponent(rutaUrl.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const relativa = rutaLimpia === '/' ? 'index.html' : rutaLimpia.replace(/^[/\\]/, '');
  const ruta = resolve(RAIZ_PUBLICA, relativa);
  return ruta.startsWith(RAIZ_PUBLICA) ? ruta : null;
}

async function servirEstatico(req, res) {
  const ruta = rutaEstaticaSegura(req.url || '/');
  if (!ruta || !existsSync(ruta)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
    return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS_MIME[extname(ruta)] || 'application/octet-stream' });
  createReadStream(ruta).pipe(res);
}

export async function manejarPeticion(req, res) {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const p = url.searchParams;

    if (url.pathname === '/api/oposiciones') return responderJson(res, 200, filtrarOposiciones(await leerOposiciones(), p));
    if (url.pathname === '/api/organismos') return responderJson(res, 200, contarOrganismos(await leerOposiciones()));
    if (url.pathname === '/api/novedades') return responderJson(res, 200, obtenerNovedades(await leerOposiciones(), p));
    if (url.pathname === '/api/stats') return responderJson(res, 200, calcularStats(await leerOposiciones()));

    if (req.method !== 'GET' && req.method !== 'HEAD') return responderJson(res, 405, { error: 'Método no permitido' });
    await servirEstatico(req, res);
  } catch (error) {
    responderJson(res, 500, { error: 'Error interno', detalle: error.message });
  }
}

export function crearServidor() {
  return createServer(manejarPeticion);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const servidor = crearServidor();
  servidor.on('error', (error) => {
    console.error(`No se pudo arrancar oposito en ${HOST}:${PUERTO}: ${error.message}`);
    process.exitCode = 1;
  });
  servidor.listen(PUERTO, HOST, () => console.log(`oposito disponible en http://${HOST}:${PUERTO}`));
}
