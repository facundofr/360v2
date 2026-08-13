import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import axios from "axios"
import { jwtDecode } from "jwt-decode"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { API_URL } from "@/lib/config"
import sessionExpiredManager from "@/utils/sessionExpiredManager"
import { getAuthToken, persistToken } from "@/lib/auth"

const SESSION_TIMEOUT_MS  = 30 * 60 * 1000   // 30 min de inactividad → logout
const WARNING_BEFORE_MS   =  5 * 60 * 1000   // aviso 5 min antes (a los 25 min)
const ACTIVITY_THROTTLE   =      2 * 1000    // resetear timers máx 1 vez cada 2 s
const SESSION_CHECK_MS    = 10 * 60 * 1000   // verificar sesión en servidor cada 10 min
const HEARTBEAT_MS        =  2 * 60 * 1000   // heartbeat cada 2 min si el usuario estuvo activo

export function SessionManager() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [renewLoading, setRenewLoading] = useState(false)

  // Timers de sesión
  const warningTimer        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoutTimer         = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownInterval   = useRef<ReturnType<typeof setInterval> | null>(null)
  // Throttle de actividad
  const lastActivityReset   = useRef<number>(0)
  // Heartbeat
  const heartbeatInterval   = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastActivityTime    = useRef<number>(0)

  // ─── Forzar logout y redirigir (sin reload de página) ─────────────────────
  const handleExpired = useCallback(async (reason = "inactividad") => {
    const isFirst = sessionExpiredManager.handleExpired("SessionManager")
    if (!isFirst) return
    setShowWarning(false)
    clearAllTimers()
    await logout(false)
    toast.error(`Tu sesión expiró por ${reason}. Iniciá sesión nuevamente.`)
    navigate("/login", { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logout, navigate])

  // ─── Interceptor Axios: 401 / 403 "Token inválido" → logout sin reload ───
  useEffect(() => {
    const id = axios.interceptors.response.use(
      res => res,
      async err => {
        if (
          axios.isAxiosError(err) &&
          (err.response?.status === 401 || err.response?.status === 403)
        ) {
          const msg: string = err.response?.data?.message ?? ""
          const isTokenError =
            msg === "Token no proporcionado" ||
            msg === "Token inválido" ||
            msg === "jwt expired" ||
            msg === "Unauthorized"
          if (isTokenError) {
            await handleExpired("token inválido")
          }
        }
        return Promise.reject(err)
      }
    )
    return () => axios.interceptors.response.eject(id)
  }, [handleExpired])

  // ─── Limpiar todos los timers ──────────────────────────────────────────────
  function clearAllTimers() {
    if (warningTimer.current)      clearTimeout(warningTimer.current)
    if (logoutTimer.current)       clearTimeout(logoutTimer.current)
    if (countdownInterval.current) clearInterval(countdownInterval.current)
    warningTimer.current = logoutTimer.current = countdownInterval.current = null
  }

  // ─── Reiniciar timers de inactividad ──────────────────────────────────────
  const resetTimers = useCallback(() => {
    clearAllTimers()
    setShowWarning(false)

    warningTimer.current = setTimeout(() => {
      setShowWarning(true)
      setSecondsLeft(WARNING_BEFORE_MS / 1000)
      countdownInterval.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval.current!)
            countdownInterval.current = null
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }, SESSION_TIMEOUT_MS - WARNING_BEFORE_MS)

    logoutTimer.current = setTimeout(() => {
      handleExpired("inactividad")
    }, SESSION_TIMEOUT_MS)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleExpired])

  // ─── Actividad del usuario (throttled a 1 vez cada 2 s) ───────────────────
  const onActivity = useCallback(() => {
    const now = Date.now()
    lastActivityTime.current = now
    if (now - lastActivityReset.current < ACTIVITY_THROTTLE) return
    lastActivityReset.current = now
    resetTimers()
  }, [resetTimers])

  // ─── Heartbeat cada 2 min (solo si el usuario estuvo activo) ──────────────
  const sendHeartbeat = useCallback(async () => {
    const token = getAuthToken()
    if (!token) return
    const idleMs = Date.now() - lastActivityTime.current
    if (idleMs > HEARTBEAT_MS * 2) return // usuario inactivo, no enviar
    try {
      await axios.post(
        `${API_URL}/admin/users/heartbeat`,
        { page: window.location.pathname, action: "heartbeat", timestamp: new Date().toISOString() },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 }
      )
    } catch {
      // Silencioso — el interceptor manejará 401 si corresponde
    }
  }, [])

  // ─── Verificar estado de sesión en el servidor (cada 10 min) ──────────────
  const checkSessionStatus = useCallback(async () => {
    const token = getAuthToken()
    if (!token) return
    try {
      const { data } = await axios.get(`${API_URL}/auth/session-status`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000,
      })
      if (data?.active === false) {
        await handleExpired("vencimiento del servidor")
      } else if (data?.shouldWarn && data?.timeRemaining <= 5) {
        setShowWarning(true)
        setSecondsLeft(data.timeRemaining * 60)
      }
    } catch {
      // Silencioso — no forzar logout por un check fallido
    }
  }, [handleExpired])

  // ─── Renovar sesión ───────────────────────────────────────────────────────
  // La ruta es POST /sessions/renew → { renewed, newToken }.
  // OJO: `/auth/renew-session` NO existe en el backend (devuelve 404); prod
  // arrastra ese bug en su SessionManager y sólo funciona porque renueva por
  // otro camino. Acá usamos directamente la ruta real.
  const doRenew = useCallback(async (): Promise<boolean> => {
    const token = getAuthToken()
    if (!token) return false
    const { data } = await axios.post(
      `${API_URL}/sessions/renew`,
      {},
      { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 }
    )
    if (data?.newToken) {
      persistToken(data.newToken)
      axios.defaults.headers.common["Authorization"] = `Bearer ${data.newToken}`
      return true
    }
    return false
  }, [])

  const renewSession = useCallback(async () => {
    setRenewLoading(true)
    try {
      if (await doRenew()) toast.success("Sesión renovada por 2 horas más")
      resetTimers()
      setShowWarning(false)
    } catch {
      toast.error("No se pudo renovar la sesión")
    } finally {
      setRenewLoading(false)
    }
  }, [resetTimers, doRenew])

  // ─── Renovar sesión silenciosamente (sin feedback al usuario) ────────────
  const renewSilently = useCallback(async () => {
    try {
      await doRenew()
    } catch {
      // Silencioso — si falla, el timer de inactividad manejará el vencimiento
    }
  }, [doRenew])

  // ─── Montar cuando hay usuario autenticado ────────────────────────────────
  useEffect(() => {
    if (!user) return

    lastActivityTime.current = Date.now()
    resetTimers()

    // ─── Renovación proactiva basada en exp del JWT ─────────────────────────
    // Si el token expira en menos de 5 min → renovar en segundo plano
    let proactiveRenewTimeout: ReturnType<typeof setTimeout> | null = null
    const token = getAuthToken()
    if (token) {
      try {
        const { exp } = jwtDecode<{ exp: number }>(token)
        const msUntilExpiry = exp * 1000 - Date.now()
        const msUntilRenew = msUntilExpiry - 5 * 60 * 1000 // 5 min antes de expirar
        if (msUntilRenew <= 0) {
          // Ya está a menos de 5 min → renovar de inmediato silenciosamente
          renewSilently()
        } else {
          proactiveRenewTimeout = setTimeout(renewSilently, msUntilRenew)
        }
      } catch {
        // JWT malformado — el interceptor manejará el 401
      }
    }

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }))

    // Heartbeat periódico
    heartbeatInterval.current = setInterval(sendHeartbeat, HEARTBEAT_MS)

    // Verificación en servidor (con delay inicial de 5 s)
    const checkTimeout = setTimeout(checkSessionStatus, 5000)
    const checkInterval = setInterval(checkSessionStatus, SESSION_CHECK_MS)

    // Resetear gestor de sesión expirada al montar
    sessionExpiredManager.reset()

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity))
      clearAllTimers()
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current)
      clearTimeout(checkTimeout)
      clearInterval(checkInterval)
      if (proactiveRenewTimeout) clearTimeout(proactiveRenewTimeout)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // ─── Handlers de UI ───────────────────────────────────────────────────────
  const handleContinue = () => renewSession()

  const handleLogout = async () => {
    setShowWarning(false)
    await logout()
    navigate("/login", { replace: true })
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  if (!user) return null

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm" onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Sesión por expirar</DialogTitle>
        </DialogHeader>
        <div className="text-center py-4 space-y-2">
          <p className="text-muted-foreground text-sm">
            Tu sesión cerrará automáticamente en:
          </p>
          <p className="text-4xl font-bold tabular-nums">
            {formatTime(secondsLeft)}
          </p>
          <p className="text-xs text-muted-foreground">
            ¿Querés continuar trabajando?
          </p>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleLogout} disabled={renewLoading}>
            Cerrar sesión
          </Button>
          <Button onClick={handleContinue} disabled={renewLoading}>
            {renewLoading ? "Renovando..." : "Continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
