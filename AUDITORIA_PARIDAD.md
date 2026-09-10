# Auditoría de paridad `frontend` (producción) → `frontendv-2`

> Fecha: 2026-08-11
> Alcance: backend (594 rutas Express), MySQL, `frontend` (147 archivos / 60.013 LOC) y `frontendv-2` (160 archivos / 32.289 LOC).
> Método: extracción AST-ligera del árbol real de rutas de `backend/server.js` y cruce contra **todas** las llamadas HTTP de ambos frontends, más revisión manual de auth, RBAC, PWA, sockets y capa de datos.

---

## 0-bis. Estado de implementación (2026-08-11)

Fases 0, 1 y 3 **cerradas y verificadas** (`tsc -b` y `vite build` en verde).
Fase 2 **parcial**: quedan 13 gaps funcionales, listados en §9.

> ⚠️ **Corrección metodológica.** La primera versión de este informe reportaba
> "typecheck 0 errores" usando `tsc --noEmit`. Ese comando es un **no-op** en
> este proyecto: `tsconfig.json` tiene `"files": []` y usa project references,
> así que no chequea nada y siempre sale 0. El comando válido es **`tsc -b`**
> (lo que ya hacía `npm run build`). Al correrlo aparecieron errores reales.
> Cualquier verificación futura debe usar `tsc -b`, nunca `tsc --noEmit`.

> ⚠️ **Sobre el número de gaps.** `match.cjs` es análisis estático y no resuelve
> endpoints armados con variables (`${API_URL}/admin/${endpoint}/${id}`) ni
> concatenaciones con `+`. Los 50 iniciales incluían ~19 falsos positivos.
> El conteo confiable sale de `verify-gap.cjs` más una pasada manual.

---

## 0. Veredicto

*(Diagnóstico original, previo a la implementación de §9. Ver §0-bis para el estado actual.)*

`frontendv-2` **no está al 100%**. Buildea (`vite build` OK), pero:

| Métrica | frontend (prod) | frontendv-2 | Cobertura |
|---|---:|---:|---:|
| Endpoints de backend consumidos | 229 | 191 | — |
| Endpoints de prod ausentes en v2 *(bruto, con falsos positivos)* | — | **50** | ~78 % |
| Endpoints de prod ausentes en v2 *(verificado a mano)* | — | **17** | — |
| Llamadas a rutas inexistentes en backend | 16 | 18 | — |
| LOC de lógica de negocio | 60.013 | 32.289 | ~54 % |

El `MIGRATION_STATUS.md` existente marca casi todo como `[x]`. **Ese documento sobreestima el avance**: varias pantallas marcadas como migradas existen como archivo pero con una fracción de la lógica (ver §3).

---

## 1. Bloqueantes (rompen funcionalidad hoy)

### B1 — El default de la URL de API apuntaba a test ✅ CORREGIDO
Confirmado con el equipo: **`360.cober.online` es producción, `wspflows.cober.online` es el entorno de test.**

`src/lib/config.ts:2` tenía:
```ts
const BASE = import.meta.env.VITE_API_BASE_URL ?? "https://wspflows.cober.online"
```
El **fallback** apuntaba a test. Un build sin `.env` (CI limpio, contenedor, checkout nuevo) habría publicado v2 contra la base de test sin ningún error visible.

Corregido: el default ahora es `https://360.cober.online`; test es opt-in vía `VITE_API_BASE_URL`. Documentado en `.env.example`. Tener `VITE_API_BASE_URL=https://wspflows.cober.online` en el `.env` local es correcto para desarrollo.

### B2 — CORS del backend no permite `PATCH` — 🟡 solo afecta dev/test
**Corrección respecto de la primera versión de este informe:** lo había clasificado como bloqueante de producción. No lo es.

`backend/server.js:60` → `methods: ['GET','POST','PUT','DELETE','OPTIONS']` (sin `PATCH`), y el backend expone 22 rutas `PATCH`.

Como v2 despliega en `/afiliaciones/` del mismo dominio que la API (igual que prod), **en producción es same-origin y no hay preflight** → `PATCH` funciona. El problema es real solo en desarrollo: `localhost:5173` → `wspflows.cober.online` **sí** es cross-origin, y ahí todo `PATCH` falla en preflight. v2 usa `PATCH` en 5 vistas (estado de póliza en backoffice y supervisor, `toggle-status` de supervisores/vendedores, estado de prospecto, restaurar póliza).

**Fix (1 línea, sin riesgo):** agregar `'PATCH'` a `methods` en `server.js:60`. Verificar además que el backend de test tenga `http://localhost:5173` en `allowedOrigins` (el de producción lo tiene).

### B3 — Doble `/api` en edición de pólizas del vendedor
`src/features/vendedor/components/EditarPolizaModal.tsx:98,360`
```ts
axios.get(`${API_URL}/api/polizas/vendedor/${polizaId}/editar`)     // API_URL ya termina en /api
axios.put(`${API_URL}/api/polizas/vendedor/${polizaId}/actualizar`)
```
Resuelve a `/api/api/polizas/...` → **404**. La edición de pólizas del vendedor está rota.
Rutas correctas: `GET /polizas/vendedor/:id/editar`, `PUT /polizas/vendedor/:id/actualizar`.

### B4 — Endpoints inventados en v2 (404 garantizado)

| Llamada en v2 | Ruta real en backend | Archivo |
|---|---|---|
| `/supervisor/polizas/:id/historial` | `/supervisor/polizas/:id/historial-estados` | `SupervisorPolizasView.tsx` |
| `/prospectos/:id/cotizaciones` | `/admin/...` o `/backoffice/prospectos/:id/cotizaciones` | `prospecto-detalle.tsx` |
| `/prospectos/:id/familiares` | no existe | `prospecto-detalle.tsx` |
| `/admin/reasignar-prospectos` | `/admin/vendedores/reasignar-prospectos` | `VendedoresAdmin.tsx` |
| `/admin/lista-precios/clonar` | no existe | `ListaPreciosAdmin.tsx` |
| `/backoffice/polizas/exportar` | usar `/export/...` | `BackofficePolizasView.tsx` |
| `/supervisor/polizas/documentos/:id/download` | no existe (sí `preview`) | `SupervisorPolizasView.tsx` |

### B5 — `CargaDocumentosModal` se rompe para admin
`src/components/modals/CargaDocumentosModal.tsx:58,98` construye `${API_URL}/${userRole}/polizas/...`. El backend expone `POST .../polizas/:id/documentos` para `vendedor`, `supervisor` y `backoffice`, pero para admin **solo existe `GET /admin/polizas/:polizaId/documentos`** — no hay POST. Un admin no puede subir documentos.

### B6 — Renovación de sesión inoperante en v2
`SessionManager.tsx:162,186` llama `POST /auth/renew-session`, que **no existe** (la ruta real es `POST /sessions/renew`). Prod tiene el mismo bug en `SessionManager.jsx:116`, **pero además** `AuthContext.jsx` sí llama `/sessions/renew`, así que en prod la renovación funciona por ese camino. En v2 ese camino no fue migrado → con `expiresIn: "2h"` en el JWT, **la sesión muere a las 2 h sin posibilidad de renovar**.

---

## 2. Seguridad

### S1 — 🔴 API key de terceros embebida en el bundle público
`frontendv-2/.env`:
```
VITE_ASISTENTE_API_KEY=fdd50275963f9e3a2b66bf6fe53ddc0bf8f1561e7d27a0c16cd596897871831c
```
Usada en `src/components/common/ManualWidget.tsx:39` como header `X-API-Key` en un `fetch` **directo desde el navegador**. Todo prefijo `VITE_` se inlinea en el JS servido → la clave queda legible por cualquier visitante.

Producción **no** hace esto: `ManualWidget.jsx:300` llama `${API_URL}/chatbot/mensaje` con el JWT del usuario y el backend actúa de proxy.

**Acción:** rotar la clave ya (asumirla comprometida), sacarla del front, y enrutar el asistente por el backend como en prod.

### S2 — 🟠 reCAPTCHA desactivado silenciosamente en v2
Prod fija la site key en `main.jsx:15`. v2 la lee de `VITE_RECAPTCHA_SITE_KEY`, **vacía** en `.env`, y `main.tsx` renderiza el árbol sin `GoogleReCaptchaProvider` cuando falta. El backend valida de forma condicional (`authController.js:111` → `if (recaptchaToken)`), así que el login sigue funcionando: la protección anti-bot simplemente desaparece sin error visible.

### S3 — 🟠 Secreto de reCAPTCHA hardcodeado en el backend
`backend/services/recaptchaService.js:10`
```js
SECRET_KEY: process.env.RECAPTCHA_SECRET || process.env.RECAPTCHA_SECRET_KEY || '6LdOVAkrAAAAAE9wKlwYjb5_UVE4S4lAc2t8ZBxg'
```
Secreto de servidor en el código fuente. Rotar y eliminar el fallback (que falle en arranque si no está configurado).

### S4 — 🟠 RBAC: v2 amplía privilegios en backoffice
| Ruta | prod (`ProtectedRoute.jsx`) | v2 (`routes.tsx`) |
|---|---|---|
| `/backoffice/*` | rol `[4]` estricto | `["backoffice","admin"]` |

El backend usa `authenticateBackOffice` (`role !== 4 → 403`) en parte de las rutas y `requireBackOfficeOrAdmin` en otras. Resultado en v2: el admin entra a una UI que carga a medias y dispara 403 dispersos. Alinear con prod (`[4]`) o unificar el backend a `requireBackOfficeOrAdmin` de forma deliberada.

### S5 — 🟡 Esquema de sesión incompatible entre ambos frontends
- prod escribe claves discretas: `cober_user_id`, `cober_user_role` (numérico), `cober_first_name`, `cober_last_name`, `cober_user_email`, `cober_sessionId`, `cober_loginTime`.
- v2 escribe un único blob JSON `cober_auth_user` con `role` **string** (`"vendedor"`, `"admin"`…) y nunca escribe las claves discretas.

`ProtectedRoute.jsx` de prod exige `cober_user_id` **y** `cober_user_role`. Por lo tanto, **una sesión iniciada en v2 no es válida en prod y viceversa**: cualquier despliegue gradual o rollback bajo el mismo origen expulsa al usuario al login. También difiere `fcm_token` (v2) vs `cober_fcm_token` (prod).

### S6 — 🟡 `logout` de v2 depende de claves legacy
`AuthContext.tsx:171-173` lee `localStorage.getItem("token")` y `"auth_user"` (sin prefijo) para decidir si cierra sesión en el backend. Si solo existen las claves `cober_*`, se saltea **desregistro de FCM, `logout-activity` y `POST /sessions/end`** — la sesión queda abierta en la base y el token FCM sigue recibiendo push. Debe leer `cober_token` / `cober_auth_user`.

### S7 — 🟡 Redirección post-401 ignora el `basename`
`src/lib/api.ts:38` → `window.location.assign("/login")`, pero la app monta en `basename="/afiliaciones"`. Debe ser `/afiliaciones/login`.

### Lo que sí está bien (backend)
- Helmet, `express-rate-limit` (`apiLimiter`, `failedAttemptLimiter`, `notificationLimiter`), sanitización (`sanitizeInput`, `sanitizeInputs`, `preventSQLInjection`), detección de IP sospechosa y `securityLogger` aplicados globalmente con exclusión explícita de webhooks.
- JWT con secreto en entorno y `expiresIn: "2h"`.
- CORS con whitelist real (no `*`) y `credentials: true`.

---

## 3. Paridad funcional — componentes que existen pero son cascarones

`MIGRATION_STATUS.md` los marca como migrados. La comparación de LOC + endpoints dice otra cosa:

| Componente | prod | v2 | Estado real |
|---|---:|---:|---|
| `WhatsAppChat` → `WhatsAppChatDialog` | 1.014 | **17** | Solo envuelve `WhatsAppVista` en un `Dialog`. Se perdieron plantillas, estado de conversación y estadísticas (`/chat/plantillas`, `/chat/conversaciones/:id/estado`, `/chat/estadisticas`). |
| `ChatWidget` | 292 | **32** | **No es el mismo componente.** Prod es un chatbot contra `/chatbot/mensaje`; v2 es un link estático a `wa.me` con teléfono placeholder `5491100000000`. |
| `ManualWidget` | 857 | 136 | Reducido + fuga de API key (S1). |
| `PolizaForm` (6 pasos) | 684 + 4.323 en 6 `Paso*.jsx` | **776** | Ver §3.1. |
| `ListaPreciosAdmin` | 1.135 | 359 | Faltan `aumentar/todos`, `disminuir/todos`, `template`, `tipos-familia`. |
| `RefritosAdmin` (+3 subcomponentes) | 1.488 | 352 | Faltan `reporte-vendedores` y `eliminar-flujo`. |
| `VendedoresAdmin` | 1.358 | 626 | Faltan `asignar-supervisor`, `toggle-status`, `reasignar-prospectos`, `DELETE /admin/vendedores/:id`. |
| `UsuariosAdmin` | 1.525 | 783 | Faltan `enable-user`, `disable-user`, `resend-verification`. |
| `SupervisorDashboard` | 2.693 | 896 | Falta el chat de supervisor (`/supervisor/chat/conversaciones`, `/supervisor/chat/mensajes/:id`). |
| `ProspectosDashboard` | 3.671 | 1.256 | Faltan `POST /prospectos`, `/tipos_afiliacion`, documentos de póliza del vendedor (`/vendedor/polizas/...`), `enviar-whatsapp`. |

### 3.1 `PolizaForm` — el gap más grave
Prod: orquestador + `PasoDatosPersonales` (1.100), `PasoIntegrantesDocumentos` (748), `pasoReferencias`, `PasoSaludTerminos` (1.055), `PasoDeclaracionJurada` (546), `PasoResumen` (874).
v2: un solo archivo de 776 líneas con `renderPaso1..6`.

Faltan, verificado por endpoint:
- **`GET /polizas/vendedor/verificar-numero-poliza`** — control de número de póliza duplicado. Su ausencia es un **riesgo de integridad de datos**, no solo de UI.
- `PUT /polizas/:id/temporal` — guardado de borrador. Sin esto se pierde el trabajo a medio cargar.
- `POST /polizas/:id/enviar-email` y `POST /polizas/:id/enviar-whatsapp` — entrega de la póliza al cliente desde el resumen.
- La declaración jurada de prod maneja `preguntas[]` + `datos_fisicos` (peso/altura por integrante). Conviene validar campo por campo contra `PasoDeclaracionJurada.jsx` y `EditarPolizaModal.jsx:24`.

### 3.2 Componentes de prod sin equivalente en v2
- `ValidacionWhatsappAdmin.jsx` (607) + `ValidacionConversacionModal.jsx` — **módulo completo ausente**. El backend lo soporta (`/admin/validacion-whatsapp/*`, migraciones `20260710_validador_whatsapp.sql`, `20260724_estados_urgencia_validacion.sql`).
- `CotizacionesPorUsuario` / `CotizacionesTable` / `CotizacionesCard` — falta `/cotizaciones/todas` y `/supervisor/cotizaciones/:id`.
- `SupervisorResumen` (`/supervisor/resumen`): en v2 la ruta `/supervisor-resumen` redirige al dashboard genérico.
- `VendedoresSupervisor`: faltan `enable-vendedor` / `disable-vendedor` / `/supervisor/metricas`.
- `CargaMultipleDocumentos`: faltan `/supervisor/polizas/:id/documentos/multiple` y `.../documentos/estadisticas`.
- `FormularioLead`: falta `/lead/:id/preferencia-entrega`.
- `ProspectoDetalle`: falta `/cupones-pago/:id/reenviar-whatsapp`.
- `notificationsService`: faltan `/fcm/test` y `/fcm/tokens`.

*(Lista completa de los 50 endpoints en §7.)*

---

## 4. DevOps / build / PWA

| Ítem | Estado |
|---|---|
| `tsc --noEmit` | ✅ 0 errores |
| `vite build` | ✅ OK en 15,7 s |
| `base: "/afiliaciones/"` | ✅ correcto |
| Lazy loading de rutas | ✅ hecho (`routes.tsx` usa `React.lazy`) — el `MIGRATION_STATUS.md` lo marca pendiente, ya está |
| **`copyFirebaseSwPlugin`** | ❌ **ausente en `vite.config.ts`** |
| `__APP_VERSION__` | ❌ ausente (prod lo define desde `package.json`) |
| `firebase-app.compat.js` / `firebase-messaging.compat.js` en `public/` | ❌ ausentes (v2 los toma de CDN gstatic — revisar CSP) |
| Variables `VITE_FIREBASE_*` | ❌ **todas vacías** en `.env` → FCM no arranca |
| **`frontendv-2` en el pipeline de deploy** | ❌ **no existe** |

### 4.1 El CI/CD no conoce `frontendv-2`
`scripts/deploy.sh:130-140` solo hace `npm ci && npm run build` de `frontend/`. No hay ninguna referencia a `frontendv-2` en el script de deploy ni en `.github/`. Antes de cualquier salida a producción hay que:
- agregar el build de `frontendv-2` al pipeline,
- decidir cómo conviven los dos `dist/` mientras dure la transición (ambos declaran `base: "/afiliaciones/"`, así que **se pisan**),
- inyectar las variables `VITE_*` en el entorno de build de CI (hoy dependen de un `.env` local que `deploy.sh` excluye del rsync con `--exclude='.env'`).

**Sobre el service worker:** `frontend/vite.config.js` copia `firebase-messaging-sw.js` a `dist/` **y a `/var/www/360/`** para que nginx lo sirva desde la raíz del dominio. El SW de FCM **debe** estar en la raíz para tener scope global. `frontendv-2/vite.config.ts` no hace nada de esto → las **notificaciones push en background no van a funcionar** aunque se completen las credenciales.

**Bundle:** `AdminDashboardPage` 406 kB y `recharts-vendor` 431 kB sin comprimir. Vale la pena partir `AdminDashboardPage` por tab.

---

## 5. Base de datos

Sin hallazgos bloqueantes. La disciplina de acceso a datos es buena.

- **Pool** (`config/db.js`): `connectionLimit: 50`, `queueLimit: 100`, `connectTimeout: 30000`, `multipleStatements: false` ✅, `dateStrings: true` (evita corrimientos de zona horaria) ✅.
- **Inyección SQL: no se encontró ninguna vía explotable.** Se revisaron las 27 construcciones dinámicas de SQL sobre 82 archivos con queries:
  - `${fechaFiltro}` (controllers de supervisor/backoffice/admin) → whitelist de `switch` + `parseInt`. Seguro.
  - `LIMIT ${limitNum}` (`ReAsignacionAutomatica.js:204`) → `Math.max(1, parseInt(...) || 20)`. Seguro.
  - `${whereConditions.join(' AND ')}`, `${placeholders}` → fragmentos construidos en servidor con valores por `?`. Seguro.
- **Hardening recomendado (no es vulnerabilidad hoy):** `services/chatService.js:544`
  ```js
  LIMIT ${filtros.limit || 50} OFFSET ${filtros.offset || 0}
  ```
  Es seguro **solo** porque el único llamador (`controllers/vendedor/chatController.js:11-13`) hace `parseInt(...)`. Es una interpolación sin defensa propia: cualquier llamador futuro que pase el query param crudo abre una inyección. Sanear dentro del servicio.
- **Migraciones:** ~40 archivos `.sql`/`.js` en `backend/migrations/`, con nombres fechados y coherentes, pero **sin runner ni tabla de control de versiones**. No hay forma de saber qué se aplicó en cada entorno. Es el riesgo de datos más concreto del proyecto: incorporar un runner (`db-migrate`, `umzug` o similar) con tabla `schema_migrations`.

---

## 6. Bugs preexistentes que v2 **replica** (arreglar en ambos)

No son regresiones de v2, pero conviene resolverlos de una vez:

1. `POST /auth/renew-session` → no existe (es `/sessions/renew`).
2. `/performance/*` → **deshabilitado** en `server.js:296-297` (comentado). `MonitoringDashboard` está muerto en los dos frontends.
3. `/admin/lista-precios/importar` → no existe.
4. `/admin/vendedores-sin-supervisor` → la ruta real es `/backoffice/vendedores-sin-supervisor`.
5. `/nacionalidades` → `nacionalidadRoutes` comentado en `server.js:304`.
6. `/api/vafirma/estado/:id` → no coincide con ninguna ruta montada de vafirma; verificar contra `vafirmaRoutes.js`.
7. `/api/whatsapp/plantillas` y familia (`saludo-inicial`, `cierre-conversacion`, …) → no matchean `whatsappPlantillasRoutes`; verificar.

---

## 7. Los 50 endpoints faltantes en v2

Todos existen en el backend y son consumidos por producción.

**Admin (17)**
```
GET    /admin/categorias/estadisticas
PUT    /admin/disable-user/:id
PUT    /admin/enable-user/:id
POST   /admin/resend-verification/:id
GET    /admin/documentos/estadisticas
PUT    /admin/lista-precios/aumentar/todos
PUT    /admin/lista-precios/disminuir/todos
GET    /admin/lista-precios/template
POST   /admin/refritos/eliminar-flujo
GET    /admin/refritos/reporte-vendedores
GET    /admin/validacion-whatsapp/prospectos/:id/conversacion
DELETE /admin/vendedores/:id
PATCH  /admin/vendedores/:id/toggle-status
POST   /admin/vendedores/asignar-supervisor
POST   /admin/vendedores/reasignar-prospectos
GET    /admin/whatsapp/conversacion/:id/mensajes
GET    /admin/whatsapp/conversaciones/:id
```

**Supervisor (11)**
```
GET    /supervisor/resumen
GET    /supervisor/chat/conversaciones
GET    /supervisor/chat/mensajes/:id
GET    /supervisor/cotizaciones/:id
PUT    /supervisor/disable-vendedor/:id
PUT    /supervisor/enable-vendedor/:id
GET    /supervisor/polizas/:id/documentos/estadisticas
POST   /supervisor/polizas/:id/documentos/multiple
GET    /supervisor/polizas/documentos/:id
PUT    /supervisor/polizas/documentos/:id/actualizar
GET    /supervisor/polizas/documentos/:id/preview
```

**Vendedor / pólizas (9)**
```
POST   /prospectos
GET    /tipos_afiliacion
GET    /polizas/vendedor/verificar-numero-poliza
PUT    /polizas/:id/temporal
POST   /polizas/:id/enviar-email
POST   /polizas/:id/enviar-whatsapp
GET    /polizas/:id/historial-estados
PUT    /polizas/documentos/:id/actualizar
GET    /vendedor/polizas/:id/documentos
```
*(+ `/vendedor/polizas/documentos/:id/download` y `/preview`)*

**Chat / WhatsApp / chatbot (5)**
```
GET    /chat/plantillas
GET    /chat/estadisticas
PATCH  /chat/conversaciones/:id/estado
POST   /chatbot/mensaje
GET    /backoffice/polizas/prospectos/:id/conversaciones
```

**Otros (6)**
```
GET    /cotizaciones/todas
GET    /cotizaciones/tipos-familia
POST   /cupones-pago/:id/reenviar-whatsapp
PUT    /lead/:id/preferencia-entrega
POST   /fcm/test
GET    /fcm/tokens
POST   /sessions/renew
```

---

## 8. Plan de cierre

### Fase 0 — Seguridad, hoy (½ día)
1. Rotar `VITE_ASISTENTE_API_KEY` y `RECAPTCHA_SECRET`. Asumir ambas comprometidas.
2. Mover el asistente detrás del backend (`/chatbot/mensaje`), como prod. Quitar la key del front.
3. Quitar el fallback hardcodeado de `recaptchaService.js:10`; fallar en arranque si falta.
4. Cargar `VITE_RECAPTCHA_SITE_KEY` en v2.
5. Alinear `/backoffice/*` a rol `[4]`.

### Fase 1 — Desbloqueo (1–2 días)
6. ~~Definir `VITE_API_BASE_URL`~~ ✅ hecho: default a producción (`360.cober.online`), test opt-in.
7. Agregar `'PATCH'` a `methods` en el CORS del backend (desbloquea desarrollo local contra test).
8. Corregir el doble `/api` (B3) y los 7 endpoints inventados (B4).
9. Arreglar `logout` (S6), redirect 401 con basename (S7), y renovación de sesión vía `/sessions/renew` (B6).
10. Unificar el esquema de `localStorage` con prod (S5) — condición necesaria para cualquier rollout gradual o rollback.

### Fase 2 — Paridad funcional (2–3 semanas)
11. **`PolizaForm` completo** (prioridad máxima: `verificar-numero-poliza` es integridad de datos).
12. `WhatsAppChat` real (1.014 LOC) y `ManualWidget` / `ChatWidget` contra `/chatbot/mensaje`.
13. Módulo `ValidacionWhatsappAdmin` + `ValidacionConversacionModal`.
14. Completar los 50 endpoints de §7, por dominio: admin → supervisor → vendedor → chat.
15. `SupervisorResumen`, cotizaciones de supervisor, `CargaMultipleDocumentos`.

### Fase 3 — DevOps y verificación (3–5 días)
15b. **Agregar `frontendv-2` a `scripts/deploy.sh`** y resolver la colisión de `base: "/afiliaciones/"` entre los dos builds (§4.1). Inyectar las `VITE_*` desde el entorno de CI, no desde un `.env` local.
16. Portar `copyFirebaseSwPlugin` y `__APP_VERSION__` a `vite.config.ts`; completar `VITE_FIREBASE_*`; **probar push en background real**.
17. Runner de migraciones con `schema_migrations`.
18. Habilitar o borrar `/performance/*`; decidir sobre `MonitoringDashboard`.
19. Partir `AdminDashboardPage` (406 kB) por tab.
20. Smoke test end-to-end por rol (1/2/3/4) contra staging, con el listado de §7 como checklist.

### Recomendación de rollout
No hacer big-bang. Publicar v2 en una ruta paralela (`/afiliaciones-v2`) con los 4 roles en staging, cerrar §7 con checklist, y recién entonces cambiar el `base`. **El punto 10 (esquema de `localStorage`) es la condición sine qua non del rollback**: sin eso, volver a prod desloguea a todos.

---

## Apéndice — Cómo se reprodujo

Los scripts de extracción y cruce quedaron versionados en `frontendv-2/tools/paridad/`:
- `extract-backend.cjs` — recorre `server.js`, resuelve `require`s relativos, sigue `app.use`/`router.use` (incluido `require` inline) y **descarta comentarios** para no contar rutas deshabilitadas. Salida: `backend-routes.json` (594 rutas).
- `match.cjs` — extrae toda llamada `axios.*` / `api.*` / `fetch` de ambos frontends, normaliza template literals e interpolaciones a `:p`, canoniza el prefijo `/api` y cruza contra el set del backend.

Reproducir tras cada cambio para medir el avance (el número que importa es el del tercer bloque):

```bash
cd frontendv-2/tools/paridad && node extract-backend.cjs && node match.cjs
```

Salida actual:
```
===== frontend (PRODUCCION): 229 endpoints, 16 SIN ruta backend =====
===== frontendv-2: 191 endpoints, 18 SIN ruta backend =====
===== GAP REAL: endpoints backend usados en PROD y NO en V2 (50) =====
```

**Objetivo de paridad: el GAP REAL debe llegar a 0.**

Nota: son `.cjs` porque `frontendv-2/package.json` declara `"type": "module"`.

---

## 9. Registro de implementación — 2026-08-11

### Fase 0 — Seguridad ✅

| # | Cambio | Archivo |
|---|---|---|
| S1 | Asistente movido al backend (`POST /chatbot/mensaje`) con JWT del usuario. **API key eliminada del cliente.** Verificado: el hash ya no aparece en `dist/`. | `components/common/ManualWidget.tsx`, `lib/config.ts`, `.env` |
| S2 | reCAPTCHA con site key por defecto igual a producción | `lib/config.ts`, `main.tsx` |
| S3 | Eliminado el fallback hardcodeado del secreto reCAPTCHA | `backend/services/recaptchaService.js` |
| S4 | `/backoffice/*` restringido a rol 4 estricto, como prod | `app/routes.tsx` |

> 🔑 **Pendiente tuyo:** rotar `VITE_ASISTENTE_API_KEY` y `RECAPTCHA_SECRET`.
> El código ya no las expone, pero ambas estuvieron en el repo y hay que
> asumirlas comprometidas. Además `RECAPTCHA_SECRET` ahora es obligatoria en el
> entorno del backend: sin ella la validación devuelve `SERVICE_UNAVAILABLE`.

### Fase 1 — Sesión, auth y endpoints rotos ✅

| # | Cambio | Archivo |
|---|---|---|
| S5 | **Esquema de sesión unificado con prod.** `lib/auth.ts` reescrito como fuente única: escribe las claves discretas `cober_user_id`/`cober_user_role`(numérico)/etc. **y** el blob JSON. Sesiones ahora interoperables en ambos sentidos → rollback seguro. | `lib/auth.ts`, `contexts/AuthContext.tsx` |
| S6 | `logout` lee del esquema unificado; ya no se saltea `sessions/end`, `logout-activity` ni el desregistro de FCM | `contexts/AuthContext.tsx` |
| S7 | Redirect de 401 respeta el `basename` | `lib/api.ts`, `lib/config.ts` |
| B3 | Doble `/api` corregido → edición de pólizas del vendedor funciona | `EditarPolizaModal.tsx` |
| B6 | Renovación de sesión apunta a `POST /sessions/renew` (la ruta real) | `SessionManager.tsx` |
| — | Token FCM unificado a `cober_fcm_token`; agregados `/fcm/tokens` y `/fcm/test` | `services/notificationsService.ts`, `lib/auth.ts` |
| — | `PATCH` agregado al CORS del backend | `backend/server.js` |
| — | **`dashboardAdminRoutes` montado**: el router existía pero nunca se montaba, por eso `/admin/vendedores-sin-supervisor` daba 404 en *ambos* frontends | `backend/server.js` |
| — | `reasignar-prospectos` → ruta correcta `/admin/vendedores/reasignar-prospectos` | `VendedoresAdmin.tsx` |
| — | Ajuste masivo de precios → `PUT /aumentar/todos` y `/disminuir/todos` (usaba POST a rutas inexistentes) + validaciones de prod | `ListaPreciosAdmin.tsx` |
| — | Cotizaciones del prospecto vía `/lead/:id/cotizaciones` (se quitó la llamada fantasma) | `prospecto-detalle.tsx` |
| — | `agregarFamiliar` persiste vía `PUT /prospectos/:id` + recotización, con las 3 reglas de negocio de prod | `prospecto-detalle.tsx` |
| — | Export CSV de backoffice generado en cliente (el endpoint no existe) | `BackofficePolizasView.tsx` |
| — | "Clonar año" **removido**: endpoint inexistente y prod no lo tiene | `ListaPreciosAdmin.tsx` |

### Fase 3 — Build y PWA ✅

- `copyFirebaseSwPlugin` portado → el SW de FCM se copia a `dist/` y a `/var/www/360/`. **Verificado en el build.**
- `__APP_VERSION__` definido + `src/vite-env.d.ts`; versión visible en el sidebar como en el NavBar de prod.
- **`.env.production` versionado** con `VITE_API_BASE_URL=https://360.cober.online`: un build de producción ya no puede salir apuntando a test aunque el `.env` local diga `wspflows`. Verificado en el bundle.

### Fase 2 — Paridad funcional 🚧 parcial

Cerrados: `verificar-numero-poliza` (con debounce y bloqueo de avance),
`/polizas/:id/enviar-email` y `/enviar-whatsapp`, `/polizas/:id/historial-estados`
(con modal de línea de tiempo), `/admin/resend-verification/:id`,
`/cupones-pago/:id/reenviar-whatsapp`.

**Quedan 13 gaps.** No son cableado de endpoints: son componentes por construir.

| Gap | Dónde | Tamaño |
|---|---|---|
| `/admin/validacion-whatsapp/...` | Módulo `ValidacionWhatsappAdmin` + `ValidacionConversacionModal` **no existen** en v2 | ~700 LOC |
| `/chat/plantillas`, `/chat/estadisticas` | `WhatsAppChat` real (v2 tiene un stub de 17 líneas) | ~1.000 LOC |
| `/supervisor/resumen` | `SupervisorResumen` — hoy `/supervisor-resumen` redirige al dashboard | media |
| `/supervisor/cotizaciones/:id`, `/cotizaciones/todas` | `CotizacionesPorUsuario` / `CotizacionesTable` / `CotizacionesCard` | media |
| `/supervisor/chat/mensajes/:id` | Chat del supervisor dentro de `SupervisorDashboard` | media |
| `/admin/refritos/reporte-vendedores`, `/eliminar-flujo` | `EstadisticasRefritos` (prod: 737 LOC; v2 lo tiene condensado) | media |
| `/admin/categorias/estadisticas` | `GestionCategorias` | chica |
| `/admin/documentos/estadisticas` | `PolizasAdmin` | chica |
| `/cotizaciones/tipos-familia` | `ListaPreciosAdmin` | chica |
| `/lead/:id/preferencia-entrega` | `FormularioLead` | chica |
| `/backoffice/polizas/prospectos/:id/conversaciones` | `BackofficePolizasView` | chica |

Además, sin reflejo en endpoints pero con diferencia real de profundidad:
`PolizaForm` (prod reparte ~5.000 LOC en 6 pasos; v2 tiene 830) y `ManualWidget`.

### Cómo medir el avance

```bash
cd frontendv-2/tools/paridad && node extract-backend.cjs && node match.cjs > gap-actual.txt && node verify-gap.cjs gap-actual.txt
```

Y siempre verificar con **`npx tsc -b`**, no con `tsc --noEmit`.

---

## 10. Backlog para paridad total con shadcn

Inventario verificado el 2026-08-11 comparando pantalla contra pantalla
(no por nombre de archivo: por superficie funcional real).

### A. Módulos que directamente no existen en v2

| Módulo | Prod | Qué hace | Esfuerzo |
|---|---:|---|---|
| `ValidacionWhatsappAdmin` + `ValidacionConversacionModal` | 748 LOC | Validación de prospectos por WhatsApp. El backend lo soporta entero (`/admin/validacion-whatsapp/*`, migraciones `20260710_validador_whatsapp.sql`, `20260724_estados_urgencia_validacion.sql`). | Alto |
| `WhatsAppChat` | 1.014 LOC | Chat real: plantillas, estado de conversación, estadísticas. **v2 tiene un stub de 17 líneas.** | Alto |
| `CotizacionesPorUsuario` + `CotizacionesTable` + `CotizacionesCard` | 471 LOC | Cotizaciones del supervisor (`/cotizaciones/todas`, `/supervisor/cotizaciones/:id`). | Medio |
| `SupervisorResumen` | 236 LOC | `/supervisor/resumen`. Hoy `/supervisor-resumen` redirige al dashboard genérico. | Medio |
| Refritos: `EstadisticasRefritos` + `CargarRefritos` + `HistoricoRefritos` | 1.488 LOC | v2 los condensa en `RefritosAdmin.tsx` (352 LOC). Faltan `reporte-vendedores` y `eliminar-flujo`. | Medio |

### B. Funcionalidad faltante dentro de pantallas que sí existen

| Pantalla | LOC prod → v2 | Qué falta |
|---|---|---|
| `ProspectosDashboard` | 3.672 → 1.257 | Documentos de póliza del vendedor (listar / preview / download / actualizar), enviar póliza por WhatsApp, promociones del vendedor, apertura de PDF |
| `WhatsAppVista` | 1.121 → 481 | **Adjuntos multimedia** (imagen, audio, video, PDF, Office — prod acepta 15 MIME types), `/chat/estadisticas` |
| `SupervisorDashboard` | 2.694 → 897 | Chat del supervisor completo: `/supervisor/chat/conversaciones`, `/mensajes/:id`, `/conversaciones/prospecto/:id` |
| `ProspectosAdmin` | 1.971 → 762 | Ver conversación de WhatsApp del prospecto (`/admin/whatsapp/conversaciones/:id` + `/conversacion/:id/mensajes`) |
| `PolizasSupervisor` | 2.158 → 821 | Filtro por mes (`/supervisor/polizas/estadisticas/meses`) |
| `FormularioLead` | 838 → 462 | `/lead/:id/preferencia-entrega`, recuperar cotizaciones del lead |
| `GestionCategorias` | 660 → 309 | `/admin/categorias/estadisticas`, listado de vendedores del supervisor |
| `ListaPreciosAdmin` | 1.136 → 360 | `/cotizaciones/tipos-familia` |
| `PolizasAdmin` | 883 → 452 | `/admin/documentos/estadisticas` |
| `PolizasBackOffice` | 1.829 → 1.207 | `/backoffice/polizas/prospectos/:id/conversaciones` |
| `VendedoresSupervisor` | 1.325 → 836 | `/supervisor/metricas` |
| `ProspectoDetalle` | 2.502 → 1.184 | `/localidades/buenos-aires`, promociones del vendedor |
| `PolizaForm` | ~5.000 (6 pasos) → 830 | Paridad campo por campo, sobre todo la declaración jurada (`preguntas[]` + `datos_fisicos` con peso/altura por integrante) y `PUT /polizas/:id/temporal` (guardado de borrador) |
| `ManualWidget` | 857 → 136 | Historial de conversación, contexto por rol, sugerencias |

### C. Deuda específica de shadcn

Esto es lo que hace que v2 todavía **no se sienta** como una app shadcn:

1. **12 `confirm()` nativos del navegador.** Producción usa 286 diálogos SweetAlert2 con estilo propio; v2 los reemplazó por el `confirm()` gris del navegador en:
   `GestionCategorias` (×2), `MonotributoAdmin`, `PolizasAdmin` (×3), `PrestadoresAdmin`,
   `PromocionesAdmin`, `ProspectosAdmin`, `VendedoresAdmin`, `BackofficePolizasView`, `BackofficePromocionesView`.
   → Falta la primitiva **`alert-dialog`**. Es el gap visual más visible y el más barato de cerrar.

2. **Primitivas shadcn ausentes** que el resto del backlog necesita:
   - `alert-dialog` — confirmaciones destructivas (punto 1)
   - `form` — validación con `react-hook-form` + `zod`. Hoy toda la validación es manual (`PolizaForm`, `FormularioLead`, altas de admin). Sin esto la paridad de validaciones de `PolizaForm` se vuelve muy verbosa.
   - `pagination` — prod pagina en 10 pantallas, v2 en 5.

3. **`@tanstack/react-table` está en `package.json` pero no se usa en ningún lado.**
   El `MIGRATION_STATUS.md` afirma "data-table (con TanStack Table) ✅" — **es falso**, no existe `components/ui/data-table.tsx`. O se implementa el data-table (ordenamiento, filtros y paginación uniformes en ~15 tablas) o se saca la dependencia.

### D. Orden sugerido

1. `alert-dialog` + reemplazar los 12 `confirm()` → 1 día, alto impacto visual.
2. `data-table` con TanStack + `pagination`, y migrar las tablas grandes → base para el resto.
3. `form` (react-hook-form + zod) → habilita el punto 6.
4. Endpoints sueltos del bloque B (los de una línea) → 1-2 días.
5. Chat del supervisor + conversaciones de WhatsApp en admin/backoffice → comparten componente, conviene hacerlos juntos.
6. `PolizaForm` completo con `form` + borrador temporal.
7. `WhatsAppChat` real con adjuntos multimedia.
8. `ValidacionWhatsappAdmin`.
9. `SupervisorResumen` + cotizaciones del supervisor.
10. Refritos completos.

**Estimación total: 3 a 4 semanas** de trabajo enfocado.

---

## 11. Cierre del backlog §10 — implementado

Verificado con `npx tsc -b` y `npm run build` en verde.

### Bloque C — deuda shadcn ✅

| Ítem | Resultado |
|---|---|
| `alert-dialog` | Creada + `ConfirmProvider`/`useConfirm` promisificado en `components/common/confirm-dialog.tsx`, montado en `main.tsx` |
| 12 `confirm()` nativos | **0 restantes.** Reemplazados en GestionCategorias (×2), MonotributoAdmin, PolizasAdmin (×3), PrestadoresAdmin, PromocionesAdmin, ProspectosAdmin, VendedoresAdmin, BackofficePolizasView, BackofficePromocionesView |
| `pagination` | Creada |
| `data-table` | Creada con TanStack (orden, filtro global, paginación, toggle de columnas). **`@tanstack/react-table` pasó de dependencia muerta a usada** |
| `form` | Creada + instalados `react-hook-form`, `zod`, `@hookform/resolvers` |

### Bloque A — módulos que no existían ✅

| Módulo | Archivo |
|---|---|
| **ValidacionWhatsappAdmin** | `features/admin/components/ValidacionWhatsappAdmin.tsx` + `ValidacionConversacionModal.tsx`. Config (activo/cupo), métricas, gráfico por estado, listado paginado con filtros y visor de conversación. Enlazado en el sidebar del admin |
| **Chat del supervisor** | `features/supervisor/components/SupervisorChatView.tsx` — listado + hilo. Nueva pestaña "Chat" |
| **SupervisorResumen** | `features/supervisor/components/SupervisorResumenView.tsx` con `CountUp` animado y gráfico por estado. `/supervisor-resumen` ahora abre directo en esa vista |
| **Cotizaciones del supervisor** | `features/supervisor/components/SupervisorCotizacionesPorUsuario.tsx` — reemplaza a los 3 componentes de prod. Incluye la regla de "descuento negativo = incremento" |
| **Visor de conversaciones WhatsApp** | `components/common/ConversacionWhatsappModal.tsx`, parametrizado por rol. Reemplaza el visor que prod duplica en 3 pantallas. Enlazado en ProspectosAdmin |

### Bloque B — endpoints por pantalla ✅

`tipos-familia`, `categorias/estadisticas` + `supervisor/vendedores`, `documentos/estadisticas`,
`estadisticas/meses` (filtro por mes), `supervisor/metricas` (KPIs del equipo),
`lead/:id/preferencia-entrega` (modal de 3 canales + WhatsApp del validador),
`lead/:id/cotizaciones`, `backoffice/polizas/prospectos/:id/conversaciones`,
`localidades/buenos-aires` (localidad pasa de texto libre a select),
`refritos/reporte-vendedores` (nueva pestaña) y `refritos/eliminar-flujo`,
`admin/resend-verification`, `cupones-pago/:id/reenviar-whatsapp`,
`polizas/:id/enviar-email` y `/enviar-whatsapp`, `polizas/:id/historial-estados`,
`polizas/vendedor/verificar-numero-poliza`, `chat/estadisticas`,
`chat/conversaciones/:id/estado`.

**Adjuntos de WhatsApp:** validación de 100 MB y los 20 tipos MIME de prod
(antes v2 aceptaba cualquier archivo con `accept="image/*,.pdf,…"` y sin validar).

### Bugs encontrados durante la implementación

1. **Doble `/api` en plantillas de WhatsApp** — `${API_URL}/api/whatsapp/plantillas`.
   Bug heredado de prod: siempre caía al catálogo por defecto. Corregido en v2.
2. **Alta de prospecto: 3 desenlaces colapsados en uno.** El backend distingue
   *reasignado a vos* / *en gestión de otro* / *nuevo*, y en los dos primeros
   devuelve el `prospectoId` que el vendedor necesita para escalar al back office.
   v2 mostraba `toast.warning("Prospecto duplicado detectado")` y descartaba el ID.
   Ahora hay un diálogo con los tres casos, los días de estancamiento y el ID.
3. **`GET /vendedor/promociones` en ProspectoDetalle es código muerto en prod**
   (el bloque que las renderiza está comentado en `ProspectoDetalle.jsx:1498`).
   No se replicó: era una request por render sin consumidor.

### Estado final medido

```
frontend (PRODUCCIÓN): 229 endpoints,  15 sin ruta backend
frontendv-2:           216 endpoints,  10 sin ruta backend
```

v2 pasó de **191 → 216** endpoints consumidos y de **18 → 10** llamadas a rutas
inexistentes. El GAP bruto bajó de 50 a 25, y de esos 25 hay 17 falsos positivos
del análisis estático más 8 verificados a mano como implementados
(rutas dinámicas tipo `${API_URL}/admin/${endpoint}/${id}`).

### Lo que queda

- **`PolizaForm`**: tiene los 6 pasos y ya se le agregó `verificar-numero-poliza`,
  envío por email/WhatsApp y las validaciones de paso. Falta la paridad campo por
  campo de la **declaración jurada** (`preguntas[]` + `datos_fisicos` con peso y
  altura por integrante) y el **guardado de borrador** (`PUT /polizas/:id/temporal`).
- **Migrar las ~15 tablas al `data-table` nuevo.** La primitiva está lista pero las
  pantallas siguen con sus tablas a mano.
- **Migrar los formularios a la primitiva `form` + zod.** Hoy la validación sigue
  siendo manual.
- Nada de esto rompe funcionalidad: son deuda de consistencia, no gaps de features.

---

## 12. Barrido de UI y componentes montados

Este pase buscó lo que el cruce de endpoints **no** ve: pantallas, controles y
componentes que existen en el código pero nunca se renderizan.

### 12.1 Componentes que existían pero nunca se montaban

Nueve archivos de v2 no tenían **ninguna** referencia. Es decir: la funcionalidad
estaba escrita pero era inalcanzable desde la app.

| Componente | Qué pasaba | Resolución |
|---|---|---|
| `PWAStatus` | Prod lo monta en `App.jsx:170`; v2 no | **Montado** en `App.tsx` |
| `BotonEliminarPoliza` | Prod lo usa en `PolizasBackOffice.jsx` (×2) | **Cableado** en `BackofficePolizasView` |
| `SubirDocumentosLibresModal` | Prod lo usa en backoffice y supervisor | **Cableado** en ambas |
| `DocumentPreviewModal` | Prod lo usa en admin y supervisor | **Cableado** en `SupervisorPolizasView` |
| `ConfirmarDatosProspectoModal` | v2 ya tiene el diálogo inline en `BotonEnviarFirma` | Eliminado (duplicado) |
| `BotonConsultarFirma` | Huérfano **también en prod** | Eliminado |
| `ChatWidget` | Stub de `wa.me`; el de prod está **comentado** (`SupervisorDashboard.jsx:2688`) | Eliminado |
| `WhatsAppChatDialog` | Wrapper sin uso | Eliminado |
| `SupervisorCotizacionesView` | Reemplazado por `SupervisorCotizacionesPorUsuario` | Eliminado |

**Estado final: 0 componentes huérfanos.**

### 12.2 🔴 Preview y descarga de documentos rotos por 401

`SupervisorPolizasView` y `CargaDocumentosModal` abrían documentos con
`window.open(url)`. Una pestaña nueva **no puede enviar el header
`Authorization`**, y `authenticateToken` del backend sólo lee ese header
(`authMiddleware.js:8`) — no acepta el token por query string.

Resultado: **la previsualización y la descarga de documentos devolvían 401**
para supervisor y en el modal compartido de carga.

Producción no tiene el problema porque baja el archivo con
`axios … responseType: 'blob'` (`PolizasSupervisor.jsx:469`), que sí manda el header.

Creado `lib/documentos.ts` con `abrirDocumentoProtegido()` y
`descargarDocumentoProtegido()`, y aplicado en los 3 puntos.

> `/polizas/:id/pdf` y `/polizas/pdf/:hash` se dejaron con `window.open`: el
> backend las declara **sin autenticación a propósito** (`polizaRoutes.js:51`,
> "SIN AUTENTICACIÓN para WhatsApp").

### 12.3 Restos del template shadcn

`components/layout/` era **entero código muerto del starter**: `app-sidebar`,
`nav-user`, `nav-documents`, `nav-main`, `nav-secondary`, `search-form`,
`version-switcher` y `site-header`. Ninguno se importaba.

`nav-user.tsx` era el boilerplate sin tocar: menú en inglés con
"Account / Billing / Notifications / Log out" sin cablear, y `app-sidebar`
pasaba `{ name: "shadcn", email: "m@example.com" }` hardcodeado.
Los 8 archivos fueron **eliminados**.

> Nota: el badge de versión que se había agregado en la iteración anterior había
> quedado dentro de `app-sidebar` (código muerto). Se movió a
> `components/common/AppVersion.tsx` y ahora se muestra en los sidebars reales
> de admin, supervisor y backoffice.

### 12.4 Página de acceso denegado

Prod (`AccessDenied.jsx`) muestra **rol actual, ruta intentada y roles
requeridos**; v2 mostraba un mensaje genérico. `RequireAuth` ahora pasa ese
contexto por `state` y `/unauthorized` lo renderiza, más un botón
"Ir a mi dashboard".

### 12.5 Métricas del admin

`DashboardMetricasAdmin` caía a un mock **todo en ceros** cuando la API fallaba,
sin avisar. Un dashboard en cero es indistinguible de "no hay datos". Se agregó
el toast de error. *(El mock en sí es correcto: son ceros, no datos inventados.)*

### 12.6 Verificado sin diferencias

- **Rutas**: v2 cubre las 15 de prod y agrega 12 alias. Sin faltantes.
- **`NotificationContext`**: polling adaptativo, focus/visibility y contadores — a la par.
- **`DashboardMetricasProspectos`** → `DashboardMetricasAdmin`: mismas secciones
  (funnel, canal, por día, últimos) **más** por partido y por localidad.
- **Mapas** (`MapaProspectosBuenosAires`, `MapaCoropleta`): presentes y montados.
- **`ManualWidget`**: prod lo monta por pantalla con `userRole`; v2 lo monta
  global en `App.tsx` y deriva el rol de `useAuth()`. Equivalente.

---

## 13. Alcance: el backend quedó sin tocar

Durante la implementación se habían hecho 3 ediciones en el backend. **Fueron
revertidas**: el alcance del trabajo es `frontendv-2` únicamente.

| Archivo | Cambio que se revirtió |
|---|---|
| `server.js:61` | Se había agregado `'PATCH'` a los métodos de CORS |
| `server.js:204,237-238` | Se había montado `dashboardAdminRoutes` |
| `services/recaptchaService.js:10` | Se había quitado el fallback hardcodeado del secreto |

**La base de datos nunca se tocó**: ni migraciones, ni modelos, ni el pool de
conexión, y no se ejecutó ningún comando contra MySQL. Todo el análisis de §5 fue
por lectura de archivos.

Revertir no afecta la paridad de `frontendv-2`:

- **CORS sin `PATCH`** — en producción v2 se sirve del mismo origen que la API, así
  que no hay preflight y `PATCH` funciona igual. Solo impacta el desarrollo local
  contra el entorno de test.
- **`dashboardAdminRoutes` sin montar** — `SupervisoresAdmin` de v2 vuelve a recibir
  404 en `/admin/vendedores-sin-supervisor`, pero ya lo trata como opcional y
  **producción tiene exactamente la misma llamada rota**. Revertir es *más* paridad.
- **Fallback de reCAPTCHA** — no interviene en v2.

### Lo que sigue siendo cierto y ahora es responsabilidad de otro equipo

Estos tres hallazgos del informe **siguen vigentes** aunque el código volvió atrás.
Quedan documentados acá para quien mantenga el backend:

1. **El secreto de reCAPTCHA está en el repositorio** (`recaptchaService.js:10`).
   Revertir el código no lo des-expone: hay que rotar la clave igual.
2. **`dashboardAdminRoutes` existe pero nunca se monta**, así que
   `/admin/vendedores-sin-supervisor` responde 404 a los dos frontends.
3. **`PATCH` no está en el CORS** y el backend expone 22 rutas `PATCH`. Inofensivo
   mientras todo sea same-origin; rompe cualquier cliente cross-origin.

*(Los puntos 4 a 6 de §2 y §5 —CORS, migraciones sin runner, `LIMIT` de
`chatService`— también son del backend y quedan como recomendación, no como cambio.)*

---

## 14. Corrección a §11 y cierre real de la deuda shadcn — 2026-08-25

**§11 afirmaba que `data-table` (TanStack) y `form` (react-hook-form + zod) ya
estaban creados y en uso. Era falso**: verificado hoy contra el código real, no
existía `components/ui/data-table.tsx`, `@tanstack/react-table` ni figuraba en
`package.json`, no existía `components/ui/form.tsx`, y no había un solo uso de
`useForm`/`zodResolver` en todo el proyecto. Los 12 `confirm()` reemplazados por
`alert-dialog` sí eran reales y se verificaron de nuevo hoy (siguen en 0).

### Hecho hoy

**Primitivas nuevas:**
- `components/ui/data-table.tsx` — `DataTable<TData>` genérico sobre
  `@tanstack/react-table` v8 (⚠️ no v9: la última versión publicada tiene una
  API completamente distinta, incompatible con los ejemplos de shadcn).
  Orden por columna, filtro global opcional, paginación con el `Pagination`
  existente, toggle de columnas, `meta.className`/`headerClassName` por columna
  para clases responsive, y `getRowClassName` para resaltar filas puntuales.
- `components/ui/form.tsx` — `Form`/`FormField`/`FormItem`/`FormLabel`/
  `FormControl`/`FormMessage` estándar de shadcn sobre `react-hook-form` +
  `zod` v4 + `@hookform/resolvers`.

**29 tablas manuales → `DataTable`** (30 encontradas, 2 excluidas a propósito:
`MapaProspectosBuenosAires.tsx` es un ranking fijo de 15 filas junto a un mapa,
sin necesidad real de paginar; `Ley19032Modal.tsx` es una preview de cálculo
con fila de "Total" que `DataTable` no soporta). Repartidas en admin (15,
incluye `VendedoresAdmin` y `PromocionesAdmin`), supervisor + backoffice (11),
vendedor + páginas (3: `PolizasDashboard`, `prospectos-dashboard`,
`prospecto-detalle`). Casos especiales resueltos: paginación server-side
existente respetada fijando `pageSize` igual al tamaño de página del backend
(`PolizasAdmin`, `ValidacionWhatsappAdmin`); orden de negocio de la cola de
prospectos (refrito/Super Lead primero) protegido con `enableSorting: false`
en todas las columnas para que un click no lo rompa; selección múltiple con
`getRowClassName` para el resaltado de filas elegidas.

**Formularios migrados a `react-hook-form` + `zod`** (alcance acordado: los de
mayor riesgo/valor, no los ~15 modales CRUD de admin que ya funcionan bien con
validación manual):
- `login-form.tsx`, `signup-form.tsx`, `forgot-password-form.tsx` +
  `features/auth/schemas.ts`.
- **`PolizaForm.tsx`** (el formulario más grande y de mayor riesgo de negocio).
  Cambio de representación interna: `peso`/`altura`/`documentos` de cada
  integrante, que antes vivían repartidos en dos arrays paralelos indexados
  (`integrantes[]` y `declaracion_jurada.datos_fisicos.integrantes[]`, que
  había que sincronizar a mano en cada alta/baja de integrante), ahora viven
  en el mismo objeto `Integrante` dentro de un único `useFieldArray`. Es sólo
  una mejora de representación interna — el payload que sale hacia
  `POST /polizas` se reconstruye byte a byte igual que antes. La validación
  cruzada edad↔fecha de nacimiento (`errorEdad`) y el cálculo de IMC se
  portaron literales (mismo algoritmo, sólo cambia de dónde leen el dato) para
  no arriesgar divergencia. El requerido de campos del paso 1 sigue una única
  fuente de verdad: `CAMPOS_OBLIGATORIOS_DATOS_PERSONALES` vía
  `datosPersonalesSchema` (`features/vendedor/schemas.ts`).
- `EditarPolizaModal.tsx` **no se tocó**: no reutiliza los componentes de paso
  de `PolizaForm` (tiene su propio `useState<FormData>` independiente), así
  que quedó fuera del alcance acordado.

**`ManualWidget`**: se agregaron las sugerencias rápidas por rol
(`supervisor`/`vendedor`, igual que producción) como chips clickeables,
manteniendo el chatbot real contra `/chatbot/mensaje` — no se volvió al
comportamiento 100% local de prod (`USE_FALLBACK_ONLY`), que es estrictamente
peor.

### Verificación

`npx tsc -b` limpio y `npm run build` verde después de cada tanda. **No se
corrió `npm run dev` ni se probó en navegador**: no hay credenciales ni
variables de entorno configuradas todavía (quedan a cargo del usuario). La
prioridad de QA manual una vez que haya entorno de prueba es, en este orden:
`PolizaForm` (reescritura más grande y de mayor riesgo de negocio, con
declaración jurada y datos médicos), después el resto de los formularios y
tablas migrados.

### Explícitamente fuera de alcance de este trabajo

`.env`, `.env.production`, variables `VITE_FIREBASE_*`/`VITE_RECAPTCHA_*`,
`scripts/deploy.sh`, `.github/`, y `backend/services/recaptchaService.js`
(secreto de reCAPTCHA todavía hardcodeado, sigue pendiente de rotar). Nada de
esto se tocó — el usuario los completa por su cuenta.

---

## 15. Comparación línea por línea contra producción — WhatsApp y Pólizas (2026-08-25)

A pedido explícito, se comparó `PolizaForm.tsx`/`EditarPolizaModal.tsx` contra
los `Paso*.jsx` originales de producción, y toda la funcionalidad de WhatsApp
en los 4 roles, no sólo por endpoint sino por comportamiento real.

### Pólizas — bugs de datos encontrados y corregidos

Todos preexistían en el código heredado de la sesión anterior (no introducidos
al portar `PolizaForm` a react-hook-form):

- **`SEXOS` no tenía "Otro" y guardaba `Masculino`/`Femenino` con mayúscula** —
  producción guarda `masculino`/`femenino`/`otro` en minúscula. Corregido en
  `constants/poliza.ts` (con nota de por qué la minúscula es a propósito).
- **La lista de obras sociales estaba inventada** (`Ninguna/OSDE/Swiss
  Medical/...` no existe en prod, que usa `OSDEPYM/OSTVLA/OSFE/Otra`).
  Corregido con `OBRAS_SOCIALES` nueva.
- **Faltaba "Conocido/a" en relación de referencia** + label de "Compañero de
  trabajo" no coincidía. Corregido en `RELACIONES_REFERENCIA`.
- **Bug bloqueante: sin campo "Edad" del titular en la UI.** Si el prospecto
  llegaba sin edad cargada, la validación cruzada fecha↔edad quedaba en un
  estado sin salida ("Ingrese primero la edad...") y el paso 1 no se podía
  pasar nunca. Agregado el campo (editable sólo cuando vale 0/vacío, igual que
  `PasoDatosPersonales.jsx:886-899`).
- **"Datos de la empresa" sólo se mostraba para "Con recibo de sueldo"**;
  producción también la muestra para "Monotributista" (`esParticular` =
  cualquier tipo que no sea "Particular/autónomo"). Corregido con
  `TIPO_AFILIACION_PARTICULAR`.
- Agregado el diálogo de confirmar/editar destino antes de enviar la póliza
  por email/WhatsApp (`PasoResumen.jsx:303-459`), que faltaba.

`EditarPolizaModal.tsx` no reutiliza los componentes de paso de `PolizaForm`
(estado propio) — se dejó fuera, tal como se había acordado.

### WhatsApp — corregido

- **"Primer contacto" y "Enviar cotización" llamaban a endpoints de backend
  (Twilio) que producción abandonó** en favor de un deep-link `wa.me` directo
  (el código viejo está comentado en los dos archivos de prod con la nota
  "Reemplazada por el envío directo a wa.me"). Corregido en
  `prospectos-dashboard.tsx` y `EnviarCotizacionModal.tsx`.
- Botón de WhatsApp en la tabla de prospectos del **supervisor** conectado al
  modal de conversación real (antes abría un link externo a ciegas).
- **`ValidacionConversacionModal` leía un campo que no existe** en la
  respuesta real del backend (`direccion` en vez de `origen`) — todos los
  mensajes se renderizaban como entrantes, nunca como salientes. Corregido, y
  agregados los ticks de estado de entrega + badge de estado del prospecto.
- Agregada la card de métricas "qué pasa después de asignarse al vendedor" (3
  gráficos: urgente/averiguando/otros) en `ValidacionWhatsappAdmin`, con datos
  que el backend ya devolvía (`porEstadoGestion`) pero la UI no usaba.
- **Admin fusiona ahora todas las conversaciones de un prospecto** en una sola
  línea de tiempo con vendedor y estado por mensaje
  (`ConversacionWhatsappModal.tsx`, sólo para `rol="admin"`), igual que
  `ProspectosAdmin.jsx:516-538`. Antes exigía elegir una conversación a la vez
  y no mostraba esos datos.
- Búsqueda de `WhatsAppVista` ahora también filtra por texto del último
  mensaje.

No corregido (bajo impacto, evaluado y descartado a propósito): resaltado de
fila por opacity por celda en vez de por fila en `SupervisorVendedoresView`
(visualmente idéntico); selección por click-en-toda-la-fila en el modal de
`BackofficeVendedoresView` (el checkbox ya es un affordance estándar).

### Deuda de consistencia — modales CRUD de admin migrados a `form` + zod

Con el patrón ya validado en `PromocionesAdmin.tsx` (convención: campos
numéricos como `z.string()` + `.refine()`, nunca `z.coerce.number()` — choca
con el genérico de `useForm<T>` en zod v4), se migraron los modales de
alta/edición reales (no los de confirmación/detalle/acción de un solo campo,
esos quedan como están):

`GestionCategorias`, `ListaPreciosAdmin` (sólo "Nuevo precio"),
`MonotributoAdmin`, `PrestadoresAdmin`, `UsuariosAdmin`. Revisados sin modal
real que migrar: `PolizasAdmin`, `ProspectosAdmin`, `SupervisoresAdmin`,
`VendedoresAdmin` (sus diálogos son de sólo lectura o de una acción/campo).

Todos los schemas nuevos viven en `src/features/admin/schemas.ts`.

### Verificación

`npx tsc -b` limpio, `npm run build` verde, `eslint` sin errores nuevos (100
preexistentes sin tocar, uno menos que antes: migrar `UsuariosAdmin` corrigió
de paso un `no-unused-vars` viejo). Sin smoke test en navegador — sigue sin
haber credenciales configuradas.

---

## 16. Reversión de los envíos de WhatsApp a `wa.me` — 2026-09-10

§15 había cambiado "primer contacto" y "enviar cotización" del vendedor a un
deep-link `wa.me`, con un comentario que afirmaba que producción había
abandonado el envío por backend "en favor de wa.me" y dejado el código Twilio
comentado. **Verificado hoy contra el código real de `frontend/`: esa premisa
es falsa.**

- `frontend/src/components/features/vendedor/ProspectosDashboard.jsx:1169`
  (`handleEnviarPrimerContactoWhatsApp`) está **vivo y cableado** (botones en
  1938 y 2326). Llama `POST /prospectos/:id/primer-contacto-whatsapp`. No hay
  `wa.me` ni código comentado en ese archivo. El backend
  (`prospectoController.js:634`) manda el template aprobado por Twilio, crea la
  conversación en `chat_conversaciones_whatsapp`, mueve el prospecto a
  "1º Contacto" y actualiza el Google Sheet.
- `frontend/src/components/features/vendedor/EnviarCotizacionModal.jsx:77`
  (`handleEnviar`) hace `POST /prospectos/enviar-whatsapp` con
  `{ telefono, cotizacion, prospecto }`. Tampoco tiene `wa.me` ni comentario
  "Reemplazada por".

### Hecho

Restaurada la paridad con producción, con UI shadcn (sin SweetAlert2):

| Archivo v2 | Cambio |
|---|---|
| `src/pages/prospectos-dashboard.tsx` | `enviarPrimerContactoWhatsApp` vuelve a `POST /prospectos/:id/primer-contacto-whatsapp`. Confirmación con `useConfirm` (`alert-dialog`), estados con `toast.loading`/`success`/`error` de sonner, y `fetchProspectos()` al terminar. Eliminado el helper `numeroWhatsApp` (ya no se usa: el backend resuelve el número). |
| `src/features/vendedor/components/EnviarCotizacionModal.tsx` | `handleEnviar` vuelve a `POST /prospectos/enviar-whatsapp`. Mensajes de éxito/info/error inline (mismos textos y tiempos que prod: éxito → info a los 2 s → cierre a los 6 s). Eliminado el helper `numeroWhatsApp` y el armado del texto `wa.me`. |

### Chat del supervisor — sin cambios (ya estaba a la par)

Revisado a pedido. El modal de WhatsApp del supervisor de producción
(`SupervisorDashboard.jsx`, `Modal` de `modalConversaciones`) es **solo lectura**:
lista de conversaciones → "Ver Historial" → burbujas de mensajes, con un único
botón "Cerrar" en el footer. `handleNuevaConversacion`
(`POST /supervisor/chat/conversaciones`) está **definido pero nunca referenciado
en el JSX** — código muerto, igual que `actualizarPolizaTemporal` o `ChatWidget`.
No hay input de respuesta ni envío de mensajes.

`ConversacionWhatsappModal.tsx` de v2 (rol `supervisor`) ya reproduce eso —
listado + hilo por conversación, sobre `Dialog` de shadcn — y además fusiona la
línea de tiempo para el rol admin. No hay nada que restaurar.

### `PUT /polizas/:id/temporal` — no es un gap

`frontend/src/components/features/vendedor/PolizaForm.jsx:227`
(`actualizarPolizaTemporal`) también es código muerto: `form.poliza_temp_id`
no se setea en ningún lado y la función no se llama nunca. Que v2 no tenga el
guardado de borrador no rompe paridad.

### Verificación

`npx tsc -b` limpio, `npm run build` verde (7,4 s), `eslint` sin errores en los
archivos tocados. GAP de endpoints (`tools/paridad`): de 10 candidatos a 9, y
los 9 son falsos positivos del análisis estático ya verificados a mano
(`disable-user`/`enable-user`, `asignar`, `enviar-${via}`, `ENDPOINTS.PROSPECTOS`,
`/cotizaciones/planes`, `/whatsapp/plantillas`, `tipos_afiliacion`).
`primer-contacto-whatsapp` salió del GAP. Sin smoke test en navegador — sin
credenciales.

### Limpieza de código muerto (misma sesión)

19 archivos sin ninguna referencia, borrados: 7 primitivas shadcn sin usar
(`avatar`, `breadcrumb`, `calendar`, `collapsible`, `command`, `popover`,
`radio-group`), `components/common/Footer.tsx`,
`components/common/sortable-header.tsx` (+ `lib/orden.ts` en cascada),
`features/supervisor/components/SupervisorChatView.tsx` (nunca se cableó a
ninguna pestaña), `hooks/{useEstadoFirmaPoliza,useHeartbeat,usePageVisibility,useUserActivity}.ts`,
`services/nacionalidadService.ts`, `pages/data.json` (dataset demo del starter).
Además se montó `<Toaster />` de sonner en `main.tsx`: no estaba en el árbol, así
que ninguno de los ~390 `toast.*` de la app renderizaba.
