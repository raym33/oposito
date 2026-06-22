# oposito

**oposito** es un MVP local y open-source para agregar oposiciones de empleo público en España a partir del BOE.

Lee los sumarios diarios del BOE, extrae la sección **II. Autoridades y personal. - B. Oposiciones y concursos**, clasifica cada publicación por tipo y expone una web local con filtros por texto, tipo y organismo.

## Fuente

- BOE: Sección II.B, Oposiciones y concursos.
- API usada: `https://www.boe.es/datosabiertos/api/boe/sumario/AAAAMMDD`

## Requisitos

- Node.js 18 o superior.
- Sin dependencias npm.

## Uso

```bash
node poller.mjs          # descarga las últimas oposiciones del BOE -> data/oposiciones.json
node server.mjs          # web en http://localhost:8090
```

También puedes usar los scripts:

```bash
npm run poll
npm start
```

Para cambiar el número de días consultados:

```bash
node poller.mjs --dias 30
DIAS=30 node poller.mjs
```

Para cambiar el puerto:

```bash
PORT=3000 node server.mjs
```

## API local

- `GET /api/oposiciones?tipo=&organismo=&q=&limit=`
- `GET /api/organismos`
- `GET /api/stats`

## Legalidad y privacidad

El BOE es dominio público. Este proyecto almacena solo metadatos y enlaces oficiales.

Las **listas de admitidos** pueden contener datos personales. Por RGPD, oposito solo enlaza a la fuente oficial del BOE: no descarga, no parsea y no indexa nombres ni otros datos personales contenidos en esos documentos.

Este proyecto no es asesoramiento legal, administrativo ni profesional.

## Roadmap

- Añadir boletines autonómicos: BOJA, DOGC, DOGV y otros.
- Añadir BOP provinciales.
- Añadir universidades, RENFE y ADIF.
- Alertas por email o Telegram.
- Función para seguir una oposición concreta.
- Resumen de las bases con IA local.

## Licencia

MIT.
