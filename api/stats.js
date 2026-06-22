import { leerOposiciones, calcularStats, responder } from '../lib/datos.mjs';

export default async function handler(req, res) {
  const items = await leerOposiciones();
  responder(res, calcularStats(items));
}
