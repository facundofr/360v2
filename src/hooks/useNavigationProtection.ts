import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import type { Role } from "@/contexts/AuthContext"

const ROLE_DASHBOARDS: Record<Role, string> = {
  vendedor: "/vendedor",
  supervisor: "/supervisor",
  admin: "/admin",
  backoffice: "/backoffice",
}

export function usePreventBackNavigation(enabled = true) {
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (!enabled || !user) return

    const handlePopState = () => {
      const publicRoutes = ["/", "/login", "/signup", "/forgot-password", "/reset", "/verify-email"]
      const currentPath = window.location.pathname

      if (publicRoutes.some((route) => currentPath === route || currentPath.startsWith(route))) {
        const dashboard = ROLE_DASHBOARDS[user.role] ?? "/login"
        window.history.pushState(null, "", dashboard)
        navigate(dashboard, { replace: true })
      }
    }

    window.addEventListener("popstate", handlePopState)
    window.history.pushState(null, "", window.location.pathname)

    return () => window.removeEventListener("popstate", handlePopState)
  }, [enabled, user, navigate])
}

// ─── useBlockBackButton ───────────────────────────────────────────────────────
// Muestra un diálogo de confirmación de logout cuando el usuario presiona
// el botón "atrás" del navegador mientras está autenticado.
export function useBlockBackButton() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  useEffect(() => {
    if (!user) return
    window.history.pushState(null, "", window.location.pathname)

    const handlePopState = () => {
      window.history.pushState(null, "", window.location.pathname)
      setShowLogoutConfirm(true)
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [user])

  const confirmLogout = useCallback(async () => {
    setShowLogoutConfirm(false)
    await logout()
    navigate("/login", { replace: true })
  }, [logout, navigate])

  const cancelLogout = useCallback(() => setShowLogoutConfirm(false), [])

  return { showLogoutConfirm, confirmLogout, cancelLogout }
}

// ─── useDashboardProtection ───────────────────────────────────────────────────
// Expone `forceLogout()` para que cualquier componente pueda forzar el cierre
// de sesión (token en múltiples dispositivos, 403 específico, etc.)
export function useDashboardProtection() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const forceLogout = useCallback(
    async (reason?: string) => {
      if (reason) console.warn("[Auth] Logout forzado:", reason)
      await logout(false)
      navigate("/login", { replace: true })
    },
    [logout, navigate]
  )

  return { forceLogout }
}
