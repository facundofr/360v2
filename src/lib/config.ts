// ─── URLs base ────────────────────────────────────────────────────────────────
// El default es PRODUCCIÓN. Para apuntar al entorno de test
// (https://wspflows.cober.online) hay que setear VITE_API_BASE_URL explícitamente.
// Nunca invertir esto: un build sin .env debe fallar hacia producción, no hacia test.
//
// ⚠️ NO usar `??` acá. Sólo cae con null/undefined, y una variable declarada con
// valor VACÍO (típico en el panel de Vercel) pasa derecho: `BASE` quedaba "",
// `API_URL` quedaba "/api", y el login pegaba contra el propio dominio del
// front. Ahí el rewrite del SPA lo mandaba a index.html y devolvía
// 405 Method Not Allowed en el POST. Se trata vacío/espacios como ausente.
const BASE_ENV = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/$/, "")

/**
 * Modo same-origin: con `VITE_API_SAME_ORIGIN=true` el front pega a `/api`
 * relativo y el hosting hace de proxy hacia el backend (ver `vercel.json`).
 * Sirve para evitar CORS sin tocar la whitelist del backend.
 */
const SAME_ORIGIN = String(import.meta.env.VITE_API_SAME_ORIGIN ?? "") === "true"

const BASE = BASE_ENV || "https://360.cober.online"

// Con proxy, las llamadas HTTP van relativas; el WebSocket NO, porque los
// rewrites de Vercel no hacen upgrade a WS: siempre apunta al backend real.
export const API_URL = SAME_ORIGIN ? "/api" : `${BASE}/api`
export const WS_URL  = BASE

// NOTA: producción define además `LOCAL_API_URL = "http://localhost:4001"` y lo
// usa en `ENDPOINTS.PERFORMANCE` (`MonitoringDashboard.jsx:33`). Eso sólo
// funcionaría si el navegador corriera EN el servidor, así que en producción esa
// llamada falla igual. Acá no se replica: `MonitoringDashboard.tsx` pega a
// `${API_URL}/performance/metrics`, que va por el mismo origen que el resto.
//
// (Ese endpoint hoy devuelve 404: `/api/performance` está comentado en
// `backend/server.js:297`. Es una limitación del backend, no del front.)

/*
  Path bajo el que se sirve la app.
  ───────────────────────────────────────────────────────────────────────────
  Se DERIVA de `import.meta.env.BASE_URL`, que Vite completa con el `base` del
  build. Así el router, el service worker y las redirecciones duras siempre
  siguen al build y no se pueden desincronizar por olvido.

    base "/afiliaciones/"  → BASENAME "/afiliaciones"
    base "/"               → BASENAME ""   (React Router quiere "" o "/")
*/
export const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "")

// ─── reCAPTCHA v3 ─────────────────────────────────────────────────────────────
// La *site key* es pública por diseño (viaja en el HTML). El secreto vive sólo
// en el backend. Default igual a producción (`frontend/src/main.jsx`).
//
// ⚠️ LA SITE KEY ESTÁ ATADA AL DOMINIO. Google valida contra la lista de dominios
// registrados para esa key, así que un token generado desde un dominio no
// registrado (por ejemplo el de Vercel) falla la verificación del backend:
//
//   POST /auth/login → 400 { code: "RECAPTCHA_FAILED" }
//
// El backend sólo valida el token SI viene (`authController.js:111`); si no
// viene, deja pasar el login. Por eso un despliegue en un dominio nuevo tiene
// que registrar ese dominio en la consola de reCAPTCHA, o usar una key propia
// vía `VITE_RECAPTCHA_SITE_KEY`.
//
// Se usa `.trim() || default` y no `??`: una variable declarada VACÍA en el panel
// de Vercel tiene que caer al default, no propagarse como "" (mismo problema que
// tuvo `VITE_API_BASE_URL`).
export const RECAPTCHA_SITE_KEY =
  (import.meta.env.VITE_RECAPTCHA_SITE_KEY ?? "").trim() ||
  "6LeZkdAsAAAAAD1Zve_OSVq20EXJeIq-Dxw5ju21"

// NOTA: el Asistente de Procedimientos se consulta a través del backend
// (`POST /api/chatbot/mensaje`), igual que en producción. No exponemos su
// API key en el cliente: cualquier `VITE_*` se inlinea en el bundle público.

// ─── Endpoints específicos ────────────────────────────────────────────────────
export const ENDPOINTS = {
  AUTH: `${API_URL}/auth`,
  ADMIN: `${API_URL}/admin`,
  PROSPECTOS: `${API_URL}/prospectos`,
  TIPOS_AFILIACION: `${API_URL}/tipos_afiliacion`,
  POLIZAS: `${API_URL}/polizas`,
  LEAD: `${API_URL}/lead`,
  BASE_URL: WS_URL,
} as const
