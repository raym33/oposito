// Lógica compartida entre el servidor local (server.mjs) y las funciones serverless de Vercel.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RUTA_DATOS = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'oposiciones.json');

export function textoNormalizado(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export async function leerOposiciones() {
  try {
    const datos = JSON.parse(await readFile(RUTA_DATOS, 'utf8'));
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
}

export function filtrarOposiciones(items, parametros) {
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

  return { total: filtrados.length, items: filtrados.slice(0, limite) };
}

export function contarOrganismos(items) {
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

export function calcularStats(items) {
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

export function obtenerNovedades(items, parametros) {
  const dias = Math.min(Math.max(Number(parametros.get('dias') || 7), 1), 365);
  const desde = Date.now() - dias * 24 * 60 * 60 * 1000;
  return items
    .filter((item) => {
      const tiempo = Date.parse(item.firstSeen || '');
      return Number.isFinite(tiempo) && tiempo >= desde;
    })
    .sort((a, b) => String(b.firstSeen || '').localeCompare(String(a.firstSeen || '')));
}

// Adaptador para las funciones serverless de Vercel: (req, res) estilo Node.
export function paramsDesde(req) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  return url.searchParams;
}

export function responder(res, datos) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400');
  res.end(JSON.stringify(datos));
}
