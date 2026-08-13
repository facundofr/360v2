import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import { API_URL } from "@/lib/config"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Shield, AlertTriangle, Globe, Ban, CheckCircle,
  RefreshCw, Activity, Eye, Loader2,
} from "lucide-react"

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface SecurityStats {
  blacklistCount:   number
  suspiciousCount:  number
  whitelistCount:   number
  iptablesBlocked?: number
}

interface SecurityLog {
  eventType:  string
  ip:         string
  reason?:    string
  timestamp:  string
}

interface SecurityAlert {
  type:     string
  message:  string
  ip?:      string
  severity: "high" | "medium" | "low"
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const EVENT_COLORS: Record<string, string> = {
  IP_BLOCKED:          "text-red-600",
  SUSPICIOUS_ACTIVITY: "text-yellow-600",
  IP_WHITELISTED:      "text-green-600",
  BLOCKED_HIGH_RISK:   "text-red-700",
  BLOCKED_BLACKLISTED: "text-red-800",
}
const eventColor = (t: string) => EVENT_COLORS[t] ?? "text-muted-foreground"

// ─── Componente ───────────────────────────────────────────────────────────────
export default function SecurityDashboard() {
  const [stats,   setStats]   = React.useState<SecurityStats | null>(null)
  const [logs,    setLogs]    = React.useState<SecurityLog[]>([])
  const [alerts,  setAlerts]  = React.useState<SecurityAlert[]>([])
  const [loading, setLoading] = React.useState(true)
  const [blockForm, setBlockForm] = React.useState({ ip: "", reason: "" })
  const [wlForm,    setWlForm]    = React.useState({ ip: "", reason: "" })

  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, logsRes, alertsRes] = await Promise.allSettled([
        axios.get(`${API_URL}/security/stats`),
        axios.get(`${API_URL}/security/logs`, { params: { limit: 30 } }),
        axios.get(`${API_URL}/security/alerts`),
      ])
      if (statsRes.status  === "fulfilled") setStats(statsRes.value.data.data)
      if (logsRes.status   === "fulfilled") setLogs(logsRes.value.data.data ?? [])
      if (alertsRes.status === "fulfilled") setAlerts(alertsRes.value.data.data ?? [])
    } catch {
      toast.error("Error al cargar datos de seguridad")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
    const id = setInterval(loadData, 30_000)
    return () => clearInterval(id)
  }, [loadData])

  const handleBlockIP = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await axios.post(`${API_URL}/security/block-ip`, blockForm)
      toast.success("IP bloqueada exitosamente")
      setBlockForm({ ip: "", reason: "" })
      loadData()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? "Error bloqueando IP")
    }
  }

  const handleWhitelistIP = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await axios.post(`${API_URL}/security/whitelist-ip`, wlForm)
      toast.success("IP agregada a whitelist")
      setWlForm({ ip: "", reason: "" })
      loadData()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? "Error agregando IP a whitelist")
    }
  }

  const handleRestartFail2Ban = async () => {
    try {
      await axios.post(`${API_URL}/security/restart-fail2ban`)
      toast.success("Fail2Ban reiniciado")
    } catch {
      toast.error("Error reiniciando Fail2Ban")
    }
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Panel de Seguridad</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRestartFail2Ban}>
            Reiniciar Fail2Ban
          </Button>
          <Button size="sm" onClick={loadData} disabled={loading} className="gap-1">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Alertas activas */}
      {alerts.map((a, i) => (
        <Alert key={i} variant={a.severity === "high" ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">{a.type}</span> — {a.message}
            {a.ip && <Badge variant="outline" className="ml-2 text-xs">{a.ip}</Badge>}
          </AlertDescription>
        </Alert>
      ))}

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-1"><Activity className="h-4 w-4" />Dashboard</TabsTrigger>
          <TabsTrigger value="logs"      className="gap-1"><Eye      className="h-4 w-4" />Logs</TabsTrigger>
          <TabsTrigger value="control"   className="gap-1"><Ban      className="h-4 w-4" />Control IPs</TabsTrigger>
        </TabsList>

        {/* Dashboard */}
        <TabsContent value="dashboard">
          {stats ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              {[
                { label: "IPs Bloqueadas",  value: stats.blacklistCount,   color: "red",    icon: Ban },
                { label: "Sospechosas",     value: stats.suspiciousCount,  color: "yellow", icon: AlertTriangle },
                { label: "Permitidas",      value: stats.whitelistCount,   color: "green",  icon: CheckCircle },
                { label: "IPtables",        value: stats.iptablesBlocked ?? 0, color: "blue", icon: Globe },
              ].map(({ label, value, color, icon: Icon }) => (
                <Card key={label} className={`border-${color}-200 bg-${color}-50 dark:bg-${color}-950/20`}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className={`text-sm text-${color}-700 flex items-center gap-2`}>
                      <Icon className="h-4 w-4" />{label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <span className={`text-3xl font-bold text-${color}-900 dark:text-${color}-300`}>{value}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground mt-4 text-sm">No hay estadísticas disponibles.</p>
          )}
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs">
          <div className="mt-4 space-y-2">
            <h3 className="font-semibold">Logs de Seguridad Recientes</h3>
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin logs disponibles.</p>
            ) : logs.map((log, i) => (
              <div key={i} className="flex items-start justify-between bg-muted/40 rounded-lg px-4 py-3 border">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold ${eventColor(log.eventType)}`}>{log.eventType}</span>
                    <Badge variant="outline" className="text-xs">{log.ip}</Badge>
                  </div>
                  {log.reason && <p className="text-xs text-muted-foreground">{log.reason}</p>}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                  {new Date(log.timestamp).toLocaleString("es-ES")}
                </span>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Control IPs */}
        <TabsContent value="control">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-800 flex items-center gap-2 text-base">
                  <Ban className="h-4 w-4" />Bloquear IP
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBlockIP} className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="block-ip">Dirección IP</Label>
                    <Input id="block-ip" placeholder="192.168.1.1" value={blockForm.ip}
                      onChange={(e) => setBlockForm((p) => ({ ...p, ip: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="block-reason">Razón</Label>
                    <Input id="block-reason" placeholder="Actividad sospechosa" value={blockForm.reason}
                      onChange={(e) => setBlockForm((p) => ({ ...p, reason: e.target.value }))} required />
                  </div>
                  <Button type="submit" variant="destructive" className="w-full">Bloquear IP</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="text-green-800 flex items-center gap-2 text-base">
                  <CheckCircle className="h-4 w-4" />Agregar a Whitelist
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleWhitelistIP} className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="wl-ip">Dirección IP</Label>
                    <Input id="wl-ip" placeholder="192.168.1.1" value={wlForm.ip}
                      onChange={(e) => setWlForm((p) => ({ ...p, ip: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="wl-reason">Razón</Label>
                    <Input id="wl-reason" placeholder="IP corporativa" value={wlForm.reason}
                      onChange={(e) => setWlForm((p) => ({ ...p, reason: e.target.value }))} required />
                  </div>
                  <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">Agregar a Whitelist</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
