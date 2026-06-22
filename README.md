# oposito

**oposito** es un MVP local y open-source para agregar oposiciones de empleo público en España a partir del BOE y el BOJA.

Lee los sumarios diarios del BOE, extrae la sección **II. Autoridades y personal. - B. Oposiciones y concursos**, consulta boletines recientes de Andalucía y expone una web local con filtros por texto, tipo, organismo y fuente.

## Fuente

- BOE: Sección II.B, Oposiciones y concursos.
- API usada: `https://www.boe.es/datosabiertos/api/boe/sumario/AAAAMMDD`
- BOJA: boletín autonómico de Andalucía desde `https://www.juntadeandalucia.es/eboja/`.
- La fuente BOJA incluye oposiciones autonómicas, Servicio Andaluz de Salud y justicia transferida cuando aparecen en el sumario.

## Requisitos

- Node.js 18 o superior.
- Sin dependencias npm.

## Uso

```bash
node poller.mjs          # descarga BOE + BOJA -> data/oposiciones.json
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

Para consultar una sola fuente:

```bash
node poller.mjs --solo-boe
node poller.mjs --solo-boja
```

Para cambiar el puerto:

```bash
PORT=3000 node server.mjs
```

## API local

- `GET /api/oposiciones?tipo=&organismo=&fuente=&q=&limit=`
- `GET /api/novedades?dias=7`
- `GET /api/organismos`
- `GET /api/stats`

Cada item incluye `fuente` (`BOE` o `BOJA`) y `firstSeen`, que conserva la primera vez que oposito vio esa publicación.

## Seguimientos y alertas locales

La web permite guardar la búsqueda actual como seguimiento local en `localStorage`. La pestaña **Mis seguimientos** vuelve a consultar esas búsquedas, marca como **Nuevo** lo visto en los últimos 7 días y puede lanzar una notificación local del navegador si el usuario concede permiso.

La pestaña **Novedades** muestra los items con `firstSeen` reciente desde `/api/novedades`.

## Legalidad y privacidad

El BOE es dominio público. Este proyecto almacena solo metadatos y enlaces oficiales.

Las **listas de admitidos** pueden contener datos personales. Por RGPD, oposito solo enlaza a la fuente oficial del BOE: no descarga, no parsea y no indexa nombres ni otros datos personales contenidos en esos documentos.

Este proyecto no es asesoramiento legal, administrativo ni profesional.

## Roadmap

- Añadir más boletines autonómicos: Madrid/BOCM, Cataluña/DOGC, Galicia/DOG y otros.
- Añadir BOP provinciales.
- Añadir universidades, RENFE/ADIF y otros entes públicos.
- Alertas por email o Telegram.
- Función para seguir una oposición concreta.
- Resumen de las bases con IA local.

## Licencia

MIT.

## Despliegue en Vercel

La web está pensada para alojarse en **Vercel** (serverless):

- `public/` se sirve como estático (la web).
- `api/*.js` son funciones serverless (`/api/oposiciones`, `/api/organismos`, `/api/novedades`, `/api/stats`) que comparten la lógica de `lib/datos.mjs`.
- Los datos viven en `data/oposiciones.json`, **versionado en el repo** (`vercel.json` lo incluye en el bundle de las funciones).

**Para actualizar los datos** (MVP, 0 €): se ejecuta el poller en local y se hace push; Vercel redespliega solo.

```bash
npm run poll          # regenera data/oposiciones.json (BOE + BOJA)
git commit -am "datos: actualización" && git push
```

> En local sigue funcionando `npm start` (server.mjs en http://127.0.0.1:8090).
