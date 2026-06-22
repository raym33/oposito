import { leerOposiciones, contarOrganismos, responder } from '../lib/datos.mjs';

export default async function handler(req, res) {
  const items = await leerOposiciones();
  responder(res, contarOrganismos(items));
}
