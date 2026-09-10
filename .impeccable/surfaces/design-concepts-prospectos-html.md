---
version: 1
slug: "design-concepts-prospectos-html"
primary_target: "design-concepts/prospectos.html"
related_targets: ["design-concepts/login.html","design-concepts/supervisor.html","design-concepts/admin.html","design-concepts/backoffice.html","design-concepts/index.html"]
---

# Superficie: set de concepto Cober360

Alcance: set de pantallas de concepto autónomo en `design-concepts/`, fuera de la app en
migración. No importa nada de `src/`. Modo del visitante: **Operate**.

Audiencia y trabajo: vendedor (rol 1) en turno completo, cientos de prospectos, decidiendo a
quién llamar y cargando altas. Superficies hermanas: login, dashboards de supervisor, admin y
backoffice, y los modales del sistema.

Contenido real que manda: los 26 estados de `src/utils/estadosHelper.tsx` y la forma de
`Prospecto` (dni, edad, localidad, origen, estado, updated_at). La pantalla incumbente usa
`ProspectoCard` — tarjeta por prospecto — que es exactamente lo que esta dirección rechaza.

Momento memorable: el folio. El vendedor siempre sabe cuántos hay, cuáles ve y contra qué está
trabado cada registro, sin abrir nada.

Decisiones sin resolver: no hay estándar de accesibilidad fijado; el traslado al código real de
`frontend-v2` es una fase posterior, no parte de este set.

## Direction contract

THESIS: La cola de prospectos es un registro nominal, no una grilla de tarjetas: una fila por
persona, el documento como eje. Rechaza la tarjeta-por-prospecto que la pantalla usa hoy.

OWN-WORLD: Blanco #FFFFFF, tinta #111111, gris #8A8A8A, filete #E0E0E0, violeta #660E80 una sola
vez por pantalla. Montserrat; cifras tabulares en DNI, edad y tiempo. Filete de 1px, sin sombra,
sin radio salvo 2px. Estado estampado en columna fija y graduado por carga, nunca pill flotante.

STORY: El vendedor abre el folio, ve cuántos hay y dónde está parado, barre la lista y actúa en la
fila enfocada sin cambiar de contexto.

FIRST VIEWPORT: Barra de folio de 56px con total, rango visible y filtros. El registro se agrupa por
etapa del embudo bajo encabezado de sección reglado, como los folios de un padrón; la sección activa
lleva regla pesada y el violeta. Dentro de la sección, filas planas: DNI tabular · apellido en 600 ·
nombre · edad · localidad · origen · estado estampado en columna fija · tiempo desde contacto. La
acción primaria aparece en la fila enfocada, alineada a la derecha.

FORM: El Padrón, candidato 3 de la lista ordenada; seed fdaa1b2b.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
