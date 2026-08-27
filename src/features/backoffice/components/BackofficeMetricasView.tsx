import { useEffect, useState, useCallback } from "react"
import axios from "axios"
import { toast } from "sonner"
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  DollarSign,
  Target,
  Activity,
  ArrowUpRight,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Search,
  ShieldAlert,
  Minus,
} from "lucide-react"
import { CartesianGrid, XAxis, LineChart, Line, LabelList } from "recharts"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/common/StatCard"
import { getUmbralEstado, ESTADO_TEXT } from "@/utils/getUmbralEstado"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"
// ── Tipos ──────────────────────────────────────────────────────────────
interface EmbudoItem {
  estado: string
  cantidad: number
  porcentaje: number
}
interface VendedorRendimiento {
  vendedor_nombre: string
  vendedor_email: string
  supervisor_nombre?: string
  total_prospectos: number
  total_ventas: number
  tasa_conversion: number
  ticket_promedio: number
  ingresos_generados: number
  dias_sin_login: number
}
interface TendenciaItem {
  fecha: string
  nuevos_prospectos: number
  cotizaciones_realizadas: number
  polizas_creadas: number
  ventas_cerradas: number
  ingresos_dia: number
}

interface AlertaItem {
  tipo: string
  mensaje: string
  prioridad: "alta" | "media" | "baja"
}

type SortDir = "asc" | "desc" | null
type SortKey = keyof VendedorRendimiento | null

// ── Helpers ────────────────────────────────────────────────────────────
const fmt = (n?: number | null) =>
  n != null ? Number(n).toLocaleString("es-AR") : "0"

const fmtPct = (v?: number | null) =>
  v != null ? `${Number(v).toFixed(1)}%` : "0%"
const fmtCurrency = (v?: number | null) =>
  v != null
    ? new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
      }).format(v)
    : "$0"

function getAuth() {
  return { Authorization: `Bearer ${getAuthToken()}` }
}

// ── Agrupamiento embudo ────────────────────────────────────────────────
function agruparEmbudo(embudo: EmbudoItem[]) {
  const map: Record<string, { cantidad: number; items: EmbudoItem[] }> = {}
  for (const item of embudo) {
    let cat: string
    if (item.estado === "Venta") cat = "Ventas Exitosas"
    else if (["Lead", "1º Contacto"].includes(item.estado))
      cat = "Prospectos Iniciales"
    else if (
      [
        "Calificado Cotización",
        "Calificado Póliza",
        "Calificado Pago",
      ].includes(item.estado)
    )
      cat = "En Proceso"
    else if (
      item.estado.includes("Fuera") ||
      item.estado.includes("No le interesa")
    )
      cat = "Rechazos"
    else cat = "Otros"

    if (!map[cat]) map[cat] = { cantidad: 0, items: [] }
    map[cat].cantidad += item.cantidad
    map[cat].items.push(item)
  }
  return map
}
const CAT_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  "Ventas Exitosas": {
    bg: "bg-state-ok-soft",
    text: "text-state-ok-text",
    bar: "bg-state-ok",
  },
  "Prospectos Iniciales": {
    bg: "bg-muted/50",
    text: "text-muted-foreground",
    bar: "bg-muted-foreground/40",
  },
  "En Proceso": {
    bg: "bg-state-warn-soft",
    text: "text-state-warn-text",
    bar: "bg-state-warn",
  },
  Rechazos: {
    bg: "bg-state-risk-soft",
    text: "text-state-risk-text",
    bar: "bg-state-risk",
  },
  Otros: {
    bg: "bg-muted/50",
    text: "text-muted-foreground",
    bar: "bg-muted-foreground/40",
  },
}
const tendenciasChartConfig = {
  prospectos: { label: "Nuevos Prospectos", color: "var(--color-Prospectos)" },
  vendedores: { label: "Vendedores", color: "var(--color-Vendedores)" },
  cotizaciones: { label: "Cotizaciones", color: "var(--color-Ventas)" },
  polizas: { label: "Pólizas Generadas", color: "var(--color-Polizas)" },
  ventas: { label: "Ventas", color: "var(--color-Ventas)" },
  ingresos: { label: "Ingresos (k)", color: "var(--chart-5)" },
} satisfies ChartConfig
// ── Componente principal ───────────────────────────────────────────────
export function BackofficeMetricasView() {
  const [loading, setLoading] = useState(true)
  const [embudo, setEmbudo] = useState<EmbudoItem[]>([])
  const [vendedores, setVendedores] = useState<VendedorRendimiento[]>([])
  const [tendencias, setTendencias] = useState<TendenciaItem[]>([])
  const [alertas, setAlertas] = useState<AlertaItem[]>([])
  const [vendSearch, setVendSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("ingresos_generados")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [tendenciasTimeRange, setTendenciasTimeRange] = useState("30d")
  const [loadingTendencias, setLoadingTendencias] = useState(false)
  const fetchTendencias = useCallback(async (dias: number) => {
    setLoadingTendencias(true)
    try {
      const { data } = await axios.get(
        `${API_URL}/backoffice/tendencias?dias=${dias}`,
        { headers: getAuth() }
      )
      setTendencias(data?.data ?? [])
    } catch {
      /* silencioso */
    } finally {
      setLoadingTendencias(false)
    }
  }, [])
  const fetchMetricas = useCallback(async () => {
    setLoading(true)
    try {
      const headers = getAuth()
      const dias =
        tendenciasTimeRange === "7d"
          ? 7
          : tendenciasTimeRange === "90d"
            ? 90
            : 30
      const [embudoRes, vendRes, tendRes, alertRes] = await Promise.all([
        axios.get(`${API_URL}/backoffice/embudo`, { headers }),
        axios.get(`${API_URL}/backoffice/vendedores/rendimiento?dias=30`, {
          headers,
        }),
        axios.get(`${API_URL}/backoffice/tendencias?dias=${dias}`, { headers }),
        axios.get(`${API_URL}/backoffice/alertas`, { headers }),
      ])
      setEmbudo(embudoRes.data?.data ?? [])
      setVendedores(vendRes.data?.data ?? [])
      setTendencias(tendRes.data?.data ?? [])
      setAlertas(alertRes.data?.data ?? [])
    } catch {
      toast.error("Error al cargar métricas avanzadas")
    } finally {
      setLoading(false)
    }
  }, [tendenciasTimeRange])
  useEffect(() => {
    fetchMetricas()
  }, [fetchMetricas])
  // Refetch tendencias when time range changes (only tendencias endpoint)
  useEffect(() => {
    const dias =
      tendenciasTimeRange === "7d" ? 7 : tendenciasTimeRange === "90d" ? 90 : 30
    fetchTendencias(dias)
  }, [tendenciasTimeRange, fetchTendencias])
  // ── Datos derivados ──
  const totalEmbudo = embudo.reduce((s, e) => s + e.cantidad, 0)
  const grouped = agruparEmbudo(embudo)
  const maxCantidad = Math.max(...embudo.map((e) => e.cantidad), 1)
  // Totales del período (calculados desde el array de tendencias)
  const totalNuevosProspectos = tendencias.reduce(
    (s, t) => s + (t.nuevos_prospectos ?? 0),
    0
  )
  const totalCotizaciones = tendencias.reduce(
    (s, t) => s + (t.cotizaciones_realizadas ?? 0),
    0
  )
  const totalVentasCerradas = tendencias.reduce(
    (s, t) => s + (t.ventas_cerradas ?? 0),
    0
  )
  const totalIngresos = tendencias.reduce(
    (s, t) => s + (t.ingresos_dia ?? 0),
    0
  )
  const tendenciasOrdenadas = [...tendencias].sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
  )
  // Generar rango completo de fechas llenando con ceros los días sin datos —
  // esto garantiza que el gráfico siempre tenga suficientes puntos para dibujar el área
  const diasRango =
    tendenciasTimeRange === "7d" ? 7 : tendenciasTimeRange === "90d" ? 90 : 30
  const dataMap = new Map(tendenciasOrdenadas.map((t) => [t.fecha, t]))
  const today = new Date()
  const filteredTendencias = Array.from({ length: diasRango }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (diasRango - 1 - i))
    const fecha = d.toISOString().split("T")[0]
    const t = dataMap.get(fecha)
    return {
      fecha,
      prospectos: t?.nuevos_prospectos ?? 0,
      cotizaciones: t?.cotizaciones_realizadas ?? 0,
      polizas: t?.polizas_creadas ?? 0,
      ventas: t?.ventas_cerradas ?? 0,
      ingresos: Math.round((t?.ingresos_dia ?? 0) / 1000),
    }
  })
  const vendedoresFiltrados = vendedores
    .filter(
      (v) =>
        v.vendedor_nombre.toLowerCase().includes(vendSearch.toLowerCase()) ||
        v.vendedor_email.toLowerCase().includes(vendSearch.toLowerCase()) ||
        (v.supervisor_nombre ?? "")
          .toLowerCase()
          .includes(vendSearch.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortKey || !sortDir) return 0
      const va = a[sortKey] as number | string
      const vb = b[sortKey] as number | string
      if (typeof va === "number" && typeof vb === "number")
        return sortDir === "asc" ? va - vb : vb - va
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va))
    })
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : d === "asc" ? null : "desc"))
      if (sortDir === null) setSortKey(null)
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }
  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="size-3 opacity-40" />
    if (sortDir === "asc") return <ChevronUp className="size-3" />
    if (sortDir === "desc") return <ChevronDown className="size-3" />
    return <ChevronsUpDown className="size-3 opacity-40" />
  }
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Métricas avanzadas
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Análisis detallado del embudo, rendimiento y tendencias del equipo
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={fetchMetricas}
          aria-label="Actualizar métricas"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
        </Button>
      </div>

      {/* Alertas urgentes */}
      {alertas.filter((a) => a.prioridad === "alta").length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert className="size-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                {alertas.filter((a) => a.prioridad === "alta").length} alerta
                {alertas.filter((a) => a.prioridad === "alta").length > 1
                  ? "s"
                  : ""}{" "}
                de prioridad alta
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {alertas
                .filter((a) => a.prioridad === "alta")
                .map((alerta, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                    <span className="text-muted-foreground">
                      {alerta.mensaje}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards resumen — totales del período seleccionado */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Users} label="Nuevos prospectos" value={fmt(totalNuevosProspectos)} />
        <StatCard icon={Target} label="Cotizaciones" value={fmt(totalCotizaciones)} tone="warn" />
        <StatCard icon={Activity} label="Ventas cerradas" value={fmt(totalVentasCerradas)} tone="ok" />
        <StatCard icon={DollarSign} label="Ingresos del período" value={fmtCurrency(totalIngresos)} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="embudo">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="embudo">Embudo</TabsTrigger>
          <TabsTrigger value="rendimiento">Rendimiento</TabsTrigger>
          <TabsTrigger value="tendencias">Tendencias</TabsTrigger>
          <TabsTrigger value="alertas">
            Alertas
            {alertas.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                {alertas.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── TAB: EMBUDO ── */}
        <TabsContent value="embudo" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Distribución por categorías */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Distribución del Embudo
                </CardTitle>
                <CardDescription>
                  Agrupado por etapa (últimos 90 días)
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {Object.entries(grouped).map(([cat, { cantidad }]) => {
                  const pct =
                    totalEmbudo > 0 ? (cantidad / totalEmbudo) * 100 : 0
                  const colors = CAT_COLORS[cat] ?? CAT_COLORS["Otros"]
                  return (
                    <div key={cat}>
                      <div className="mb-1 flex items-center justify-between">
                        <span className={`text-sm font-medium ${colors.text}`}>
                          {cat}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">
                            {fmt(cantidad)}
                          </span>
                          <span className="w-10 text-right text-xs text-muted-foreground">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${colors.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
                <Separator />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm text-muted-foreground">
                    Total prospectos
                  </span>
                  <span className="font-bold">{fmt(totalEmbudo)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Detalle por estado */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Detalle por Estado</CardTitle>
                <CardDescription>
                  Desglose de cada estado individual
                </CardDescription>
              </CardHeader>
              <CardContent className="-mx-2 flex flex-col gap-0">
                {embudo
                  .sort((a, b) => b.cantidad - a.cantidad)
                  .map((item, i) => {
                    const pct = item.porcentaje
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="truncate pr-2 text-sm">
                              {item.estado}
                            </span>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-sm font-medium">
                                {fmt(item.cantidad)}
                              </span>
                              <span className="w-12 text-right text-xs text-muted-foreground">
                                {fmtPct(pct)}
                              </span>
                            </div>
                          </div>
                          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary/60"
                              style={{
                                width: `${(item.cantidad / maxCantidad) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB: RENDIMIENTO ── */}
        <TabsContent value="rendimiento" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <CardTitle className="text-base">
                    Rendimiento de Vendedores
                  </CardTitle>
                  <CardDescription>
                    Últimos 30 días · {vendedoresFiltrados.length} vendedores
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar vendedor o supervisor..."
                    value={vendSearch}
                    onChange={(e) => setVendSearch(e.target.value)}
                    className="h-8 pl-8 text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                        Vendedor
                      </th>
                      <th className="hidden px-4 py-2.5 text-left font-medium text-muted-foreground md:table-cell">
                        Supervisor
                      </th>
                      {(
                        [
                          ["total_prospectos", "Prospectos"],
                          ["total_ventas", "Ventas"],
                          ["tasa_conversion", "Conversión"],
                          ["ingresos_generados", "Ingresos"],
                          ["dias_sin_login", "Actividad"],
                        ] as [SortKey, string][]
                      ).map(([key, label]) => (
                        <th
                          key={String(key)}
                          className="cursor-pointer px-4 py-2.5 text-right font-medium text-muted-foreground hover:text-foreground"
                          onClick={() => toggleSort(key)}
                        >
                          <span className="flex items-center justify-end gap-1">
                            {label}
                            <SortIcon col={key} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vendedoresFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                            <div className="rounded-full bg-muted p-4">
                              <Users
                                className="size-8 text-muted-foreground"
                                aria-hidden="true"
                              />
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                Sin vendedores
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                No hay resultados para tu búsqueda
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      vendedoresFiltrados.map((v, i) => {
                        const actividadColor =
                          ESTADO_TEXT[getUmbralEstado(v.dias_sin_login, { warn: 4, risk: 8 })]
                        const convColor =
                          ESTADO_TEXT[
                            v.tasa_conversion >= 15 ? "ok" : v.tasa_conversion >= 10 ? "warn" : "risk"
                          ]
                        return (
                          <tr
                            key={i}
                            className="border-b transition-colors hover:bg-muted/30"
                          >
                            <td className="px-4 py-3">
                              <p className="leading-none font-medium">
                                {v.vendedor_nombre}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {v.vendedor_email}
                              </p>
                            </td>
                            <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                              {v.supervisor_nombre ?? "Sin supervisor"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Badge variant="secondary">
                                {fmt(v.total_prospectos)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Badge variant="ok">
                                {fmt(v.total_ventas)}
                              </Badge>
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-medium ${convColor}`}
                            >
                              {fmtPct(v.tasa_conversion)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              {fmtCurrency(v.ingresos_generados)}
                            </td>
                            <td
                              className={`px-4 py-3 text-right ${actividadColor}`}
                            >
                              {v.dias_sin_login <= 3 ? (
                                <span className="flex items-center justify-end gap-1">
                                  <ArrowUpRight className="size-3" />
                                  Activo
                                </span>
                              ) : v.dias_sin_login <= 7 ? (
                                <span className="flex items-center justify-end gap-1">
                                  <Minus className="size-3" />
                                  {v.dias_sin_login}d
                                </span>
                              ) : (
                                <span className="flex items-center justify-end gap-1">
                                  <Clock className="size-3" />
                                  {v.dias_sin_login}d
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: TENDENCIAS ── */}
        <TabsContent value="tendencias" className="mt-4">
          <Card className="pt-0">
            <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
              <div className="grid flex-1 gap-1">
                <CardTitle>Tendencias</CardTitle>
                <CardDescription>
                  Evolución diaria de prospectos, cotizaciones, pólizas y ventas
                </CardDescription>
              </div>
              <Select
                value={tendenciasTimeRange}
                onValueChange={setTendenciasTimeRange}
              >
                <SelectTrigger
                  className="hidden w-[160px] rounded-lg sm:ml-auto sm:flex"
                  aria-label="Seleccionar rango"
                >
                  <SelectValue placeholder="Últimos 30 días" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="90d" className="rounded-lg">
                    Últimos 3 meses
                  </SelectItem>
                  <SelectItem value="30d" className="rounded-lg">
                    Últimos 30 días
                  </SelectItem>
                  <SelectItem value="7d" className="rounded-lg">
                    Últimos 7 días
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
              {loadingTendencias ? (
                <div className="flex h-[250px] items-center justify-center">
                  <RefreshCw className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTendencias.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                  <TrendingUp className="size-8 opacity-30" />
                  <p className="text-sm">Sin datos de tendencias disponibles</p>
                  <p className="text-xs">
                    Probá seleccionando un rango de tiempo mayor
                  </p>
                </div>
              ) : (
                <ChartContainer
                  config={tendenciasChartConfig}
                  className="aspect-auto h-[280px] w-full"
                >
                  <LineChart
                    accessibilityLayer
                    data={filteredTendencias}
                    margin={{ top: 20, left: 12, right: 12 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="fecha"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={diasRango <= 7 ? 8 : diasRango <= 30 ? 24 : 48}
                      tickFormatter={(value) =>
                        new Date(value + "T12:00:00").toLocaleDateString(
                          "es-AR",
                          { day: "2-digit", month: "short" }
                        )
                      }
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          indicator="line"
                          labelFormatter={(value) =>
                            new Date(value + "T12:00:00").toLocaleDateString(
                              "es-AR",
                              { day: "2-digit", month: "short", year: "numeric" }
                            )
                          }
                        />
                      }
                    />
                    {(
                      Object.keys(tendenciasChartConfig) as Array<
                        keyof typeof tendenciasChartConfig
                      >
                    ).map((key) => (
                      <Line
                        key={key}
                        dataKey={key}
                        type="natural"
                        stroke={`var(--color-${key})`}
                        strokeWidth={2}
                        dot={{ fill: `var(--color-${key})` }}
                        activeDot={{ r: 6 }}
                      >
                        <LabelList position="top" offset={12} className="fill-foreground" fontSize={11} />
                      </Line>
                    ))}
                    <ChartLegend content={<ChartLegendContent />} />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: ALERTAS ── */}
        <TabsContent value="alertas" className="mt-4">
          <div className="flex flex-col gap-3">
            {alertas.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                  <TrendingDown className="size-8 opacity-30" />
                  <p className="text-sm">Sin alertas activas — todo en orden</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {(["alta", "media", "baja"] as const).map((prioridad) => {
                  const items = alertas.filter((a) => a.prioridad === prioridad)
                  if (items.length === 0) return null
                  return (
                    <div key={prioridad}>
                      <p className="mb-2 px-1 text-xs font-medium tracking-widest text-muted-foreground uppercase">
                        Prioridad {prioridad}
                      </p>
                      <div className="flex flex-col gap-2">
                        {items.map((alerta, i) => {
                          const styles = {
                            alta: {
                              card: "border-state-risk/30 bg-state-risk-soft",
                              icon: (
                                <AlertTriangle className="size-4 shrink-0 text-state-risk-text" />
                              ),
                              badge: "bg-state-risk-soft text-state-risk-text border-state-risk/30",
                            },
                            media: {
                              card: "border-state-warn/30 bg-state-warn-soft",
                              icon: (
                                <AlertTriangle className="size-4 shrink-0 text-state-warn-text" />
                              ),
                              badge: "bg-state-warn-soft text-state-warn-text border-state-warn/30",
                            },
                            baja: {
                              card: "",
                              icon: (
                                <TrendingDown className="size-4 shrink-0 text-muted-foreground" />
                              ),
                              badge: "",
                            },
                          }[prioridad]
                          return (
                            <Card key={i} className={`border ${styles.card}`}>
                              <CardContent className="flex items-start gap-3 p-4">
                                {styles.icon}
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm">{alerta.mensaje}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                                    {alerta.tipo.replace(/_/g, " ")}
                                  </p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`shrink-0 text-xs capitalize ${styles.badge}`}
                                >
                                  {alerta.prioridad}
                                </Badge>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
