import { leerOposiciones, filtrarOposiciones, paramsDesde, responder } from '../lib/datos.mjs';

export default async function handler(req, res) {
  const items = await leerOposiciones();
  responder(res, filtrarOposiciones(items, paramsDesde(req)));
}
