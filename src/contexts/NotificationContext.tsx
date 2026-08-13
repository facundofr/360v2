/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { useLocation } from "react-router-dom"
import axios from "axios"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface NotificationContextValue {
  whatsappUnread:       number
  otherNotifications:   unknown[]
  totalUnread:          number
  isLoading:            boolean
  updateWhatsappUnread: (count: number) => void
  refreshNotifications: () => void
  addNotification:      (notification: unknown) => void
  clearNotifications:   (type?: "whatsapp" | "other") => void
}

const NotificationContext = React.createContext<NotificationContextValue | undefined>(undefined)

// ─── Provider ─────────────────────────────────────────────────────────────────
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [whatsappUnread,    setWhatsappUnread]    = React.useState(0)
  const [otherNotifications, setOtherNotifications] = React.useState<unknown[]>([])
  const [isLoading,         setIsLoading]         = React.useState(false)

  const location = useLocation()

  // ─── Cargar notificaciones de WhatsApp ──────────────────────────────────
  const loadWhatsappNotifications = React.useCallback(async (silent = false) => {
    const token = getAuthToken()
    if (!token) return
    if (!silent) setIsLoading(true)
    try {
      const { data } = await axios.get(`${API_URL}/chat/conversaciones`, {
        headers: { Authorization: `Bearer ${token}` },
        params:  { limit: 50 },
      })
      if (data.success) {
        const total: number = (data.data as { mensajes_no_leidos?: number }[]).reduce(
          (sum, conv) => sum + (conv.mensajes_no_leidos ?? 0), 0
        )
        setWhatsappUnread(total)
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status !== 401) console.error("[Notifications] Error:", err)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [])

  // ─── Polling inteligente según ruta ──────────────────────────────────────
  React.useEffect(() => {
    const token = getAuthToken()
    if (!token) return

    loadWhatsappNotifications(false)

    const isOnChat = location.pathname.includes("/whatsapp") || location.pathname.includes("/chat")
    const interval = isOnChat ? 15_000 : 90_000
    const id = setInterval(() => loadWhatsappNotifications(isOnChat), interval)
    return () => clearInterval(id)
  }, [location.pathname, loadWhatsappNotifications])

  // ─── Actualizar al recuperar foco ─────────────────────────────────────────
  React.useEffect(() => {
    const onFocus = () => {
      if (getAuthToken()) loadWhatsappNotifications(false)
    }
    const onVisible = () => {
      if (!document.hidden && getAuthToken()) loadWhatsappNotifications(false)
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [loadWhatsappNotifications])

  // ─── API pública ──────────────────────────────────────────────────────────
  const updateWhatsappUnread = React.useCallback((count: number) => setWhatsappUnread(count), [])

  const refreshNotifications = React.useCallback(() => {
    loadWhatsappNotifications(false)
  }, [loadWhatsappNotifications])

  const addNotification = React.useCallback((notification: unknown) => {
    setOtherNotifications((prev) => [notification, ...prev])
  }, [])

  const clearNotifications = React.useCallback((type?: "whatsapp" | "other") => {
    if (!type || type === "whatsapp") setWhatsappUnread(0)
    if (!type || type === "other")    setOtherNotifications([])
  }, [])

  const value = React.useMemo<NotificationContextValue>(() => ({
    whatsappUnread,
    otherNotifications,
    totalUnread: whatsappUnread + otherNotifications.length,
    isLoading,
    updateWhatsappUnread,
    refreshNotifications,
    addNotification,
    clearNotifications,
  }), [
    whatsappUnread, otherNotifications, isLoading,
    updateWhatsappUnread, refreshNotifications, addNotification, clearNotifications,
  ])

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useNotifications(): NotificationContextValue {
  const ctx = React.useContext(NotificationContext)
  if (!ctx) throw new Error("useNotifications debe usarse dentro de <NotificationProvider>")
  return ctx
}
