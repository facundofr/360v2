// ─── URLs base ────────────────────────────────────────────────────────────────
// El default es PRODUCCIÓN. Para apuntar al entorno de test
// (https://wspflows.cober.online) hay que setear VITE_API_BASE_URL explícitamente.
// Nunca invertir esto: un build sin .env debe fallar hacia producción, no hacia test.
const BASE = import.meta.env.VITE_API_BASE_URL ?? "https://360.cober.online"

export const API_URL = `${BASE}/api`
export const WS_URL  = BASE
// Igual que `frontend/src/components/config.js` (prod usa 4001).
export const LOCAL_API_URL = "http://localhost:4001"
export const LOCAL_WS_URL  = "http://localhost:4001"

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
export const RECAPTCHA_SITE_KEY =
  import.meta.env.VITE_RECAPTCHA_SITE_KEY || "6LewluErAAAAAD1lny938pNyTuR7QxIR3UaJG5S3"

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
  PERFORMANCE: `${LOCAL_API_URL}/performance`,
  BASE_URL: WS_URL,
} as const
