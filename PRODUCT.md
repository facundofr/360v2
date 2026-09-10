# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Cuatro roles internos de Cober, todos sobre la misma app web, todos en español (Argentina).
Ninguno es prioritario: los cuatro reciben el mismo nivel de craft.

- **Vendedor (rol 1).** Agente de ventas. Trabaja prospectos, arma cotizaciones, completa el alta
  de póliza en 6 pasos con la declaración jurada de salud, manda documentos por WhatsApp, chatea.
- **Supervisor (rol 2).** Conduce un equipo de vendedores: sus pólizas, documentos, cotizaciones,
  promociones y métricas por vendedor.
- **Admin (rol 3).** Administración completa: usuarios, vendedores, supervisores, prospectos,
  pólizas, promociones, refritos, reasignación automática, monotributo, lista de precios,
  prestadores, categorías; más tableros de seguridad, monitoreo, métricas avanzadas y mapas de
  prospectos.
- **BackOffice (rol 4).** Estrictamente rol 4. Revisa prospectos, pólizas, supervisores,
  vendedores, promociones y métricas.

Situación de uso: herramienta interna de trabajo, usada durante toda la jornada laboral. Escritorio
y móvil son ambos reales — la app es PWA instalable, con notificaciones push, detección de
dispositivo y presencia por heartbeat. Ninguno es un modo degradado del otro.

## Product Purpose

Cober360 opera el pipeline de afiliación de Cober, una prepaga de salud argentina: captar un lead,
calificarlo como prospecto, cotizar un plan, completar la póliza con declaración jurada de salud por
integrante, firmarla digitalmente, y dejar los documentos y las métricas resultantes auditables a lo
largo de la jerarquía comercial.

Éxito es una póliza completa, legalmente firmada y correctamente atribuida a su vendedor y a su
supervisor.

## Positioning

No es un CRM genérico con campos renombrados. El mecanismo que lo distingue es que **la salida del
formulario es un instrumento legal, no un registro**: la declaración jurada de salud que el afiliado
firma se imprime desde los datos cargados. Alrededor de eso hay lógica específica de prepaga
argentina que un CRM vecino no podría copiar sin el dominio — Ley 19032, monotributo, refritos,
reasignación automática de cartera y cartilla de prestadores.

## Operating Context

- **Producción:** `https://360.cober.online`, frontend servido bajo `/afiliaciones`, backend en el
  puerto 4001. Los previews van a Vercel desde la raíz del repo, con `/api/*` proxeado al VPS.
- **Firma digital:** enviar a firma, consultar estado, descargar la póliza firmada, eliminar
  documentos de firma.
- **WhatsApp:** el PDF de la póliza viaja por WhatsApp. Por eso `/polizas/:id/pdf` y
  `/polizas/pdf/:hash` son públicos a propósito, a diferencia del resto de los documentos.
- **Tiempo real:** socket.io, heartbeat y presencia, monitor de usuarios activos, manejo de
  expiración de sesión.
- **PWA:** instalable, notificaciones push por Firebase Cloud Messaging, service worker registrado
  bajo `BASENAME`.
- **Dos frontends conviven.** `frontend/` (React-Bootstrap + MUI) es lo que corre hoy en producción.
  `frontend-v2/` (este repo) es el reemplazo, todavía no productivo.

## Capabilities and Constraints

- **Backend y base de datos están fuera de alcance.** v2 no cambia contratos, payloads ni esquemas.
- **Las constantes de negocio son datos legales, no copy de UI.** Preguntas de la declaración
  jurada, lista de patologías, estados civiles, condición IVA, tipos de domicilio y formas de pago
  se persisten y se imprimen en el PDF firmado: tienen que coincidir exactamente con `frontend/`.
- `API_URL` ya termina en `/api`; la ruta se escribe sin repetir el prefijo.
- **Sesión con dual-write:** claves discretas `cober_*` (las lee `frontend/`) más el blob JSON
  `cober_auth_user` (v2), para que el despliegue gradual y el rollback no deslogueen a nadie. Toda
  escritura de sesión pasa por `persistSession()`.
- `BASENAME` se deriva de `import.meta.env.BASE_URL`; nunca se hardcodea `/afiliaciones`.
- Los documentos autenticados se bajan como blob. `window.open` sobre un endpoint protegido da 401
  silencioso.
- `/backoffice` es rol 4 puro: el backend usa `authenticateBackOffice` (`role !== 4` → 403).
- Las rutas legacy (`/prospectos-dashboard`, `/supervisor-resumen`, `/admin-dashboard`) siguen
  vivas; hay enlaces guardados apuntando ahí.
- Una librería por trabajo: iconos `lucide-react`, avisos `sonner`, gráficos `recharts`, primitivas
  `radix-ui`, HTTP `axios`, mapas `leaflet`.
- **Brechas de paridad conocidas al momento de escribir esto:** el `PolizaForm.tsx` del vendedor no
  tiene declaración de salud por integrante, bloque de empresa, regla de vigencia ni autoguardado;
  faltan `SubirDocumentosLibresModal` y el botón de eliminar póliza; faltan los mapas de prospectos
  de Buenos Aires (Leaflet + coropleta).
- **Sin decidir:** v2 no tiene suite de tests (ni vitest ni playwright).

## Brand Commitments

Nombre **Cober / Cober360**. Idioma de la interfaz: español de Argentina, sin excepción.

Design system vinculante: **https://design-sistem-cober.vercel.app/**, marca **`cober`** (el sitio
también publica `bristol` y `medicals` — fuera de alcance). Anclas de identidad, tal como las define
ese sistema:

- **Tipografía: Montserrat**, pesos 300/400/500/600/700/800 (`'Montserrat', sans-serif`).
- **`--primary` es negro** (`0 0% 0%`) sobre blanco, con foreground blanco. La rampa de marca
  `--brand-50` … `--brand-700` es escala de grises.
- **Violeta Cober `#660E80`** = `hsl(286 80% 28%)`, llamado "color cober" en el sistema, expuesto
  como `--brand-800`. Es el acento de marca, **no** el primary.
- Semánticos: success `142 71% 45%`, warning `48 96% 53%`, info `217 91% 60%`,
  destructive `0 84% 60%`.
- `--radius: .5rem`. El sistema trae juego completo de tokens light y dark, más una escala propia de
  sidebar.
- `logo-cober.svg`: wordmark monocromo **blanco**, viewBox 584×265, pensado para fondo oscuro.
  Theme color `#333333`.

Cómo se aplican estas anclas — jerarquía, composición, densidad, dónde aparece el violeta — no se
decide acá; es trabajo de DESIGN.md.

**Mandato acordado con el usuario:** este proyecto es un **rediseño**, no una copia visual de
producción. `frontend-v2` puede y debe superar el look de `frontend/`, preservando flujos, textos,
datos, funciones y contrato de backend.

## Evidence on Hand

- **`frontend/`** (React-Bootstrap + MUI) es la implementación productiva y la fuente de verdad
  funcional para paridad. `backend/` es la segunda autoridad.
- **Constantes de negocio reales:**
  `frontend/src/components/features/vendedor/PolizaForm.jsx` (líneas 19-88) y
  `frontend/src/components/features/vendedor/poliza-form/`.
- **Documentos de migración en este repo:** `AUDITORIA_PARIDAD.md`, `MIGRATION_STATUS.md`,
  `PLAN_MIGRACION_4_ETAPAS.md`, `DEPENDENCY_COMPARISON.md`, `IA_MIGRACION.md`.
- **Design system:** el sitio citado arriba, marca `cober`, con `logo-cober.svg`.

Ausencias que el trabajo futuro **no debe inventar**:

- No hay tests en `frontend-v2`.
- Los planes, precios y testimonios que muestra el sitio del design system son datos de demo de esa
  vitrina, no contenido de Cober360. No trasladarlos.
- `frontend/` y `backend/` no tienen `node_modules` instalados en esta máquina, así que hoy
  producción no se puede levantar local para sacar capturas de referencia.

## Product Principles

1. **Paridad de verdad, libertad de forma.** Flujos, datos, semántica del copy y contratos de
   backend están fijos. El aspecto no: ahí es donde v2 tiene permiso para ser mejor que producción.
2. **El formulario es un instrumento legal.** Todo lo que se imprime en la declaración jurada
   firmada es dato de negocio copiado de producción, nunca redactado en v2.
3. **Cuatro roles, un solo sistema.** Vendedor, Supervisor, Admin y BackOffice reciben el mismo
   craft. Los límites de rol se hacen cumplir, no se sugieren.
4. **El rollback tiene que seguir siendo barato.** Sesión, ruteo y rutas de assets mantienen
   `frontend/` y `frontend-v2/` intercambiables mientras dure la migración.
5. **El trabajo pasa durante la jornada, en la pantalla que haya.** Escritorio y PWA instalada en el
   móvil son dos usos reales, no uno degradado del otro.

## Accessibility & Inclusion

No se estableció un estándar formal — **decisión abierta**. Hechos conocidos que sí condicionan:
el español de Argentina es el único idioma de la interfaz; la app se usa en turnos largos de carga
de datos, así que eficiencia de teclado y comportamiento de foco pesan; y existe modo oscuro, con
tokens dark completos en el design system.
