// ─────────────────────────────────────────────────────────────────────────────
// Almacenamiento de sesión — COMPATIBLE CON `frontend` (producción)
//
// Producción guarda claves DISCRETAS con prefijo `cober_` y el rol como NÚMERO.
// `frontend/src/components/common/ProtectedRoute.jsx` exige `cober_user_id` y
// `cober_user_role` para considerar autenticado al usuario.
//
// Por eso acá escribimos SIEMPRE las dos representaciones:
//   1. las claves discretas de prod  (interoperabilidad / rollback)
//   2. el blob JSON `cober_auth_user` (comodidad interna de v2)
//
// Si se rompe esta simetría, una sesión abierta en v2 deja de ser válida en prod
// y viceversa: cualquier despliegue gradual o rollback deslogea a todos.
// ─────────────────────────────────────────────────────────────────────────────

import { purgarCacheApiSync } from "@/lib/cache"

export type Role = "backoffice" | "admin" | "supervisor" | "vendedor"

export interface AuthUser {
  id: string
  name: string
  firstName: string
  lastName: string
  email: string
  role: Role
  sessionId?: string
  loginTime?: string
}

// ─── Mapeo de roles ───────────────────────────────────────────────────────────
export const ROLE_BY_NUMBER: Record<number, Role> = {
  1: "vendedor",
  2: "supervisor",
  3: "admin",
  4: "backoffice",
}

export const NUMBER_BY_ROLE: Record<Role, number> = {
  vendedor: 1,
  supervisor: 2,
  admin: 3,
  backoffice: 4,
}

/** Nombres legibles, igual que prod (`ProtectedRoute.jsx`). */
export const ROLE_LABELS: Record<Role, string> = {
  vendedor: "Vendedor",
  supervisor: "Supervisor",
  admin: "Administrador",
  backoffice: "Back Office",
}

// ─── Claves ───────────────────────────────────────────────────────────────────
const K = {
  token: "cober_token",
  userId: "cober_user_id",
  firstName: "cober_first_name",
  lastName: "cober_last_name",
  email: "cober_user_email",
  role: "cober_user_role",
  sessionId: "cober_sessionId",
  loginTime: "cober_loginTime",
  blob: "cober_auth_user",
  fcm: "cober_fcm_token",
} as const

/** Claves sin prefijo usadas por versiones viejas; se migran y se borran. */
const LEGACY_KEYS = [
  "token", "auth_user", "user_id", "first_name", "last_name",
  "user_email", "user_role", "sessionId", "loginTime", "fcm_token",
]

// ─── Lectura ──────────────────────────────────────────────────────────────────

export function getAuthToken(): string | null {
  return localStorage.getItem(K.token) ?? localStorage.getItem("token")
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function getStoredUserId(): string | null {
  return localStorage.getItem(K.userId) ?? localStorage.getItem("user_id")
}

export function getStoredSessionId(): string | null {
  return localStorage.getItem(K.sessionId)
}

export function getFcmToken(): string | null {
  return localStorage.getItem(K.fcm) ?? localStorage.getItem("fcm_token")
}

export function setFcmToken(token: string): void {
  localStorage.setItem(K.fcm, token)
}

export function clearFcmToken(): void {
  localStorage.removeItem(K.fcm)
  localStorage.removeItem("fcm_token")
}

/**
 * Reconstruye el usuario desde las claves discretas (fuente de verdad,
 * compartida con prod). Cae al blob JSON sólo si las discretas no están.
 */
export function readStoredUser(): AuthUser | null {
  migrateLegacyKeys()

  const id = localStorage.getItem(K.userId)
  const roleNum = parseInt(localStorage.getItem(K.role) ?? "", 10)

  if (id && !Number.isNaN(roleNum) && ROLE_BY_NUMBER[roleNum]) {
    const firstName = localStorage.getItem(K.firstName) ?? ""
    const lastName = localStorage.getItem(K.lastName) ?? ""
    const email = localStorage.getItem(K.email) ?? ""
    return {
      id,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim() || email.split("@")[0] || "Usuario",
      email,
      role: ROLE_BY_NUMBER[roleNum],
      sessionId: localStorage.getItem(K.sessionId) ?? undefined,
      loginTime: localStorage.getItem(K.loginTime) ?? undefined,
    }
  }

  // Fallback: blob JSON de v2
  try {
    const raw = localStorage.getItem(K.blob)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthUser
    if (!parsed?.id || !parsed?.role) return null
    // Re-sincronizar las discretas para no volver a caer acá
    writeDiscreteKeys(parsed)
    return parsed
  } catch {
    return null
  }
}

// ─── Escritura ────────────────────────────────────────────────────────────────

function writeDiscreteKeys(u: AuthUser): void {
  localStorage.setItem(K.userId, u.id)
  localStorage.setItem(K.firstName, u.firstName ?? "")
  localStorage.setItem(K.lastName, u.lastName ?? "")
  localStorage.setItem(K.email, u.email ?? "")
  localStorage.setItem(K.role, String(NUMBER_BY_ROLE[u.role]))
  if (u.sessionId) localStorage.setItem(K.sessionId, u.sessionId)
  if (u.loginTime) localStorage.setItem(K.loginTime, u.loginTime)
}

/** Persiste la sesión en AMBOS formatos. Único punto de escritura. */
export function persistSession(token: string, user: AuthUser): void {
  // Al ENTRAR se descarta la caché de API del service worker. Es la garantía
  // real de que nadie ve datos del usuario anterior: no depende de que ese
  // usuario haya cerrado sesión (puede haber cerrado el navegador y listo).
  purgarCacheApiSync()

  localStorage.setItem(K.token, token)
  writeDiscreteKeys(user)
  localStorage.setItem(K.blob, JSON.stringify(user))
}

/** Actualiza sólo el sessionId (se conoce después del POST /sessions/start). */
export function persistSessionId(sessionId: string): void {
  localStorage.setItem(K.sessionId, sessionId)
  try {
    const raw = localStorage.getItem(K.blob)
    if (raw) {
      const u = JSON.parse(raw) as AuthUser
      u.sessionId = sessionId
      localStorage.setItem(K.blob, JSON.stringify(u))
    }
  } catch { /* el blob es sólo caché, las discretas ya quedaron bien */ }
}

/** Reemplaza el token tras una renovación de sesión. */
export function persistToken(token: string): void {
  localStorage.setItem(K.token, token)
}

export function clearSession(): void {
  Object.values(K).forEach((k) => localStorage.removeItem(k))
  LEGACY_KEYS.forEach((k) => localStorage.removeItem(k))

  // Y la caché de API del service worker, que sobrevive al logout porque la
  // CacheStorage es por origen. Sin esto, un logout seguido de una pérdida de
  // red le mostraría al siguiente usuario los prospectos, pólizas y
  // declaraciones de salud del anterior.
  //
  // Best-effort: si la redirección al login descarga la página antes de que
  // termine, el `purgarCacheApiSync()` de `persistSession()` lo cubre.
  purgarCacheApiSync()
}

// ─── Migración de claves viejas ───────────────────────────────────────────────

function migrateLegacyKeys(): void {
  const legacyToken = localStorage.getItem("token")
  if (!legacyToken || localStorage.getItem(K.token)) {
    // Nada que migrar, o ya existe la versión con prefijo.
    return
  }

  localStorage.setItem(K.token, legacyToken)

  const pairs: [string, string][] = [
    ["user_id", K.userId],
    ["first_name", K.firstName],
    ["last_name", K.lastName],
    ["user_email", K.email],
    ["user_role", K.role],
    ["sessionId", K.sessionId],
    ["loginTime", K.loginTime],
    ["auth_user", K.blob],
    ["fcm_token", K.fcm],
  ]
  for (const [from, to] of pairs) {
    const v = localStorage.getItem(from)
    if (v !== null && localStorage.getItem(to) === null) localStorage.setItem(to, v)
  }

  LEGACY_KEYS.forEach((k) => localStorage.removeItem(k))
}
