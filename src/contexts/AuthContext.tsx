/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import axios from "axios"
import { jwtDecode } from "jwt-decode"
import { API_URL } from "@/lib/config"
import { registrarTokenFCM, desregistrarTokenFCM } from "@/services/notificationsService"
import {
  type AuthUser,
  type Role,
  ROLE_BY_NUMBER,
  getAuthToken,
  readStoredUser,
  persistSession,
  persistSessionId,
  clearSession,
} from "@/lib/auth"

export type { AuthUser, Role }

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string, recaptchaToken?: string) => Promise<AuthUser>
  logout: (showMessage?: boolean) => Promise<void>
  hasPermission: (allowedRoles: Role[]) => boolean
  getDashboardRoute: () => string
}

// ─── Mapeo de roles a rutas de dashboard ──────────────────────────────────────
const ROLE_DASHBOARDS: Record<Role, string> = {
  vendedor:   "/vendedor/prospectos",
  supervisor: "/supervisor/dashboard",
  admin:      "/admin/dashboard",
  backoffice: "/backoffice/dashboard",
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(() => {
    try {
      const token = getAuthToken()
      if (!token) return null

      // Validar expiración del JWT antes de restaurar la sesión
      try {
        const decoded = jwtDecode<{ exp: number }>(token)
        if (decoded.exp * 1000 < Date.now()) {
          clearSession()
          return null
        }
      } catch {
        clearSession()
        return null
      }

      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`
      return readStoredUser()
    } catch {
      return null
    }
  })
  const [loading, setLoading] = React.useState(false)

  // ─── Validar token contra el servidor al montar (no bloqueante) ────────────
  React.useEffect(() => {
    const token = getAuthToken()
    if (!token) return
    axios
      .get(`${API_URL}/auth/session-status`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000,
      })
      .then(({ data }) => {
        if (data?.active === false) {
          clearSession()
          delete axios.defaults.headers.common["Authorization"]
          setUser(null)
        }
      })
      .catch(() => {})
  }, [])

  const login = React.useCallback(
    async (email: string, password: string, recaptchaToken?: string): Promise<AuthUser> => {
      setLoading(true)
      try {
        const response = await axios.post(`${API_URL}/auth/login`, {
          email,
          password,
          ...(recaptchaToken ? { recaptchaToken } : {}),
        })

        const { token, user: apiUser } = response.data

        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`

        const loginTime = new Date().toISOString()
        const firstName = apiUser.first_name ?? ""
        const lastName = apiUser.last_name ?? ""

        const authed: AuthUser = {
          id: String(apiUser.id),
          firstName,
          lastName,
          name: `${firstName} ${lastName}`.trim() || email.split("@")[0],
          email: apiUser.email,
          role: ROLE_BY_NUMBER[apiUser.role as number] ?? "vendedor",
          loginTime,
        }

        // Persistir ANTES de registrar la sesión: si /sessions/start falla,
        // el usuario igual queda logueado (mismo criterio que producción).
        persistSession(token, authed)

        try {
          const sessionRes = await axios.post(`${API_URL}/sessions/start`, {
            login_time: loginTime,
            user_agent: navigator.userAgent,
          })
          if (sessionRes.data?.sessionId) {
            authed.sessionId = String(sessionRes.data.sessionId)
            persistSessionId(authed.sessionId)
          }
        } catch {
          // No bloquear el login si falla el registro de sesión
        }

        setUser(authed)

        // Registrar token FCM (fire-and-forget)
        registrarTokenFCM().catch(() => {})

        return authed
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const logout = React.useCallback(async () => {
    try {
      // Leer del esquema unificado, NO de claves legacy: si acá se lee mal,
      // se saltea el cierre de sesión en backend y el token FCM sigue vivo.
      const token = getAuthToken()
      const storedUser = readStoredUser()

      if (token && storedUser) {
        desregistrarTokenFCM().catch(() => {})

        axios
          .post(
            `${API_URL}/admin/users/logout-activity`,
            { user_id: storedUser.id, logout_time: new Date().toISOString() },
            { headers: { Authorization: `Bearer ${token}` } }
          )
          .catch(() => {})

        if (storedUser.sessionId && storedUser.loginTime) {
          const sessionTimeSeconds = Math.floor(
            (Date.now() - new Date(storedUser.loginTime).getTime()) / 1000
          )
          try {
            await axios.post(
              `${API_URL}/sessions/end`,
              {
                session_id: parseInt(storedUser.sessionId, 10),
                logout_time: new Date().toISOString(),
                session_time: sessionTimeSeconds,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            )
          } catch {
            // Ignorar error al cerrar sesión en backend
          }
        }
      }
    } finally {
      clearSession()
      delete axios.defaults.headers.common["Authorization"]
      setUser(null)
    }
  }, [])

  const hasPermission = React.useCallback(
    (allowedRoles: Role[]) => (user ? allowedRoles.includes(user.role) : false),
    [user]
  )

  const getDashboardRoute = React.useCallback(
    () => (user ? ROLE_DASHBOARDS[user.role] : "/login"),
    [user]
  )

  const value = React.useMemo(
    () => ({ user, loading, login, logout, hasPermission, getDashboardRoute }),
    [user, loading, login, logout, hasPermission, getDashboardRoute]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>")
  return ctx
}
