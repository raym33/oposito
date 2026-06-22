import { clasificarTitulo, textoNormalizado } from '../poller.mjs';

const BOJA_HOME = 'https://www.juntadeandalucia.es/eboja/';
const BOJA_BASE = 'https://www.juntadeandalucia.es';

const MESES = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  setiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12',
};

const INCLUIR = [
  'proceso selectivo',
  'pruebas selectivas',
  'oposici',
  'concurso-oposicion',
  'bolsa de empleo',
  'bolsa de trabajo',
  'personal estatutario',
  'personal funcionario',
  'personal laboral',
  'lista de admitid',
  'relacion de aspirantes',
  'concurso de traslado',
  'promocion interna',
  'oferta de empleo',
  'plazas',
  'convocatoria',
];

const EXCLUIR = [
  'subvenci',
  'ayudas',
  'beca',
  'premio',
  'contrato de obras',
  'contratacion del sector',
];

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodificarHtml(texto) {
  return String(texto || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function limpiarHtml(html) {
  return decodificarHtml(String(html || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function fechaIsoDesdeTexto(texto) {
  const match = String(texto || '').match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (!match) return '';

  const dia = match[1].padStart(2, '0');
  const mes = MESES[textoNormalizado(match[2])];
  const ano = match[3];
  return mes ? `${ano}-${mes}-${dia}` : '';
}

function obtenerIdDesdeHref(href) {
  const nombre = href.split('/').pop() || href;
  const match = nombre.match(/^(BOJA\d{2}-\d+-\d+-\d+-\d+)_\d+\.pdf$/i);
  return match ? match[1] : nombre;
}

function tituloAnterior(htmlAnterior) {
  const parrafos = [...htmlAnterior.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  if (parrafos.length === 0) return 'Sin título';
  return limpiarHtml(parrafos.at(-1)[1]) || 'Sin título';
}

function organismoAnterior(htmlAnterior) {
  // El organismo (Consejería / Universidad / Servicio Andaluz de Salud…) va en un
  // <p class="h5 text-uppercase font-weight-bold">…</p>; la cabecera de sección es <h3>.
  const patron = /<(?:p|h2|h3|h4|strong|legend)\b[^>]*(?:font-weight-bold|h5|text-uppercase)[^>]*>([\s\S]*?)<\/(?:p|h2|h3|h4|strong|legend)>/gi;
  const candidatos = [...htmlAnterior.matchAll(patron)]
    .map((m) => limpiarHtml(m[1]))
    .filter(Boolean)
    .filter((t) => !/^\d|oposici|concurso|secci[oó]n|nombramient/i.test(t)); // descarta la cabecera de sección
  return candidatos.at(-1) || 'Junta de Andalucía';
}

function esOposicion(titulo, organismo) {
  const texto = textoNormalizado(`${titulo} ${organismo}`);
  if (EXCLUIR.some((termino) => texto.includes(termino))) return false;
  return INCLUIR.some((termino) => texto.includes(termino));
}

async function descargarHtml(url) {
  const respuesta = await fetch(url, {
    headers: { Accept: 'text/html,application/xhtml+xml' },
  });

  if (respuesta.status === 404) return null;
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status} ${respuesta.statusText}`);
  return respuesta.text();
}

function obtenerUltimoBoletin(homeHtml, ano) {
  let ultimo = 0;
  const patron = /\/eboja\/(\d{4})\/(\d+)\//g;

  for (const match of homeHtml.matchAll(patron)) {
    if (Number(match[1]) !== ano) continue;
    ultimo = Math.max(ultimo, Number(match[2]));
  }

  return ultimo;
}

function extraerItemsBoletin(html, ano, numero, fechaForzada) {
  const fecha = fechaForzada || fechaIsoDesdeTexto(html);
  const items = [];
  const patronPdf = /<a\b[^>]*href=["']([^"']*BOJA\d{2}-\d+-[^"']+?\.pdf)["'][^>]*>/gi;

  for (const match of html.matchAll(patronPdf)) {
    const href = decodificarHtml(match[1]);
    // Solo PDFs de una DISPOSICIÓN (5 grupos numéricos); descarta el PDF del boletín completo.
    if (!/BOJA\d{2}-\d+-\d+-\d+-\d+_/.test(href.split('/').pop() || '')) continue;
    const inicio = Math.max(0, match.index - 20000);
    const anterior = html.slice(inicio, match.index);
    const titulo = tituloAnterior(anterior);
    const organismo = organismoAnterior(anterior);

    if (/secci[oó]n (anterior|siguiente)/i.test(titulo) || titulo.length < 15) continue;
    if (!esOposicion(titulo, organismo)) continue;

    const urlPdf = href.startsWith('http')
      ? href
      : `${BOJA_BASE}/eboja/${ano}/${numero}/${href.replace(/^\.?\//, '')}`;

    items.push({
      id: obtenerIdDesdeHref(href),
      titulo,
      organismo,
      fecha,
      tipo: clasificarTitulo(titulo),
      fuente: 'BOJA',
      urlPdf,
      urlHtml: `${BOJA_BASE}/eboja/${ano}/${numero}/index.html`,
      urlOficial: urlPdf,
    });
  }

  return items;
}

export async function pollBOJA({ dias = 8 } = {}) {
  const ano = new Date().getFullYear();
  const homeHtml = await descargarHtml(BOJA_HOME);
  if (!homeHtml) return [];

  const ultimo = obtenerUltimoBoletin(homeHtml, ano);
  if (!ultimo) {
    console.warn(`BOJA: no se encontró ningún boletín reciente de ${ano}.`);
    return [];
  }

  const items = [];
  const total = Math.max(1, Math.floor(Number(dias) || 8));

  for (let i = 0; i < total; i += 1) {
    const numero = ultimo - i;
    if (numero <= 0) break;

    const url = `${BOJA_BASE}/eboja/${ano}/${numero}/index.html`;

    try {
      const indexHtml = await descargarHtml(url);
      if (!indexHtml) {
        console.log(`BOJA ${ano}/${numero}: no existe sumario.`);
      } else {
        const fecha = fechaIsoDesdeTexto(indexHtml);
        // Localiza las secciones de "Oposiciones, concursos y otras convocatorias" (s53)
        // y "Nombramientos" (s52): el índice solo es un sumario; las disposiciones viven
        // en /eboja/AÑO/N/sXX.html
        const secciones = [...indexHtml.matchAll(/<a\b[^>]*href=["'](s\d+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
          .filter((m) => /oposici|concurso|convocatoria/i.test(m[2]))
          .map((m) => m[1]);
        const encontrados = [];
        for (const sec of [...new Set(secciones)]) {
          const secHtml = await descargarHtml(`${BOJA_BASE}/eboja/${ano}/${numero}/${sec}.html`).catch(() => null);
          if (secHtml) encontrados.push(...extraerItemsBoletin(secHtml, ano, numero, fecha));
          await esperar(250);
        }
        items.push(...encontrados);
        console.log(`BOJA ${ano}/${numero} (${fecha}): ${encontrados.length} items de empleo público.`);
      }
    } catch (error) {
      console.warn(`BOJA ${ano}/${numero}: error al consultar el boletín: ${error.message}`);
    }

    if (i < total - 1) await esperar(400);
  }

  return items;
}
