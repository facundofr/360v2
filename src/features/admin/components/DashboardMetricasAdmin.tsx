import { Fragment, useState, useEffect, useMemo } from "react"
import axios from "axios"
import { toast } from "sonner"
import {
  AreaChart, Area,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import {
  Users, TrendingUp, Clock, Phone, FileText, BarChart3,
  Globe, RefreshCw,
} from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Medidor, MedidorFila } from "@/components/common/Medidor"
import { EstadoVacio } from "@/components/common/EstadoVacio"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/common/StatCard"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"
import MapaCoropleta from "./MapaCoropleta"
import MapaProspectosBuenosAires from "./MapaProspectosBuenosAires"

// ── Colores del embudo ─────────────────────────────────────────────────────

// ── Tipos ──────────────────────────────────────────────────────────────────
interface KPIs {
  totalProspectos: { total: number; hoy: number; semana: number; cambio: number }
  tasaConversion: { valor: number; totalVentas: number; cambio: number; meta: number }
  tiempoRespuesta: { valor: number; unidad: string }
  tiempoContacto: { valor: number; unidad: string }
  polizasGeneradas: { total: number; prospectosConPoliza: number; valorPromedio: number }
  prospectosActivos: { total: number; nuevo: number; contactado: number; cotizacion: number; negociacion: number; cierre: number }
}
interface DashData {
  kpis: KPIs
  prospectosPorDia: { fecha: string; prospectos: number; convertidos: number }[]
  funnelData: { etapa: string; cantidad: number; porcentaje: number }[]
  prospectosPorCanal: { canal: string; cantidad: number; porcentaje: number }[]
  ultimosProspectos: { id: number; nombre: string; plan: string; canal: string; estado: string; fecha: string }[]
  prospectosPorPartido: { partido: string; cantidad: number }[]
  prospectosPorLocalidad: { localidad: string; cantidad: number }[]
}
type UltimoProspecto = DashData["ultimosProspectos"][number]

// ── Mock fallback ──────────────────────────────────────────────────────────
const getMock = (): DashData => ({
  kpis: {
    totalProspectos: { total: 0, hoy: 0, semana: 0, cambio: 0 },
    tasaConversion: { valor: 0, totalVentas: 0, cambio: 0, meta: 28 },
    tiempoRespuesta: { valor: 0, unidad: "horas" },
    tiempoContacto: { valor: 0, unidad: "hs" },
    polizasGeneradas: { total: 0, prospectosConPoliza: 0, valorPromedio: 0 },
    prospectosActivos: { total: 0, nuevo: 0, contactado: 0, cotizacion: 0, negociacion: 0, cierre: 0 },
  },
  prospectosPorDia: [],
  funnelData: [
    { etapa: "Nuevo", cantidad: 0, porcentaje: 100 },
    { etapa: "Contactado", cantidad: 0, porcentaje: 0 },
    { etapa: "Cotización", cantidad: 0, porcentaje: 0 },
    { etapa: "Negociación", cantidad: 0, porcentaje: 0 },
    { etapa: "Cierre", cantidad: 0, porcentaje: 0 },
  ],
  prospectosPorCanal: [],
  ultimosProspectos: [],
  prospectosPorPartido: [],
  prospectosPorLocalidad: [],
})

// ── Helpers ────────────────────────────────────────────────────────────────
/**
 * El embudo es una SECUENCIA, no un semáforo: no hay estados "buenos" y
 * "malos", hay etapas más o menos avanzadas. Por eso en vez de seis colores
 * sueltos usamos una rampa del violeta de marca — cuanto más saturado, más
 * cerca del cierre — y reservamos el verde solo para la venta concretada.
 */
const ESTADO_BADGE: Record<string, string> = {
  Nuevo:         "bg-primary/10 text-primary border border-primary/20",
  LEAD:          "bg-primary/10 text-primary border border-primary/20",
  Contactado:    "bg-primary/25 text-primary border border-primary/30",
  "Cotización":  "bg-primary/45 text-primary-foreground",
  "Negociación": "bg-primary/70 text-primary-foreground",
  Cierre:        "bg-state-ok text-white",
}

const PERIODOS = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Semana" },
  { value: "mes_actual", label: "Mes Actual" },
  { value: "mes_anterior", label: "Mes Anterior" },
]

const getMesActual = () =>
  new Date().toLocaleString("es-AR", { month: "long", year: "numeric" }).toUpperCase()

// ── Componente principal ───────────────────────────────────────────────────
export default function DashboardMetricasAdmin() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashData | null>(null)
  const [periodo, setPeriodo] = useState("mes_actual")

  const fetchData = async () => {
    setLoading(true)
    try {
      const token = getAuthToken()
      const { data: res } = await axios.get(`${API_URL}/admin/dashboard/metricas`, {
        params: { periodo },
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.success) {
        setData(res.data as DashData)
      } else {
        // Un dashboard todo en cero es indistinguible de "no hay datos".
        // Avisamos para que nadie lea un fallo de API como métricas reales.
        toast.error("No se pudieron cargar las métricas")
        setData(getMock())
      }
    } catch {
      toast.error("No se pudieron cargar las métricas")
      setData(getMock())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [periodo])

  const { kpis, prospectosPorDia, funnelData, prospectosPorCanal, ultimosProspectos, prospectosPorPartido, prospectosPorLocalidad } = data ?? getMock()

  const columnsUltimosProspectos = useMemo<ColumnDef<UltimoProspecto>[]>(() => [
    { accessorKey: "nombre", header: "Nombre", cell: ({ row }) => <span className="font-medium text-sm">{row.original.nombre}</span> },
    {
      accessorKey: "plan",
      header: "Plan",
      meta: { className: "text-xs text-muted-foreground uppercase" },
    },
    {
      accessorKey: "canal",
      header: "Canal",
      meta: { className: "hidden sm:table-cell text-xs" },
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          <Globe className="size-3.5 text-muted-foreground" />
          {row.original.canal}
        </span>
      ),
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => (
        <Badge className={`text-[10.5px] font-bold uppercase ${ESTADO_BADGE[row.original.estado] ?? "bg-muted-foreground text-background"}`}>
          {row.original.estado}
        </Badge>
      ),
    },
    {
      accessorKey: "fecha",
      header: "Fecha",
      meta: { className: "hidden md:table-cell text-xs text-muted-foreground" },
    },
  ], [])

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Dashboard de Prospectos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Métricas y análisis en tiempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="px-3 py-1.5 text-[10.5px] font-bold tracking-[0.09em] uppercase">
            {getMesActual()}
          </Badge>
          <Button variant="ghost" size="icon" className="size-8" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ── Selector período ── */}
      <div className="flex flex-wrap gap-2">
        {PERIODOS.map(p => (
          <Button
            key={p.value}
            size="sm"
            variant={periodo === p.value ? "default" : "outline"}
            onClick={() => setPeriodo(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      ) : (
        <>
          {/* ── KPIs fila 1 ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard
              label="Total Prospectos"
              value={kpis.totalProspectos.total.toLocaleString("es-AR")}
              subtitle={`${kpis.totalProspectos.hoy} hoy / ${kpis.totalProspectos.semana} esta semana`}
              trend={{ value: kpis.totalProspectos.cambio, positive: kpis.totalProspectos.cambio >= 0 }}
              icon={Users}
            />
            <StatCard
              label="Tasa de Conversión"
              value={`${kpis.tasaConversion.valor}%`}
              subtitle={`${kpis.tasaConversion.totalVentas} ventas / ${kpis.tasaConversion.meta}% meta`}
              trend={{ value: kpis.tasaConversion.cambio, positive: kpis.tasaConversion.cambio >= 0 }}
              icon={TrendingUp}
            />
            <StatCard
              label="Tiempo de Respuesta"
              value={`${kpis.tiempoRespuesta.valor} ${kpis.tiempoRespuesta.unidad}`}
              subtitle="Desde asignación"
              icon={Clock}
            />
            <StatCard
              label="Primer Contacto"
              value={`${kpis.tiempoContacto.valor} hs`}
              subtitle="Tiempo promedio"
              icon={Phone}
            />
            <StatCard
              label="Pólizas Generadas"
              value={kpis.polizasGeneradas.total}
              subtitle={`${kpis.polizasGeneradas.prospectosConPoliza} prospectos`}
              icon={FileText}
            />
          </div>

          {/* ── Prospectos activos + mini estados ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card grande prospectos activos */}
            <Card className="sm:col-span-1">
              <CardContent className="p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 mb-3">
                  <BarChart3 className="size-5 text-primary" />
                </div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Prospectos Activos</p>
                <p className="text-2xl font-bold text-foreground">{kpis.prospectosActivos.total}</p>
                <p className="text-xs text-muted-foreground">En pipeline</p>
              </CardContent>
            </Card>

            {/* Mini estados */}
            {[
              { label: "Nuevo", value: kpis.prospectosActivos.nuevo },
              { label: "Contactado", value: kpis.prospectosActivos.contactado },
              { label: "Cotización", value: kpis.prospectosActivos.cotizacion },
              { label: "Negociación", value: kpis.prospectosActivos.negociacion },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="p-3 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Gráfico área + Embudo ── */}
          <div className="grid grid-cols-1 lg:grid-cols-8 gap-4">
            {/* Prospectos ingresados */}
            <Card className="lg:col-span-5">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold">Prospectos Ingresados</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Nuevos prospectos vs. convertidos — {getMesActual().charAt(0) + getMesActual().slice(1).toLowerCase()}
                </p>
              </CardHeader>
              <CardContent>
                {prospectosPorDia.length === 0 ? (
                  <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                    Sin datos para el período seleccionado
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={prospectosPorDia} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gProspectos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gConvertidos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-state-ok)" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="var(--color-state-ok)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                      <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="prospectos" stroke="var(--color-primary)" fill="url(#gProspectos)" name="Prospectos" />
                      <Area type="monotone" dataKey="convertidos" stroke="var(--color-state-ok)" fill="url(#gConvertidos)" name="Convertidos" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Embudo de Ventas */}
            <Card className="lg:col-span-3">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold">Embudo de Ventas</CardTitle>
                <p className="text-xs text-muted-foreground">Pipeline actual de prospectos</p>
              </CardHeader>
              <CardContent>
                <Medidor>
                  {funnelData.map((stage, i) => {
                    const siguiente = funnelData[i + 1]
                    /* La conversión sólo existe si hay algo de donde convertir.
                       Antes se renderizaba "NaN%" al usuario cuando la etapa
                       estaba vacía. */
                    const pasan = siguiente && stage.cantidad > 0
                      ? Math.round((siguiente.cantidad / stage.cantidad) * 100)
                      : null

                    return (
                      <Fragment key={stage.etapa}>
                        <MedidorFila
                          rotulo={stage.etapa}
                          cifra={stage.cantidad}
                          porcentaje={stage.porcentaje}
                          descripcion={`${stage.etapa}: ${stage.cantidad} prospectos, ${stage.porcentaje}% del total`}
                        />
                        {pasan !== null && (
                          <p className="pl-[101px] text-[11.5px] text-muted-foreground">
                            {pasan}% pasan a {siguiente.etapa.toLowerCase()}
                          </p>
                        )}
                      </Fragment>
                    )
                  })}
                </Medidor>
              </CardContent>
            </Card>
          </div>

          {/* ── Canal + Últimos prospectos ── */}
          <div className="grid grid-cols-1 lg:grid-cols-8 gap-4">
            {/* Prospectos por canal */}
            <Card className="lg:col-span-3">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold">Prospectos por Canal</CardTitle>
                <p className="text-xs text-muted-foreground">Distribución de origen</p>
              </CardHeader>
              <CardContent>
                {prospectosPorCanal.length === 0 ? (
                  <EstadoVacio
                    compacto
                    icono={Globe}
                    titulo="Sin datos de origen"
                    descripcion="Todavía no hay prospectos con canal registrado en este período."
                  />
                ) : (
                  /* Antes era una torta MÁS una lista con el mismo dato debajo.
                     El medidor hace los dos trabajos en uno, y de paso se lleva
                     la paleta de ejemplo de recharts que traía la torta. */
                  <Medidor>
                    {prospectosPorCanal.map(item => (
                      <MedidorFila
                        key={item.canal}
                        rotulo={item.canal}
                        cifra={item.cantidad}
                        porcentaje={item.porcentaje}
                        descripcion={`${item.canal}: ${item.cantidad} prospectos, ${item.porcentaje}% del total`}
                      />
                    ))}
                  </Medidor>
                )}
              </CardContent>
            </Card>

            {/* Últimos prospectos */}
            <Card className="lg:col-span-5">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-semibold">Últimos Prospectos</CardTitle>
                <p className="text-xs text-muted-foreground">Actividad reciente</p>
              </CardHeader>
              <CardContent className="p-0">
                {ultimosProspectos.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">Sin prospectos recientes</div>
                ) : (
                  <div className="p-4">
                    <DataTable columns={columnsUltimosProspectos} data={ultimosProspectos} hideColumnToggle />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Mapas PBA ── */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold tracking-tight">Distribución Geográfica</h3>
            <div className="grid grid-cols-1 gap-4">
              <MapaCoropleta data={prospectosPorPartido} />
            </div>
            {prospectosPorLocalidad.length > 0 && (
              <MapaProspectosBuenosAires data={prospectosPorLocalidad} />
            )}
          </div>
        </>
      )}
    </div>
  )
}

