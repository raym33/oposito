import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PUERTO = Number(process.env.PORT || 8090);
const HOST = process.env.HOST || '127.0.0.1';
const RAIZ_PUBLICA = resolve(process.cwd(), 'public');
const RUTA_DATOS = join(process.cwd(), 'data', 'oposiciones.json');

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

function textoNormalizado(texto) {
  return String(texto || '').toLowerCase();
}

async function leerOposiciones() {
  try {
    const contenido = await readFile(RUTA_DATOS, 'utf8');
    const datos = JSON.parse(contenido);
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
}

function responderJson(res, estado, datos) {
  const cuerpo = JSON.stringify(datos);
  res.writeHead(estado, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(cuerpo);
}

function filtrarOposiciones(items, parametros) {
  const tipo = parametros.get('tipo') || '';
  const fuente = String(parametros.get('fuente') || '').toUpperCase();
  const organismo = textoNormalizado(parametros.get('organismo'));
  const q = textoNormalizado(parametros.get('q'));
  const limite = Math.min(Math.max(Number(parametros.get('limit') || 100), 1), 500);

  const filtrados = items.filter((item) => {
    if (tipo && item.tipo !== tipo) return false;
    if (fuente && item.fuente !== fuente) return false;
    if (organismo && !textoNormalizado(item.organismo).includes(organismo)) return false;
    if (q && !textoNormalizado(item.titulo).includes(q)) return false;
    return true;
  });

  return {
    total: filtrados.length,
    items: filtrados.slice(0, limite),
  };
}

function contarOrganismos(items) {
  const conteos = new Map();
  for (const item of items) {
    const organismo = item.organismo || 'Organismo no indicado';
    const fuente = item.fuente || 'BOE';
    const actual = conteos.get(organismo) || { organismo, total: 0, porFuente: {} };
    actual.total += 1;
    actual.porFuente[fuente] = (actual.porFuente[fuente] || 0) + 1;
    conteos.set(organismo, actual);
  }

  return [...conteos.values()]
    .sort((a, b) => b.total - a.total || a.organismo.localeCompare(b.organismo, 'es'));
}

function calcularStats(items) {
  const porTipo = {};
  const porFuente = {};
  for (const item of items) {
    porTipo[item.tipo] = (porTipo[item.tipo] || 0) + 1;
    const fuente = item.fuente || 'BOE';
    porFuente[fuente] = (porFuente[fuente] || 0) + 1;
  }

  const actualizado = items.reduce((max, item) => (item.fecha > max ? item.fecha : max), '');
  return { total: items.length, porTipo, porFuente, actualizado };
}

function obtenerNovedades(items, parametros) {
  const dias = Math.min(Math.max(Number(parametros.get('dias') || 7), 1), 365);
  const desde = Date.now() - dias * 24 * 60 * 60 * 1000;

  return items
    .filter((item) => {
      const tiempo = Date.parse(item.firstSeen || '');
      return Number.isFinite(tiempo) && tiempo >= desde;
    })
    .sort((a, b) => String(b.firstSeen || '').localeCompare(String(a.firstSeen || '')));
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

  const tipo = TIPOS_MIME[extname(ruta)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': tipo });
  createReadStream(ruta).pipe(res);
}

export async function manejarPeticion(req, res) {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/oposiciones') {
      const items = await leerOposiciones();
      responderJson(res, 200, filtrarOposiciones(items, url.searchParams));
      return;
    }

    if (url.pathname === '/api/organismos') {
      const items = await leerOposiciones();
      responderJson(res, 200, contarOrganismos(items));
      return;
    }

    if (url.pathname === '/api/novedades') {
      const items = await leerOposiciones();
      responderJson(res, 200, obtenerNovedades(items, url.searchParams));
      return;
    }

    if (url.pathname === '/api/stats') {
      const items = await leerOposiciones();
      responderJson(res, 200, calcularStats(items));
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      responderJson(res, 405, { error: 'Método no permitido' });
      return;
    }

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

  servidor.listen(PUERTO, HOST, () => {
    console.log(`oposito disponible en http://${HOST}:${PUERTO}`);
  });
}
