import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell,
} from "recharts"
import {
  ClipboardList, CalendarDays, CalendarRange, TrendingUp, Users, RefreshCw,
} from "lucide-react"

import { API_URL } from "@/lib/config"
import { getAuthHeaders } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

// ─────────────────────────────────────────────────────────────────────────────
// Resumen del supervisor — GET /supervisor/resumen
// Equivalente a `SupervisorResumen.jsx`. Se mantiene el conteo animado.
// ─────────────────────────────────────────────────────────────────────────────

interface ProspectoPorEstado {
  estado: string
  cantidad: number
  color?: string
}

interface Resumen {
  totalAsignados: number
  nuevosDia: number
  nuevosSemana: number
  nuevosMes: number
  totalVentas: number
  prospectosPorEstado: ProspectoPorEstado[]
}

const RESUMEN_VACIO: Resumen = {
  totalAsignados: 0,
  nuevosDia: 0,
  nuevosSemana: 0,
  nuevosMes: 0,
  totalVentas: 0,
  prospectosPorEstado: [],
}

/**
 * Paleta por defecto cuando el backend no manda color.
 * Arranca en el violeta de marca y sigue con los estados semánticos, así el
 * gráfico usa el mismo vocabulario cromático que el resto de la app y se
 * adapta solo al tema claro/oscuro.
 */
const COLORES = [
  "var(--primary)",
  "var(--state-ok)",
  "var(--state-warn)",
  "var(--state-risk)",
  "color-mix(in oklch, var(--primary) 55%, transparent)",
  "color-mix(in oklch, var(--state-ok) 55%, transparent)",
  "color-mix(in oklch, var(--state-warn) 55%, transparent)",
]

/** Conteo animado, igual que el `CountUp` de producción. */
function CountUp({ end, duration = 1000 }: { end: number; duration?: number }) {
  const [count, setCount] = React.useState(0)

  React.useEffect(() => {
    if (end <= 0) { setCount(0); return }
    let actual = 0
    const incremento = end / (duration / 16)
    const timer = setInterval(() => {
      actual += incremento
      if (actual >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(actual))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [end, duration])

  return <>{count}</>
}

export function SupervisorResumenView() {
  const [resumen, setResumen] = React.useState<Resumen>(RESUMEN_VACIO)
  const [loading, setLoading] = React.useState(true)

  const fetchResumen = React.useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API_URL}/supervisor/resumen`, { headers: getAuthHeaders() })
      const d = data?.data ?? data ?? {}
      setResumen({
        totalAsignados: d.totalAsignados ?? 0,
        nuevosDia: d.nuevosDia ?? 0,
        nuevosSemana: d.nuevosSemana ?? 0,
        nuevosMes: d.nuevosMes ?? 0,
        totalVentas: d.totalVentas ?? 0,
        prospectosPorEstado: Array.isArray(d.prospectosPorEstado) ? d.prospectosPorEstado : [],
      })
    } catch {
      // A diferencia de prod, NO inventamos datos de ejemplo: mostrar números
      // falsos en un panel de supervisión es peor que mostrar cero.
      toast.error("No se pudo cargar el resumen")
      setResumen(RESUMEN_VACIO)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { fetchResumen() }, [fetchResumen])

  const kpis = [
    { label: "Prospectos asignados", valor: resumen.totalAsignados, icon: ClipboardList, color: "text-primary" },
    { label: "Nuevos hoy",           valor: resumen.nuevosDia,      icon: CalendarDays,  color: "text-sky-500" },
    { label: "Nuevos esta semana",   valor: resumen.nuevosSemana,   icon: CalendarRange, color: "text-indigo-500" },
    { label: "Nuevos este mes",      valor: resumen.nuevosMes,      icon: TrendingUp,    color: "text-amber-500" },
    { label: "Ventas",               valor: resumen.totalVentas,    icon: Users,         color: "text-emerald-500" },
  ]

  const datosGrafico = resumen.prospectosPorEstado.map((p, i) => ({
    ...p,
    fill: p.color ?? COLORES[i % COLORES.length],
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Resumen de mi equipo</h2>
        <Button variant="outline" size="sm" onClick={fetchResumen} disabled={loading}>
          <RefreshCw className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />Actualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <Card key={k.label}>
              <CardContent className="p-3 text-center">
                <Icon className={`size-4 mx-auto mb-1 ${k.color}`} />
                <p className="text-2xl font-bold">
                  {loading ? <Skeleton className="h-7 w-12 mx-auto" /> : <CountUp end={k.valor} />}
                </p>
                <p className="text-xs text-muted-foreground">{k.label}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Distribución por estado */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Prospectos por estado</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : datosGrafico.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              Todavía no hay prospectos para mostrar.
            </p>
          ) : (
            <ChartContainer config={{ cantidad: { label: "Prospectos" } }} className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datosGrafico} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis
                    dataKey="estado"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
                    {datosGrafico.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default SupervisorResumenView
