# Plan de migración a shadcn en 4 etapas — auditoría por rol

> Fecha: 2026-08-18
> Origen: `frontend/` (producción, React + Bootstrap)
> Destino: `frtonend-v2/` (React + TS + shadcn/ui)
> Alcance: paridad funcional rol por rol. No se tocó backend ni base de datos.

---

## Veredicto

**La migración NO está al 100%, pero está mucho más avanzada de lo que sugiere el
volumen de código.** v2 tiene ~14.000 líneas menos que v1 en los módulos de
negocio, y la mayor parte de esa diferencia es Bootstrap inline + `styled-components`
+ SweetAlert reemplazados por primitivas de shadcn. Contrastando **endpoints
consumidos, componentes montados y handlers de negocio**, quedan **21 gaps reales**.

| Rol | Pantallas | Endpoints v1 → v2 | Gaps reales | Estado |
|---|---|---|---|---|
| **Vendedor** | 11 / 11 | 57 → 54 | **12** | 🟡 ~85% |
| **Supervisor** | 10 / 10 | 42 → 36 | **5** | 🟡 ~80% |
| **Backoffice** | 8 / 8 | 41 → 43 | **0** | 🟢 ~100% |
| **Admin** | 20 / 15 | 87 → 82 | **4** | 🟢 ~95% |

Dos cosas importantes que el conteo de líneas escondía:

- **Backoffice ya es un superset de producción** (43 endpoints vs 41) y tiene
  todos sus componentes cableados. Es el rol que menos trabajo requiere.
- **Admin expone 5 pantallas que en producción están huérfanas** (`GestionCategorias`,
  `SecurityDashboard`, `MonitoringDashboard`, `MetricasAvanzadas`, `DashboardAdmin`:
  existen como archivo pero ningún componente de v1 las importa). v2 las montó.

El orden de etapas que sigue respeta el pedido (vendedor primero) y además coincide
con el flujo de negocio: prospecto → póliza → revisión → administración.

---

## Cómo se midió

Tres cruces independientes, no líneas de código:

1. **Endpoints**: extracción estática de todas las llamadas `${API_URL}/...` y
   `/api/...` por carpeta de rol, normalizando parámetros dinámicos, y `comm -23`
   entre v1 y v2.
2. **Componentes montados**: para cada componente compartido, dónde se renderiza
   (`<Componente`) en v1 vs v2. Detecta el caso "el archivo existe pero nadie lo usa".
3. **Handlers de negocio**: inventario de `const handleX = async` / `const x = async`
   por pantalla, comparado uno a uno.

Los falsos positivos del cruce 1 (rutas armadas dinámicamente, p. ej.
`${API_URL}/admin/${endpoint}/${id}`) se verificaron a mano contra `backend/routes/`.

---

# ETAPA 1 — VENDEDOR

Es el rol con más usuarios y el que contiene el flujo core: prospecto → cotización
→ póliza → firma. **12 gaps**, de los cuales 3 son bloqueantes operativos.

## ✅ Migrado y verificado a paridad

| Funcionalidad | Evidencia |
|---|---|
| **PolizaForm — 6 pasos completos** | v2 agrega "Declaración Jurada" como paso propio. Los 17 campos obligatorios del paso 1 coinciden **exactamente** con `PasoDatosPersonales.jsx:225-243` |
| **Payload `POST /polizas`** | `PolizaForm.tsx:480-505` replica el contrato de `PasoResumen.jsx:130-180`: `datos_personales` con peso/altura, `declaracion_jurada` con `requiere_auditoria_medica`, `integrantes`, `referencias`, `saludTerminos` |
| **Declaración jurada** | Las 6 preguntas y las 13 patologías coinciden literal (`constants/poliza.ts:24-47`) |
| **Cálculo de IMC + flag de auditoría médica** | `PolizaForm.tsx` + `lib/poliza-reglas.ts` |
| **Subida de documentos** (titular + integrantes, 3 tipos) | `POST /poliza-documentos/upload` en loop |
| **Verificación de N° de póliza duplicado** | `/polizas/vendedor/verificar-numero-poliza` |
| **Envío por email / WhatsApp + descarga de PDF** | `/polizas/:id/enviar-{tipo}`, `/polizas/:id/pdf` |
| **WhatsAppVista** | Búsqueda, estadísticas (`/chat/estadisticas`), 5 plantillas, adjuntos con validación de tipo y tamaño (100 MB), marcar leídos. **Agrega** cambio de estado de conversación |
| **EnviarCotizacionModal** | Enmascarado + edición manual del número antes de enviar |
| **Ley19032Modal** | Cálculo de aporte presuntivo (`sueldoBruto * 0.06732`) y filtro por `tipo_afiliacion_id = 2` |
| **PromocionesModal** | Listar, promoción actual, aplicar |
| **SubirDocumentosLibresModal** | Componente 1:1 con v1 (mismos 9 handlers) |
| **PolizasDashboard** | Editar, PDF, documentos, historial de estados, enviar a supervisor con motivo |
| **ProspectoDetalle** | Cotizaciones, recalcular, recotizar todo, cupón de pago + reenvío por WhatsApp, editar prospecto, agregar familiar (con las reglas de vínculo), integrantes con recibo de sueldo |
| **Dashboard** | Gamificación completa (nivel, experiencia, rachas, 9 logros), consulta Gecros por DNI, registrar llamada, primer contacto WhatsApp, historial, crear prospecto, exportación |
| **ChatVendedor (asistente IA)** | Conversaciones, enviar mensaje, cargar conversación |

## ❌ Gaps

### 🔴 V-1 — Gestión de documentos de póliza: no existe

En producción el vendedor abre un modal que **lista** los documentos de la póliza
con nombre, tamaño y fecha, y permite **descargar**, **previsualizar** y
**reemplazar** cada uno.

- v1: `ProspectosDashboard.jsx:547` (`fetchDocumentosPoliza`), `:577` (preview),
  `:598` (actualizar), `:1009` (descargar), modal completo en `:3202-3320`
- v2: `prospectos-dashboard.tsx:912` — el botón "Documentos" abre directamente
  `CargaDocumentosModal`, que **sólo sube** DNI frente/dorso/recibo

Endpoints sin consumir en v2: `/vendedor/polizas/:id/documentos`,
`/vendedor/polizas/documentos/:id/download`, `/vendedor/polizas/documentos/:id/preview`,
`/polizas/documentos/:id/actualizar`.

**Impacto:** el vendedor no puede ver ni corregir un documento mal cargado.

---

### 🔴 V-2 — `EditarPolizaModal` perdió el paso de documentos

v1 reutiliza `PasoIntegrantesDocumentos` pasándole `documentosExistentes`, lo que
habilita preview / actualizar / eliminar sobre los documentos ya subidos
(`EditarPolizaModal.jsx:783,792`). Los handlers `fetchDocumentosPoliza`,
`handleActualizarDocumento`, `handleEliminarDocumento`, `handlePreviewDocumento`,
`handleFileUpload` **no tienen equivalente en v2**.

- v2: `EditarPolizaModal.tsx:36` → `PASOS = ["Datos Personales","Declaración Jurada","Integrantes","Referencias","Salud y Términos"]` — sin documentos

---

### 🔴 V-3 — La cola de prospectos perdió su priorización de negocio

v1 ordena por: refrito visible en cola → Super Leads (`origen === 'flujo-wss'`) y
validados por WhatsApp → fecha real descendente → id
(`ProspectosDashboard.jsx:445-466`).

v2 ordena por `b.id - a.id` (`prospectos-dashboard.tsx:428,453`).

**Impacto:** cambia el orden de trabajo del vendedor. Los refritos y los leads
calificados dejan de aparecer arriba.

---

### 🟠 V-4 — `SubirDocumentosLibresModal` no está cableado en vendedor

El componente está migrado 1:1 pero sólo se monta en backoffice y supervisor.
En producción también lo usa `ProspectosDashboard.jsx` (botón "Agregar documentos"
en la fila de la póliza, condicionado por estado).

---

### 🟠 V-5 — `BadgeEstadoFirma` ausente en "Mis Pólizas"

v1 lo muestra en la tabla y en las tarjetas (`PolizasDashboard.jsx:197` y header
de card). v2 muestra estado y auditoría médica pero **no el estado de firma
electrónica**, así que el vendedor no ve si su póliza ya fue firmada.

---

### 🟠 V-6 — Sin guardado de borrador de la póliza

v1 persiste el avance del formulario con `PATCH /polizas/:id/temporal`
(`PolizaForm.jsx:227-234`). v2 no tiene ninguna llamada equivalente: si se cierra
el modal, se pierde todo lo cargado.

---

### 🟠 V-7 — Filtros del dashboard reducidos de 9 a 4

| v1 (`ProspectosDashboard.jsx:72`) | v2 (`prospectos-dashboard.tsx:383`) |
|---|---|
| nombre, apellido, edad, estado, **origen**, **fechaDesde**, **fechaHasta**, **horaDesde**, **horaHasta** | nombre, apellido, edad, estado |

Se perdió el filtrado por origen y por rango de fecha/hora.

---

### 🟡 V-8 — No se marca "Póliza iniciada" al abrir el formulario

v1 dispara `PUT /prospectos/:id` con `estado: 'Póliza iniciada'` en el momento en
que se abre el `PolizaForm` (`ProspectoDetalle.jsx:250,347`). v2 abre el modal sin
tocar el estado (`prospecto-detalle.tsx:888`).

**Impacto:** el embudo de estados pierde ese escalón para todo prospecto que
inicia una póliza y no la termina.

---

### 🟡 V-9 — No se puede eliminar un familiar

v1: botón con confirmación en el detalle (`ProspectoDetalle.jsx:525,2455`).
v2: sólo `agregarFamiliar`.

---

### 🟡 V-10 — Enmascarado de datos personales aplicado sólo a medias

`maskPhone` existe en v2 en `EnviarCotizacionModal.tsx:34` y `WhatsAppVista.tsx:76`,
pero **no** en el dashboard, el detalle del prospecto ni "Mis Pólizas", donde v1 sí
enmascara teléfono **y correo** (`ProspectoDetalle.jsx:1083,1090`,
`PolizasDashboard.jsx:120,140`). No existe ningún `maskEmail` en v2.

---

### 🟡 V-11 — `ChatVendedor` sin "nueva conversación" ni copiar respuesta

Faltan `nuevaConversacion` (`ChatVendedor.jsx:121`), `copiarMensaje` (`:171`) y los
iconos por tipo de consulta (`:176`).

---

### 🟡 V-12 — Validación cruzada edad ↔ fecha de nacimiento

v1 valida que la fecha de nacimiento sea coherente con la edad cargada, con caso
especial para menores de 1 año, y bloquea el avance de paso mientras haya error
(`PasoDatosPersonales.jsx:33,305-335,247`). v2 no tiene ningún `errorEdad`.

---

## Orden sugerido para la Etapa 1

1. V-3 (orden de la cola) — 1 función, alto impacto operativo
2. V-1 + V-2 (documentos) — el bloque más grande, ~2-3 días
3. V-5, V-4 (firma y documentos libres en pólizas) — cableado, ~medio día
4. V-6 (borrador) — requiere estado extra en el form
5. V-7, V-8, V-9, V-10, V-11, V-12 — ~2 días en conjunto

---

# ETAPA 2 — SUPERVISOR

10 de 10 vistas presentes (`dashboard`, `resumen`, `prospectos`, `polizas`,
`vendedores`, `metricas`, `cotizaciones`, `documentos`, `promociones`, `chat`).
El gap se concentra en **un solo lugar**: `SupervisorPolizasView`.

## ❌ Gaps

### 🔴 S-1 — La firma electrónica no está en la vista de pólizas del supervisor

`PolizasSupervisor.jsx` monta `BotonEnviarFirma` (×2), `BadgeEstadoFirma` (×2) y
`CargarPolizaFirmadaModal`. En v2, `SupervisorPolizasView.tsx` monta **sólo**
`DocumentPreviewModal`, `PolizaDetalleSupervisor` y `SubirDocumentosLibresModal`.

Los tres componentes de firma **existen en v2** pero están cableados únicamente en
backoffice. **El supervisor no puede enviar una póliza a firmar ni ver su estado.**

### 🟠 S-2 — `BotonEliminarPoliza` no cableado en supervisor
Presente en v1 (`PolizasSupervisor.jsx`, ×2), en v2 sólo en `BackofficePolizasView`.

### 🟠 S-3 — `CargaMultipleDocumentos` degradado
- v1 sube en lote a `POST /supervisor/polizas/:id/documentos/multiple` (`:206`),
  lee `GET /supervisor/polizas/:id/documentos/estadisticas` (`:108`) y permite
  preview (`:279`).
- v2 (`CargaMultipleDocumentos.tsx:109`) sube **de a un archivo** al endpoint
  simple, sin estadísticas ni preview.

### 🟠 S-4 — `ModalExportacion` sí está montado ✅
Verificado en `SupervisorDashboardPage.tsx`. No es gap.

### 🟡 S-5 — Cierre remoto de sesión (`/sessions/end`)
Usado en `SupervisorDashboard.jsx`, sin equivalente en v2.

---

# ETAPA 3 — BACKOFFICE

**El rol más completo. 0 gaps detectados.**

- 43 endpoints consumidos vs 41 en producción (superset).
- Todos los componentes cableados: `BotonEliminarPoliza`, `BotonEnviarFirma`,
  `BotonesEliminarFirma`, `BadgeEstadoFirma`, `CargarPolizaFirmadaModal`,
  `SubirDocumentosLibresModal`.
- 8 vistas: dashboard, prospectos, pólizas, supervisores, vendedores, promociones,
  métricas, detalle de supervisor.

**Pendiente de verificación fina** (no es un gap confirmado):
`MetricasAvanzadas.jsx` (1003 líneas) → `BackofficeMetricasView.tsx` (843).
Vale un repaso sección por sección de los gráficos.

---

# ETAPA 4 — ADMIN

20 vistas en v2 contra 15 montadas en producción. Casi todo migrado, y encima
rescata pantallas huérfanas de prod.

## ❌ Gaps

### 🟠 A-1 — `ListaPreciosAdmin` sin alta ni baja de precios
v1 tiene `handleAdd` (`:239`) y `handleDelete` (`:216`). v2
(`ListaPreciosAdmin.tsx`) sólo consume: listar, editar precio, aumento/descuento
masivo, template, exportar e importar CSV. **No se puede crear ni borrar una fila
de precio.** También falta `handleDetalle` (`:351`).

### 🟡 A-2 — `MonotributoAdmin` (512 → 228 líneas)
Reducción grande sin gap de endpoints detectado. Requiere revisión de UI.

### 🟡 A-3 — `PrestadoresAdmin` (886 → 339 líneas)
Ídem. Verificar el CRUD completo y los filtros.

### 🟡 A-4 — `UsuariosAdmin` (1525 → 801) y `VendedoresAdmin` (1358 → 634)
Los endpoints están todos (`list-users`, `create-user`, `update-user`,
`delete-user`, `enable/disable-user`, `resend-verification`, `users/active`,
`toggle-status`, `asignar`, `asignar-categoria`). Verificar detalles de UI:
ordenamiento de columnas, vista de inactivos, reasignación masiva de prospectos.

## ✅ Verificado sin gap

- `POST /admin/vendedores/asignar` de v2 **funciona**: `vendedoresAdminRoutes.js:84`
  declara `/asignar` como alias explícito de `/asignar-supervisor`.
- `PUT /admin/lista-precios/aumentar|disminuir/todos` — presentes en
  `ListaPreciosAdmin.tsx:142`, con los límites de producción (aumento ≤ 999,99 %,
  descuento < 100 %).
- `/admin/dashboard/completo` — **no es gap**: `DashboardAdmin.jsx` está huérfano
  en producción y `dashboardAdminRoutes` no se monta en `server.js`.
- `RefritosAdmin` — v2 tiene 4 tabs (cargar, estadísticas, histórico, por vendedor)
  contra 3 en v1. Superset.
- Mapas (`MapaCoropleta`, `MapaProspectosBuenosAires`) — presentes y montados.

---

# Transversal (afecta a los 4 roles)

| Ítem | Estado |
|---|---|
| Rutas | v2 cubre las 15 de prod y agrega 12 alias ✅ |
| Auth / `AuthContext` / `RequireAuth` | ✅ |
| `SessionManager`, heartbeat, actividad de usuario | ✅ |
| `NotificationContext` + FCM | ✅ |
| PWA (`PWAStatus`, `PwaUpdateToast`, service worker) | ✅ |
| Tema claro/oscuro | ✅ (v1 no lo tenía) |
| `ErrorBoundary`, lazy loading por ruta | ✅ (v1 no lo tenía) |
| `ManualWidget` | 🟡 v1 responde desde una base local (`USE_FALLBACK_ONLY = true`, `ManualWidget.jsx:274`) con sugerencias rápidas por rol; v2 llama siempre al backend y no tiene sugerencias. **Comportamiento distinto, no sólo estilo.** |
| Deuda de consistencia shadcn | 🟡 ~15 tablas siguen escritas a mano en vez de usar la primitiva `data-table`; los formularios validan a mano en vez de `form` + zod |

---

# Resumen ejecutivo del trabajo restante

| Etapa | Gaps 🔴 | Gaps 🟠 | Gaps 🟡 | Estimación |
|---|---|---|---|---|
| 1 — Vendedor | 3 | 4 | 5 | **5-7 días** |
| 2 — Supervisor | 1 | 2 | 1 | **2-3 días** |
| 3 — Backoffice | 0 | 0 | 1 (verificación) | **0,5 día** |
| 4 — Admin | 0 | 1 | 3 (verificación) | **2-3 días** |

**Total estimado: 10-14 días** para paridad funcional completa, más la deuda de
consistencia shadcn (`data-table` + `form`/zod) que es aparte y no bloquea.

## Recomendación

Cerrar **Etapa 1 (V-1, V-2, V-3)** y **Etapa 2 (S-1)** antes de cualquier rollout.
Son los cuatro puntos donde un usuario real de v2 **no puede completar una tarea que
sí completa hoy en producción**: ver y corregir documentos, trabajar la cola en el
orden correcto y enviar una póliza a firmar.

El resto puede salir en iteraciones posteriores sin bloquear el reemplazo.

---

# Registro de implementación

## Etapa 1 — Vendedor ✅ COMPLETADA (18-08-2026)

| ID | Gap | Resolución |
|---|---|---|
| V-1 | Gestión de documentos de póliza | **Nuevo** `DocumentosPolizaPanel.tsx` + `DocumentosPolizaModal.tsx`: lista con tipo, integrante, tamaño y fecha; descargar, previsualizar y reemplazar con motivo. Cableado en `PolizasDashboard` |
| V-2 | EditarPolizaModal sin documentos | Nuevo paso "Documentos" (ahora 6 pasos) reusando el panel con `permitirEliminar` |
| V-3 | Cola sin priorización | `ordenarProspectos()` replica la regla de prod: refrito visible → Super Lead + validado → fecha real → id |
| V-4 | SubirDocumentosLibresModal sin cablear | Montado en el dashboard del vendedor, botón "Agregar documentos" en tabla y tarjetas |
| V-5 | Sin estado de firma en Mis Pólizas | `BadgeEstadoFirma` en tabla y tarjetas |
| V-6 | Guardado de borrador | **DESCARTADO.** Es código muerto en producción: `actualizarPolizaTemporal` nunca se invoca, `poliza_temp_id` nunca se setea y las rutas están comentadas (`polizaRoutes.js:41-44`) |
| V-7 | Filtros 9 → 4 | Restaurados origen (nuevo/reciclado/flujo-wss/alta manual) y rangos de fecha y hora de llegada |
| V-8 | Sin "Póliza iniciada" | `marcarPolizaIniciada()` al abrir el formulario, silencioso como prod |
| V-9 | No se puede eliminar familiar | Botón con confirmación + recotización; bloqueado si hay pólizas |
| V-10 | Enmascarado parcial | Nuevo `lib/mask.ts` con la lógica completa de prod (preserva formato). Aplicado en detalle y Mis Pólizas; deduplicadas las 3 copias previas |
| V-11 | ChatVendedor incompleto | Nueva conversación + copiar respuesta |
| V-12 | Sin validación edad ↔ fecha nac. | `errorEdad` con los casos especiales de prod (edad 0, edad sin cargar) y bloqueo de avance |
| V-13 | Sin paginación | 20 por página con controles, igual que prod |
| V-14 | Sin selector de orden | Llegada ascendente (default) / descendente |

**Hallazgos extra durante la implementación:**
- La vista de tarjetas de "Mis Pólizas" no mostraba contacto, localidad ni email. Agregados (enmascarados).
- `guardarEdicion` no validaba nombre/apellido/edad ni repetía la guarda de pólizas generadas. Corregido.
- V-13 y V-14 no estaban en la auditoría original; se detectaron al implementar V-7.

**Verificación:** `tsc --noEmit` sin errores · `eslint` sin errores nuevos (los 3 de `PolizaForm` son preexistentes) · `vite build` OK.

## Etapa 2 — Supervisor ✅ COMPLETADA (18-08-2026)

| ID | Gap | Resolución |
|---|---|---|
| S-1 | Firma electrónica ausente | `BotonEnviarFirma`, `BadgeEstadoFirma` y `CargarPolizaFirmadaModal` cableados en `SupervisorPolizasView`, en tabla y tarjetas. Se agregó `estado_firma` a la interfaz `Poliza` (sin eso el badge quedaba mudo) |
| S-2 | `BotonEliminarPoliza` sin cablear | Montado con `endpointBase` de supervisor, en tabla y tarjetas |
| S-3 | Carga múltiple degradada | **Era un 404, no una degradación:** v2 posteaba a `POST /supervisor/polizas/:id/documentos`, ruta que no existe. Corregido al contrato real `/documentos/multiple` (un archivo por request, campo `documentos` + `tipos_documento` JSON). Agregadas las estadísticas de completitud y el preview por blob |
| S-4 | `ModalExportacion` | Ya estaba montado. No era gap |
| S-5 | `/sessions/end` | **Falso gap:** v2 lo centraliza en `AuthContext.logout()` con el mismo payload, en vez de duplicarlo por dashboard |

**Verificación:** `tsc --noEmit` sin errores · `eslint` sin errores nuevos · `vite build` OK.

### Corrección a la auditoría original

- **V-10 estaba sobredimensionado:** `maskPhone`/`maskEmail` sí existían en el dashboard del vendedor. El gap real era sólo el detalle del prospecto y "Mis Pólizas".
- **S-3 estaba subdimensionado:** no era una carga menos eficiente, era una ruta inexistente.

## Etapa 3 — Backoffice ✅ VERIFICADA, SIN TRABAJO (18-08-2026)

La revisión pendiente de `MetricasAvanzadas.jsx` (1003) vs `BackofficeMetricasView.tsx` (843)
quedó cerrada: **no hay gap**.

- **Endpoints:** diff vacío. Paridad total.
- **Tabs:** v1 tiene embudo / tendencias / vendedores. v2 tiene embudo / rendimiento /
  tendencias **más un tab "Alertas"** que v1 no tiene, con las tres prioridades
  (alta, media, baja) agrupadas. Es superset.
- **Embudo:** v1 lo dibuja con un pie chart; v2 con barras de progreso horizontales.
  Mismo dato, forma distinta — y para un embudo secuencial la barra es más correcta
  que un pie, que implica partes de un todo.

## Etapa 4 — Admin: 5 gaps pendientes

| ID | Sev | Gap | Evidencia |
|---|---|---|---|
| A-1 | 🟠 | **Lista de precios sin alta ni baja.** v2 sólo hace PUT, importar y exportar | Backend expone `POST /` y `DELETE /:id` (`listaPreciosRoutes.js:11,13`); v1 los usa en `handleAdd:239` y `handleDelete:216` |
| A-2 | 🟠 | **Sin ordenamiento por columna** en Usuarios, Vendedores y Lista de precios | v1 tiene `handleOrdenar` + `getIconoOrden` (`UsuariosAdmin.jsx:557,822`). En v2 las 4 pantallas dan 0 referencias a orden |
| A-3 | 🟡 | Sin vista de detalle de usuario | `UsuariosAdmin.jsx:516` |
| A-4 | 🟡 | Sin vista de detalle de prestador | `GET /admin/prestadores/:id` sin consumir en v2 (`PrestadoresAdmin.jsx:245`) |
| A-5 | 🟡 | Sin vista de detalle de precio | `ListaPreciosAdmin.jsx:351` |

### Verificado como NO gap

- **`MonotributoAdmin`** — crear, editar, eliminar y aumento, a la par. La caída de
  512 a 228 líneas es sólo Bootstrap inline.
- **"Ver inactivos"** de vendedores — v1 usa un handler dedicado, v2 lo resuelve con
  el filtro de estado "Inactivos". Equivalente.
- **`RefritosAdmin`** — 4 tabs en v2 contra 3 en v1.
- **`asignar-supervisor`** — el alias `/asignar` existe en el router.

## Etapa 4 — Admin ✅ COMPLETADA (18-08-2026)

| ID | Gap | Resolución |
|---|---|---|
| A-1 | Lista de precios sin alta ni baja | Modal "Nuevo precio" (`POST /admin/lista-precios`) y borrado con confirmación (`DELETE /:id`) |
| A-2 | Sin ordenamiento por columna | Nuevo `components/common/sortable-header.tsx` + `lib/orden.ts`, cableado en Lista de precios, Usuarios y Vendedores |
| A-3 | Detalle de usuario | **Ya existía.** Estaba como `detalleModal`, no como función: mi grep de handlers no lo vio |
| A-4 | Detalle de prestador | Existía el modal, pero se alimentaba del listado. Ahora pide `GET /admin/prestadores/:id`, que es el único que devuelve **`planes_asignados`** (`prestadorController.js:22`) |
| A-5 | Detalle de precio | Modal de detalle agregado |

### Bug encontrado al implementar A-1

`GET /cotizaciones/tipos-familia` devuelve `{ id, nombre }`
(`opcionesCotizacionesController.js:26`), pero v2 descartaba el `id` y guardaba
sólo el nombre. El alta habría mandado la **posición en la lista** como
`tipo_familia_id`, escribiendo precios contra el tipo de familia equivocado.
Ahora se conserva el objeto entero, y si el catálogo no responde el botón de alta
queda deshabilitado en vez de adivinar ids.

**Verificación:** `tsc --noEmit` sin errores · `eslint` sin errores nuevos · `vite build` OK.

---

# Estado final

| Etapa | Rol | Estado |
|---|---|---|
| 1 | Vendedor | ✅ 14 gaps cerrados |
| 2 | Supervisor | ✅ 3 cerrados, 2 falsos |
| 3 | Backoffice | ✅ verificada, sin trabajo |
| 4 | Admin | ✅ 4 cerrados, 1 ya estaba |

**Paridad funcional completa.** Queda sólo deuda de consistencia, que no bloquea:
~15 tablas a mano en vez de `data-table`, formularios sin `form` + zod, y decidir
qué comportamiento debe tener `ManualWidget` (v1 responde de una base local, v2
consulta al backend).

## Cierre de la deuda de consistencia — 2026-08-25

Ver `AUDITORIA_PARIDAD.md` §14 para el detalle completo (incluye una corrección:
el párrafo de arriba y el §11 de ese documento decían que `data-table`/`form` ya
existían — no era cierto, se verificó contra el código y no había ni la
dependencia de TanStack Table ni de react-hook-form instaladas).

Resumen: construidas las primitivas `data-table` y `form`; migradas las 29
tablas manuales reales (2 exclusiones documentadas a propósito); migrados a
`react-hook-form` + `zod` los 3 formularios de auth y `PolizaForm` (los ~15
modales CRUD de admin quedan con su validación manual, ya funcionan);
`ManualWidget` con sugerencias rápidas por rol. `tsc -b` y `npm run build`
verdes. Sin smoke test en navegador — todavía no hay credenciales/env
configuradas en este entorno.
