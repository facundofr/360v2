import * as React from "react"
import axios from "axios"
import { API_URL } from "@/lib/config"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, RefreshCw, TrendingUp, Clock, Users } from "lucide-react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

// ─── Tipos ────────────────────────────────────────────────────────────────────
// Forma real de `/admin/vendedores` y `/admin/supervisores`: `{success, data:
// [{id, first_name, last_name, ...}]}` — no `{vendedores/supervisores: [{nombre}]}`.
interface Vendedor { id: number; first_name: string; last_name: string }
interface Supervisor { id: number; first_name: string; last_name: string }

// Alias reales de `MetricasModel.js`: `total_leads` (no `total`), `rango_edad`
// (no `rango`) y `fecha` (no `dia`) — antes ninguno de los 3 gráficos
// mostraba datos porque los `dataKey` apuntaban a claves inexistentes.
interface MetricasData {
  leadsPorHora?:  { hora: number; total_leads: number }[]
  leadsPorEdad?:  { rango_edad: string; total_leads: number }[]
  leadsPorSexo?:  { sexo: string; total: number }[]
  leadsPorDia?:   { fecha: string; total_leads: number }[]
  resumen?: {
    total_leads?:          number
    conversion_rate?:      number
    promedio_edad?:        number
    dias_activos?:         number
  }
}

/**
 * Rampa categórica: tinta en cuatro pesos, sin matiz.
 *
 * Eran cuatro colores sueltos —lila, verde, naranja, azul— que no ordenaban
 * nada y obligaban a leer la leyenda. Con una rampa monótona en luminosidad
 * el orden de la torta se lee en el propio dibujo.
 */
const RAMPA = [
  "var(--foreground)",
  "color-mix(in oklch, var(--foreground) 66%, var(--background))",
  "color-mix(in oklch, var(--foreground) 42%, var(--background))",
  "color-mix(in oklch, var(--foreground) 22%, var(--background))",
]

// ─── Componente ───────────────────────────────────────────────────────────────
export default function MetricasAvanzadas() {
  const [loading,    setLoading]    = React.useState(true)
  const [error,      setError]      = React.useState<string | null>(null)
  const [metricas,   setMetricas]   = React.useState<MetricasData>({})
  const [vendedores, setVendedores] = React.useState<Vendedor[]>([])
  const [supervisores, setSupervisores] = React.useState<Supervisor[]>([])

  const hoy = new Date().toISOString().split("T")[0]
  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  const [filtros, setFiltros] = React.useState({
    fecha_desde:   hace30,
    fecha_hasta:   hoy,
    vendedor_id:   "",
    supervisor_id: "",
  })

  const cargarMetricas = React.useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await axios.get(`${API_URL}/admin/metricas-avanzadas`, { params: filtros })
      if (data.success) setMetricas(data.data)
      else setError("Error al cargar las métricas")
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Error al cargar métricas")
    } finally {
      setLoading(false)
    }
  }, [filtros])

  React.useEffect(() => {
    cargarMetricas()
    axios.get(`${API_URL}/admin/vendedores`).then((r) => setVendedores(r.data?.data ?? [])).catch(() => {})
    axios.get(`${API_URL}/admin/supervisores`).then((r) => setSupervisores(r.data?.data ?? [])).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: string, v: string) => setFiltros((p) => ({ ...p, [k]: v }))

  const { resumen, leadsPorHora, leadsPorDia, leadsPorEdad, leadsPorSexo } = metricas

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Métricas Avanzadas</h2>
        </div>
        <Button size="sm" onClick={cargarMetricas} disabled={loading} className="gap-1">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Filtros</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={filtros.fecha_desde} onChange={(e) => set("fecha_desde", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={filtros.fecha_hasta} onChange={(e) => set("fecha_hasta", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vendedor</Label>
              <Select value={filtros.vendedor_id || "all"} onValueChange={(v) => set("vendedor_id", v === "all" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {vendedores.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.first_name} {v.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Supervisor</Label>
              <Select value={filtros.supervisor_id || "all"} onValueChange={(v) => set("supervisor_id", v === "all" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {supervisores.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.first_name} {s.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={cargarMetricas}>Aplicar filtros</Button>
            <Button size="sm" variant="outline" onClick={() => setFiltros({ fecha_desde: hace30, fecha_hasta: hoy, vendedor_id: "", supervisor_id: "" })}>
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Resumen */}
          {resumen && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Total Leads",    value: resumen.total_leads ?? 0,          icon: Users,     suffix: "" },
                { label: "Tasa conversión",value: `${resumen.conversion_rate ?? 0}%`, icon: TrendingUp, suffix: "" },
                { label: "Promedio edad",  value: `${resumen.promedio_edad ?? 0} años`, icon: Clock,   suffix: "" },
                { label: "Días activos",   value: resumen.dias_activos ?? 0,          icon: Clock,    suffix: " días" },
              ].map(({ label, value, icon: Icon }) => (
                <Card key={label}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Icon className="h-3 w-3" />{label}
                    </div>
                    <div className="text-2xl font-bold">{value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Leads por hora */}
          {leadsPorHora && leadsPorHora.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Leads por Hora del Día</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={leadsPorHora}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hora" tickFormatter={(h) => `${h}:00`} />
                    <YAxis />
                    <Tooltip formatter={(v) => [v, "Leads"]} labelFormatter={(h) => `${h}:00 hs`} />
                    <Bar dataKey="total_leads" fill="var(--foreground)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Leads por día */}
          {leadsPorDia && leadsPorDia.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Leads por Día</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={leadsPorDia}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="total_leads" stroke="var(--foreground)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Edad y Sexo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {leadsPorEdad && leadsPorEdad.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Distribución por Edad</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={leadsPorEdad} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="rango_edad" width={80} />
                      <Tooltip />
                      <Bar dataKey="total_leads" fill="var(--foreground)" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
            {leadsPorSexo && leadsPorSexo.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Distribución por Género</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={leadsPorSexo} dataKey="total" nameKey="sexo" cx="50%" cy="50%" outerRadius={70} label={({ sexo, percent }) => `${sexo} ${(percent * 100).toFixed(0)}%`}>
                        {leadsPorSexo.map((_, i) => <Cell key={i} fill={RAMPA[i % RAMPA.length]} />)}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  )
}
