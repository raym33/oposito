# Oposiciones en España — ¿es posible? (análisis de viabilidad)

**Veredicto: SÍ, es viable y mayormente legal — por niveles.** El Estado (la mayor parte)
es fácil y limpio vía API del BOE. El resto (autonómico, local, universidades, RENFE/ADIF)
es posible pero requiere un adaptador por fuente, y bastante PDF.

---

## ✅ Lo que ya he VERIFICADO (no es teoría)

La **API de datos abiertos del BOE** sirve el sumario diario por secciones, y la
**Sección II.B = "Oposiciones y concursos"** existe y es consultable:

- `GET https://www.boe.es/datosabiertos/api/boe/sumario/AAAAMMDD` (Accept: application/json)
- Ese día había **65 ítems de oposiciones** con: organismo (departamento), título de la
  convocatoria, y enlace al PDF/HTML de las bases.
- Cubre: **convocatorias nuevas, relación de plazas, listas de admitidos, fechas de examen,
  composición de tribunales y correcciones de errores** — todo lo que el lector necesita.

**Dominio público, uso comercial libre.** Esta es la pieza central y es la fácil.

---

## Fuentes por nivel (qué hay y qué cuesta)

| Nivel | Fuente | API/abierto | Dificultad |
|---|---|---|---|
| **Estado (AGE)** | **BOE Sección II.B** | ✅ API JSON | **Fácil** |
| **Ejército / FAS** | BOE (Defensa) + **BOD** (B.O. de Defensa) | BOE ✅ / BOD parcial | Media |
| **Justicia (jueces, fiscales, LAJ…)** | BOE + CGPJ | ✅ vía BOE | Fácil |
| **Autonómico** | 17 boletines (BOJA, DOGC, DOGV, BOCM, BOPV…) | Algunos con datos abiertos/RSS; muchos no | **Media-alta** (1 adaptador por CCAA) |
| **Local (ayuntamientos, diputaciones)** | **BOP** provinciales (50) | Variado, mucho PDF | **Alta** (cola larga) |
| **Universidades** | Sede de cada universidad + boletín autonómico | Rara vez API | Media-alta |
| **RENFE / ADIF / AENA / Correos…** | Portales de empleo propios (empresas públicas) | Sin API; HTML | Media (scraping respetuoso) |

> Patrón: **cuanto más "central", más API**. El BOE concentra Estado + Defensa + Justicia.
> La cola larga (local/universidades) es donde está el trabajo… y la diferenciación.

---

## ⚖️ Legalidad (importante)
- **Los boletines oficiales son públicos y reutilizables** (BOE = dominio público). Agregar
  convocatorias, plazas, fechas y enlaces a la normativa: **legal y limpio.**
- **CUIDADO con las listas de admitidos/aprobados**: contienen **datos personales**
  (nombres, DNI parcial). El boletín los publica, pero **reindexarlos/almacenarlos para otros
  fines tiene límites de RGPD** (la AEPD ha sancionado reusos masivos de datos personales de
  boletines). **Recomendación: para las listas, ENLAZA a la fuente oficial, no copies ni
  indexes los datos personales.** Para convocatorias/plazas/fechas no hay problema.
- Para portales de empresas (RENFE/ADIF): scraping **respetuoso** (rate-limit, robots), o sus
  RSS/feeds si los tienen.

---

## Arquitectura propuesta (MVP → producto)

```
[ Poller diario ]  ── BOE sumario/AAAAMMDD (Sec. II.B)  + adaptadores por fuente
       │
       ▼
[ Clasificador ]  → tipo: convocatoria | plazas | lista admitidos | fecha examen | corrección
       │            extrae: organismo, cuerpo/escala, nº plazas, plazos (fechas), enlace bases
       ▼
[ Base de datos ]  → "expedientes de oposición" enlazando convocatoria ↔ sus actualizaciones
       │              (datos personales NO; solo metadatos + enlace oficial)
       ▼
[ Lector ]  → web/boletín/alertas por email-Telegram, filtros por organismo/territorio/cuerpo,
              "sigue esta oposición" → te avisa cuando salgan admitidos/fechas/examen.
```

**Valor para el usuario:** un sitio/boletín que te dice **qué está convocado ahora, cuántas
plazas, plazos abiertos, dónde están las bases, y te avisa** cuando salga la lista de
admitidos o la fecha de examen — agregando Estado + CCAA + local + empresas públicas.

---

## Recomendación (cómo empezar)
1. **MVP en días, fácil y legal:** poller del **BOE Sección II.B** → clasifica → web + alertas.
   Ya cubre Estado, Defensa, Justicia, y referencias a muchas convocatorias. **0 € de datos.**
2. **Iterar la cola larga** por demanda: añadir las CCAA más pobladas (Andalucía, Madrid,
   Cataluña, C. Valenciana), luego BOPs y universidades, luego RENFE/ADIF.
3. **Enriquecer con IA local** (lo que ya sabemos hacer): resumir las bases, extraer
   requisitos/temario, responder dudas del opositor citando la convocatoria — RAG sobre los
   PDFs del BOE.
4. **Monetización**: freemium (alertas premium por cuerpo/territorio), B2B a academias de
   oposiciones, API para terceros.

## Conclusión
- **¿Fácil?** El núcleo (BOE/Estado), **sí**. La cobertura total (local + universidades +
  empresas públicas), **trabajo de adaptadores**, pero factible.
- **¿Legal?** Sí para convocatorias/plazas/fechas/normativa. **Con cuidado RGPD** en datos
  personales de listas (enlazar, no indexar).
- **¿Negocio?** Demanda enorme (cientos de miles de opositores). El MVP del BOE se puede
  tener funcionando rápido y crecer por niveles.
