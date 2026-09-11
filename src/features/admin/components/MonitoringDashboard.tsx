import * as React from "react"
import axios from "axios"
import { API_URL } from "@/lib/config"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Server, Database, Cpu, HardDrive, Network,
  CheckCircle, AlertTriangle, RefreshCw, Loader2, Clock, Users, Eye,
} from "lucide-react"
import { getUmbralEstado } from "@/utils/getUmbralEstado"
import { Pista } from "@/components/common/Medidor"

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface SystemMetrics {
  cpu?:     { usage: number; cores: number }
  memory?:  { used: number; total: number; percent: number }
  disk?:    { used: number; total: number; percent: number }
  uptime?:  number
  network?: { rx_bytes: number; tx_bytes: number }
  process?: { pid: number; memory_mb: number; cpu_percent: number }
  api?: {
    total_requests?:  number
    error_rate?:      number
    avg_response_ms?: number
    active_sessions?: number
  }
  status?:  "healthy" | "degraded" | "critical"
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`
  return `${(b / 1024 ** 3).toFixed(2)} GB`
}

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function MonitoringDashboard() {
  const [metrics,     setMetrics]     = React.useState<SystemMetrics | null>(null)
  const [loading,     setLoading]     = React.useState(true)
  const [error,       setError]       = React.useState<string | null>(null)
  const [lastUpdate,  setLastUpdate]  = React.useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = React.useState(true)

  const fetchMetrics = React.useCallback(async () => {
    try {
      setError(null)
      const { data } = await axios.get(`${API_URL}/performance/metrics`)
      setMetrics(data)
      setLastUpdate(new Date())
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string }; status?: number; statusText?: string } })
      if (msg?.response) setError(`Error ${msg.response.status}: ${msg.response.statusText}`)
      else setError("Error de conexión con el servidor")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  React.useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(fetchMetrics, 60_000)
    return () => clearInterval(id)
  }, [autoRefresh, fetchMetrics])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  const health = metrics?.status ?? "healthy"
  const healthVariant: "default" | "destructive" | "secondary" =
    health === "healthy" ? "default" : health === "critical" ? "destructive" : "secondary"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Server className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Monitoring del Sistema</h2>
          <Badge variant={healthVariant} className="gap-1">
            {health === "healthy"
              ? <><CheckCircle className="h-3 w-3" />Saludable</>
              : health === "critical"
                ? <><AlertTriangle className="h-3 w-3" />Crítico</>
                : <><AlertTriangle className="h-3 w-3" />Degradado</>
            }
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            <Label htmlFor="auto-refresh" className="text-sm">Auto-refresh</Label>
          </div>
          <Button size="sm" variant="outline" onClick={fetchMetrics} className="gap-1">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {metrics && (
        <>
          {/* CPU, Memoria, Disco */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* CPU */}
            {metrics.cpu && (
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-muted-foreground" />CPU
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{metrics.cpu.cores} cores</span>
                    <span>{metrics.cpu.usage.toFixed(1)}%</span>
                  </div>
                  <Pista porcentaje={metrics.cpu.usage} tono={getUmbralEstado(metrics.cpu.usage)} />
                </CardContent>
              </Card>
            )}

            {/* Memoria */}
            {metrics.memory && (
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />Memoria RAM
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}</span>
                    <span>{metrics.memory.percent.toFixed(1)}%</span>
                  </div>
                  <Pista porcentaje={metrics.memory.percent} tono={getUmbralEstado(metrics.memory.percent)} />
                </CardContent>
              </Card>
            )}

            {/* Disco */}
            {metrics.disk && (
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />Disco
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatBytes(metrics.disk.used)} / {formatBytes(metrics.disk.total)}</span>
                    <span>{metrics.disk.percent.toFixed(1)}%</span>
                  </div>
                  <Pista porcentaje={metrics.disk.percent} tono={getUmbralEstado(metrics.disk.percent)} />
                </CardContent>
              </Card>
            )}
          </div>

          {/* API + Red + Uptime */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {metrics.uptime !== undefined && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Clock className="h-3 w-3" />Uptime
                  </div>
                  <div className="text-lg font-bold">{formatUptime(metrics.uptime)}</div>
                </CardContent>
              </Card>
            )}
            {metrics.api?.active_sessions !== undefined && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Users className="h-3 w-3" />Sesiones activas
                  </div>
                  <div className="text-lg font-bold">{metrics.api.active_sessions}</div>
                </CardContent>
              </Card>
            )}
            {metrics.api?.avg_response_ms !== undefined && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Eye className="h-3 w-3" />Resp. promedio
                  </div>
                  <div className="text-lg font-bold">{metrics.api.avg_response_ms} ms</div>
                </CardContent>
              </Card>
            )}
            {metrics.api?.error_rate !== undefined && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <AlertTriangle className="h-3 w-3" />Tasa de errores
                  </div>
                  <div className={`text-lg font-bold ${metrics.api.error_rate > 5 ? "text-destructive" : ""}`}>
                    {metrics.api.error_rate.toFixed(2)}%
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Red */}
          {metrics.network && (
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Network className="h-4 w-4 text-muted-foreground" />Red</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Recibido</p>
                  <p className="text-base font-semibold">{formatBytes(metrics.network.rx_bytes)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Enviado</p>
                  <p className="text-base font-semibold">{formatBytes(metrics.network.tx_bytes)}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {lastUpdate && (
        <p className="text-xs text-muted-foreground text-right">
          Última actualización: {lastUpdate.toLocaleString("es-ES")}
          {autoRefresh && " · Auto-refresh activo (60s)"}
        </p>
      )}
    </div>
  )
}
