import { useState, useEffect, useRef, useCallback } from "react"
import { io, Socket } from "socket.io-client"
import { Wifi, WifiOff, RefreshCw, Users, UserCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { API_URL, WS_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface UsuarioActivo {
  id: number
  first_name?: string
  last_name?: string
  email?: string
  role?: number
  role_name?: string
  role_color?: string
  last_activity_time?: string
  last_activity_date?: string
  last_login_time?: string
  last_login_date?: string
  minutes_since_activity?: number
}

interface Statistics {
  summary?: {
    active_today?: number
    enabled_users?: number
  }
}

export default function ActiveUsersMonitor() {
  const [activeUsers, setActiveUsers] = useState<UsuarioActivo[]>([])
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [connectedAdmins, setConnectedAdmins] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [wsConnected, setWsConnected] = useState(false)
  const [timeframe, setTimeframe] = useState(5)
  const [reconnecting, setReconnecting] = useState(false)
  const [connectionAttempts, setConnectionAttempts] = useState(0)

  const socketRef = useRef<Socket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMounted = useRef(true)
  const fetching = useRef(false)
  const lastFetch = useRef(0)

  const MAX_RECONNECT = 3
  const THROTTLE = 5000

  const token = getAuthToken()
  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }

  // ── Fetch HTTP fallback ─────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    const now = Date.now()
    if (fetching.current || now - lastFetch.current < THROTTLE) return
    fetching.current = true
    lastFetch.current = now
    try {
      const res = await fetch(`${API_URL}/admin/users/active?timeframe=${timeframe}`, { headers: authHeaders })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (isMounted.current && data.success) {
        setActiveUsers(data.data?.active_users ?? [])
        if (data.data?.last_updated) setLastUpdated(new Date(data.data.last_updated))
        else setLastUpdated(new Date())
      }
    } catch { /* silencioso */ }
    finally { fetching.current = false }
  }, [timeframe])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/admin/users/activity-stats`, { headers: authHeaders })
      if (!res.ok) return
      const data = await res.json()
      if (isMounted.current) {
        setStatistics(data ?? null)
        setLastUpdated(new Date())
      }
    } catch { /* silencioso */ }
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    await Promise.allSettled([fetchUsers(), fetchStats()])
    if (isMounted.current) setLoading(false)
  }, [fetchUsers, fetchStats])

  // ── WebSocket ───────────────────────────────────────────────────────────────
  const attemptReconnect = useCallback((attempts: number) => {
    if (attempts >= MAX_RECONNECT || !isMounted.current) {
      setReconnecting(false)
      return
    }
    setReconnecting(true)
    setConnectionAttempts(attempts + 1)
    reconnectTimer.current = setTimeout(() => {
      if (isMounted.current) initSocket(attempts + 1)
    }, 3000 * (attempts + 1))
  }, [])

  const initSocket = useCallback((attempts = 0) => {
    if (socketRef.current?.connected) return
    const socket = io(`${WS_URL}/admin`, {
      auth: { token },
      transports: ["websocket", "polling"],
      forceNew: true,
      timeout: 10000,
      reconnection: false,
    })
    socketRef.current = socket

    socket.on("connect", () => {
      if (!isMounted.current) return
      setWsConnected(true); setReconnecting(false); setConnectionAttempts(0); setLoading(false)
    })

    socket.on("active_users_update", (data: {
      active_users?: UsuarioActivo[]
      statistics?: Statistics
      last_updated?: string
      connected_admins?: number
    }) => {
      if (!isMounted.current) return
      setActiveUsers(data.active_users ?? [])
      if (data.statistics) setStatistics(data.statistics)
      if (data.last_updated) setLastUpdated(new Date(data.last_updated))
      setConnectedAdmins(data.connected_admins ?? 0)
    })

    socket.on("connect_error", () => {
      if (!isMounted.current) return
      setWsConnected(false); setLoading(false)
      fetchAll()
      attemptReconnect(attempts)
    })

    socket.on("disconnect", (reason: string) => {
      if (!isMounted.current) return
      setWsConnected(false)
      if (reason !== "io client disconnect") attemptReconnect(attempts)
    })
  }, [token, fetchAll, attemptReconnect])

  useEffect(() => {
    isMounted.current = true
    fetchAll()
    initSocket()
    return () => {
      isMounted.current = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      socketRef.current?.disconnect(); socketRef.current = null
    }
  }, [])

  // Cambiar timeframe
  useEffect(() => {
    if (wsConnected && socketRef.current?.connected) {
      socketRef.current.emit("change_timeframe", timeframe)
    } else {
      const t = setTimeout(() => fetchUsers(), 500)
      return () => clearTimeout(t)
    }
  }, [timeframe])

  // Auto-refresh cada 60s si no hay WS
  useEffect(() => {
    if (wsConnected) return
    const t = setInterval(() => { fetchUsers(); fetchStats() }, 60000)
    return () => clearInterval(t)
  }, [wsConnected, fetchUsers, fetchStats])

  const handleRefresh = () => {
    if (wsConnected && socketRef.current?.connected) socketRef.current.emit("request_update")
    else fetchAll()
  }

  // ── Helpers visuales ────────────────────────────────────────────────────────
  const formatTimeSince = (minutes?: number) => {
    if (minutes == null || isNaN(minutes) || minutes < 0) return "Sin datos"
    if (minutes < 1) return "AHORA MISMO"
    if (minutes < 60) return `Hace ${minutes} min`
    const h = Math.floor(minutes / 60); const m = minutes % 60
    return h < 24 ? `Hace ${h}h ${m}min` : `Hace ${Math.floor(h / 24)} días`
  }

  const tiempoClass = (minutes?: number) => {
    if (minutes == null || isNaN(minutes)) return "border-muted-foreground text-muted-foreground"
    if (minutes <= 2) return "border-state-ok/40 text-state-ok-text"
    if (minutes <= 5) return "border-state-warn/40 text-state-warn-text"
    return "border-muted-foreground text-muted-foreground"
  }

  const roleBadgeClass = (roleColor?: string) => {
    switch (roleColor?.toLowerCase()) {
      case "danger": case "red": return "border-state-risk/40 text-state-risk-text"
      case "primary": case "blue": return "border-primary text-primary"
      case "success": case "green": return "border-state-ok/40 text-state-ok-text"
      case "warning": case "orange": return "border-state-warn/40 text-state-warn-text"
      default: return "border-primary text-primary"
    }
  }

  const dotColor = (minutes?: number) => {
    if (minutes == null || isNaN(minutes)) return "bg-muted-foreground/40"
    if (minutes <= 2) return "bg-state-ok"
    if (minutes <= 5) return "bg-state-warn"
    return "bg-muted-foreground/40"
  }

  return (
    <div className="space-y-4">
      {/* Header card con stats + estado */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4" />
              Monitor de Usuarios Activos
              {wsConnected
                ? <Wifi className="size-4 text-state-ok-text" />
                : <WifiOff className="size-4 text-state-warn-text" />
              }
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={String(timeframe)} onValueChange={v => setTimeframe(Number(v))}>
                <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Último minuto</SelectItem>
                  <SelectItem value="5">Últimos 5 min</SelectItem>
                  <SelectItem value="15">Últimos 15 min</SelectItem>
                  <SelectItem value="30">Últimos 30 min</SelectItem>
                  <SelectItem value="60">Última hora</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {/* 4 métricas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3 text-center">
              <UserCheck className="size-4 mx-auto mb-1 text-state-ok-text" />
              <p className="text-2xl font-bold">{activeUsers.length}</p>
              <p className="text-xs text-muted-foreground">Activos ahora</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <Users className="size-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{statistics?.summary?.active_today ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Activos hoy</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <Wifi className="size-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{statistics?.summary?.enabled_users ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Habilitados</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <Users className="size-4 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{connectedAdmins}</p>
              <p className="text-xs text-muted-foreground">Admins conectados</p>
            </CardContent></Card>
          </div>

          {/* Estado + última actualización */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Estado:</span>
              {wsConnected ? (
                <Badge variant="ok" className="text-[10px] gap-1">
                  <span className="inline-block size-1.5 rounded-full bg-state-ok animate-pulse" />
                  TIEMPO REAL
                </Badge>
              ) : reconnecting ? (
                <Badge variant="warn" className="text-[10px]">
                  Reconectando... ({connectionAttempts}/{MAX_RECONNECT})
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground text-[10px]">Modo Manual</Badge>
              )}
            </div>
            {lastUpdated && (
              <span>
                Última actualización: {lastUpdated.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      {loading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserCheck className="size-4" />
              Usuarios Activos (últimos {timeframe} minutos)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {activeUsers.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <Users className="size-8 mx-auto mb-2 opacity-30" />
                No hay usuarios activos en los últimos {timeframe} minutos
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Estado</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Última Actividad</TableHead>
                    <TableHead>Tiempo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeUsers.map(u => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <span className={`inline-block size-2.5 rounded-full ${dotColor(u.minutes_since_activity)}`} />
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold text-sm">{u.first_name ?? ""} {u.last_name ?? ""}</p>
                        <p className="text-xs text-muted-foreground">ID: {u.id}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email ?? "—"}</TableCell>
                      <TableCell>
                        {u.role_name && (
                          <Badge variant="outline" className={`text-[10px] font-bold uppercase ${roleBadgeClass(u.role_color)}`}>
                            {u.role_name}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{u.last_activity_time ?? u.last_login_time ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{u.last_activity_date ?? u.last_login_date ?? ""}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] font-bold uppercase ${tiempoClass(u.minutes_since_activity)}`}>
                          {formatTimeSince(u.minutes_since_activity)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
