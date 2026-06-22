import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pollBOJA } from './fuentes/boja.mjs';

const BOE_API = 'https://www.boe.es/datosabiertos/api/boe/sumario/';
const BOE_BASE = 'https://www.boe.es';
const RUTA_DATOS = join(process.cwd(), 'data', 'oposiciones.json');

function toArray(x) {
  return x == null ? [] : Array.isArray(x) ? x : [x];
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fechaAaaaMmDd(fecha) {
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function fechaIsoDesdeAaaaMmDd(fecha) {
  return `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}`;
}

function urlBoe(ruta) {
  if (!ruta) return '';
  return String(ruta).startsWith('http') ? ruta : `${BOE_BASE}${ruta}`;
}

function obtenerDias() {
  const indice = process.argv.indexOf('--dias');
  const desdeArg = indice >= 0 ? Number(process.argv[indice + 1]) : undefined;
  const desdeEnv = process.env.DIAS ? Number(process.env.DIAS) : undefined;
  const dias = desdeArg || desdeEnv || 15;
  return Number.isFinite(dias) && dias > 0 ? Math.floor(dias) : 15;
}

function obtenerFuentes() {
  if (process.argv.includes('--solo-boe')) return { boe: true, boja: false };
  if (process.argv.includes('--solo-boja')) return { boe: false, boja: true };
  return { boe: true, boja: true };
}

export function textoNormalizado(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function clasificarTitulo(titulo) {
  const t = textoNormalizado(titulo);

  // Prioridad: lo MÁS específico primero. "convoca" aparece en muchos títulos que en
  // realidad son listas/fechas/tribunales del proceso ya convocado, así que va al final.
  if (t.includes('correccion de errores') || t.includes('corrige')) return 'correccion';
  if (t.includes('admitid') || t.includes('excluid') || t.includes('lista de aspirantes') || t.includes('relacion de aspirantes') || t.includes('lista de admitidos')) return 'admitidos';
  if (t.includes('aprobad') || t.includes('superado') || t.includes('calificaciones')) return 'resultados';
  if (t.includes('fecha') || t.includes('lugar y hora') || t.includes('examen') || t.includes('celebracion del')) return 'fechas';
  if (t.includes('tribunal') || t.includes('organo de seleccion') || t.includes('comision de seleccion') || t.includes('comision permanente de seleccion')) return 'tribunal';
  if (t.includes('relacion de plazas') || t.includes('oferta de empleo') || t.includes('oferta publica')) return 'plazas';
  if (t.includes('nombramiento') || t.includes('se nombra ')) return 'nombramiento';
  if (t.includes('convoca') || t.includes('convocatoria') || t.includes('proceso selectivo') || t.includes('pruebas selectivas')) return 'convocatoria';
  return 'otros';
}

async function cargarExistentes() {
  if (!existsSync(RUTA_DATOS)) return [];

  try {
    const contenido = await readFile(RUTA_DATOS, 'utf8');
    const datos = JSON.parse(contenido);
    return Array.isArray(datos) ? datos : [];
  } catch (error) {
    console.warn(`No se pudo leer ${RUTA_DATOS}; se continuará con una lista vacía: ${error.message}`);
    return [];
  }
}

async function obtenerSumario(fecha) {
  const respuesta = await fetch(`${BOE_API}${fecha}`, {
    headers: { Accept: 'application/json' },
  });

  if (respuesta.status === 404) {
    console.log(`${fecha}: no existe sumario publicado.`);
    return null;
  }

  if (!respuesta.ok) {
    throw new Error(`HTTP ${respuesta.status} ${respuesta.statusText}`);
  }

  return respuesta.json();
}

function extraerItems(data, fecha) {
  // La respuesta del BOE es { status, data: { sumario: { diario } } }
  const sumario = data?.data?.sumario ?? data?.sumario;
  const diarios = toArray(sumario?.diario);
  const items = [];

  for (const diario of diarios) {
    const secciones = toArray(diario?.seccion);
    const seccionOposiciones = secciones.find((seccion) => seccion?.codigo === '2B');
    if (!seccionOposiciones) continue;

    for (const departamento of toArray(seccionOposiciones.departamento)) {
      const organismo = departamento?.nombre || 'Organismo no indicado';
      const candidatos = [
        ...toArray(departamento?.item),
        ...toArray(departamento?.epigrafe).flatMap((epigrafe) => toArray(epigrafe?.item)),
      ];

      for (const item of candidatos) {
        const id = item?.identificador;
        if (!id) continue;

        const rutaPdf = item?.url_pdf?.texto;
        const rutaHtml = item?.url_html;
        const titulo = item?.titulo || 'Sin título';

        items.push({
          id,
          titulo,
          organismo,
          fecha: fechaIsoDesdeAaaaMmDd(fecha),
          tipo: clasificarTitulo(titulo),
          fuente: 'BOE',
          urlPdf: urlBoe(rutaPdf),
          urlHtml: urlBoe(rutaHtml),
          urlOficial: `${BOE_BASE}/diario_boe/txt.php?id=${encodeURIComponent(id)}`,
        });
      }
    }
  }

  return items;
}

function fusionarPorId(existentes, nuevos) {
  const mapa = new Map();
  const ahora = new Date().toISOString();

  for (const item of existentes) {
    mapa.set(item.id, {
      ...item,
      fuente: item.fuente || 'BOE',
      firstSeen: item.firstSeen || ahora,
    });
  }

  for (const item of nuevos) {
    const anterior = mapa.get(item.id);
    mapa.set(item.id, {
      ...anterior,
      ...item,
      fuente: item.fuente || anterior?.fuente || 'BOE',
      firstSeen: anterior?.firstSeen || item.firstSeen || ahora,
    });
  }

  return [...mapa.values()].sort((a, b) => {
    const porFecha = String(b.fecha).localeCompare(String(a.fecha));
    return porFecha || String(a.id).localeCompare(String(b.id));
  });
}

async function main() {
  const dias = obtenerDias();
  const fuentes = obtenerFuentes();
  const existentes = await cargarExistentes();
  const nuevos = [];

  if (fuentes.boe) {
    console.log(`Buscando oposiciones del BOE en los últimos ${dias} días...`);

    for (let i = 0; i < dias; i += 1) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - i);
      const fechaBoe = fechaAaaaMmDd(fecha);

      try {
        const sumario = await obtenerSumario(fechaBoe);
        if (sumario) {
          const encontrados = extraerItems(sumario, fechaBoe);
          nuevos.push(...encontrados);
          console.log(`${fechaBoe}: ${encontrados.length} items en II.B.`);
        }
      } catch (error) {
        console.warn(`${fechaBoe}: error al consultar el BOE: ${error.message}`);
      }

      if (i < dias - 1) await esperar(300);
    }
  }

  if (fuentes.boja) {
    console.log(`Buscando oposiciones del BOJA en los últimos ${dias} boletines...`);
    const encontradosBoja = await pollBOJA({ dias });
    nuevos.push(...encontradosBoja);
    console.log(`BOJA: ${encontradosBoja.length} items filtrados.`);
  }

  const fusionados = fusionarPorId(existentes, nuevos);
  await mkdir(join(process.cwd(), 'data'), { recursive: true });
  await writeFile(RUTA_DATOS, `${JSON.stringify(fusionados, null, 2)}\n`, 'utf8');

  console.log(`Guardados ${fusionados.length} items únicos en ${RUTA_DATOS}.`);
  console.log(`Nuevos leídos en esta ejecución: ${nuevos.length}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Error fatal del poller: ${error.message}`);
    process.exitCode = 1;
  });
}
