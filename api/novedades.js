import { leerOposiciones, obtenerNovedades, paramsDesde, responder } from '../lib/datos.mjs';

export default async function handler(req, res) {
  const items = await leerOposiciones();
  responder(res, obtenerNovedades(items, paramsDesde(req)));
}
