import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import {
  ClipboardList, CalendarDays, CalendarRange, TrendingUp, Users, RefreshCw,
} from "lucide-react"

import { API_URL } from "@/lib/config"
import { getAuthHeaders } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Lectura, LecturaItem } from "@/components/common/Lectura"
import { Medidor, MedidorFila } from "@/components/common/Medidor"
import { EstadoVacio } from "@/components/common/EstadoVacio"
import { ETAPAS, etapaDe, trabadoEn } from "@/utils/estados"

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

/** Sección reglada: encabezado con filete, sin tarjeta de por medio. */
function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <header className="flex items-center gap-3 border-b border-rule-firm pb-1.5">
        <h3 className="text-[10.5px] font-bold tracking-[0.09em] text-muted-foreground uppercase">{titulo}</h3>
        <span className="h-px flex-1 bg-rule" aria-hidden="true" />
      </header>
      <div className="pt-3">{children}</div>
    </section>
  )
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
    { label: "Prospectos asignados", valor: resumen.totalAsignados, icon: ClipboardList },
    { label: "Nuevos hoy",           valor: resumen.nuevosDia,      icon: CalendarDays },
    { label: "Nuevos esta semana",   valor: resumen.nuevosSemana,   icon: CalendarRange },
    { label: "Nuevos este mes",      valor: resumen.nuevosMes,      icon: TrendingUp },
    { label: "Ventas",               valor: resumen.totalVentas,    icon: Users },
  ]

  const total = resumen.prospectosPorEstado.reduce((a, p) => a + (p.cantidad ?? 0), 0)

  /**
   * Dónde se traba el embudo.
   *
   * Los 26 estados se agrupan por su TRABA, que es la pregunta que el
   * supervisor se hace: contra qué está esperando la cartera. Antes esto era
   * un gráfico de barras con los 26 estados y las etiquetas rotadas −20°:
   * ilegible, y además obligaba a cargar recharts para leer cinco números.
   *
   * La proporción es sobre el total, no sobre la barra más larga: así el
   * ancho significa algo por sí mismo y la cifra impresa es el conteo exacto.
   */
  const porTraba = React.useMemo(() => {
    const mapa = new Map<string, { cantidad: number; estados: string[] }>()
    for (const p of resumen.prospectosPorEstado) {
      const { texto } = trabadoEn(p.estado)
      const acumulado = mapa.get(texto) ?? { cantidad: 0, estados: [] }
      acumulado.cantidad += p.cantidad ?? 0
      acumulado.estados.push(p.estado)
      mapa.set(texto, acumulado)
    }
    return [...mapa.entries()]
      .map(([texto, v]) => ({ texto, ...v }))
      .sort((a, b) => b.cantidad - a.cantidad)
  }, [resumen.prospectosPorEstado])

  /** Por etapa del embudo. Se listan en orden de embudo, no por cantidad: el orden ES el dato. */
  const porEtapa = React.useMemo(() => {
    const mapa = new Map<string, number>()
    for (const p of resumen.prospectosPorEstado) {
      const etapa = etapaDe(p.estado)
      mapa.set(etapa, (mapa.get(etapa) ?? 0) + (p.cantidad ?? 0))
    }
    return ETAPAS.map(etapa => ({ etapa, cantidad: mapa.get(etapa) ?? 0 }))
      .filter(e => e.cantidad > 0)
  }, [resumen.prospectosPorEstado])

  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-bold tracking-[-0.01em]">Resumen de mi equipo</h2>
        <Button variant="outline" size="sm" onClick={fetchResumen} disabled={loading}>
          <RefreshCw className={`size-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />Actualizar
        </Button>
      </div>

      <Lectura>
        {kpis.map(k => (
          <LecturaItem
            key={k.label}
            rotulo={k.label}
            icono={k.icon}
            cargando={loading}
            valor={<CountUp end={k.valor} />}
          />
        ))}
      </Lectura>

      {total === 0 ? (
        <EstadoVacio
          icono={ClipboardList}
          titulo="Todavía no hay prospectos"
          descripcion="Cuando el equipo tenga cartera asignada, acá se ve dónde está trabada."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Seccion titulo="Dónde se traba el embudo">
            <Medidor>
              {porTraba.map(t => (
                <MedidorFila
                  key={t.texto}
                  rotulo={t.texto}
                  cifra={t.cantidad}
                  porcentaje={pct(t.cantidad)}
                  tono={t.cantidad === 0 ? "muted" : "ink"}
                  descripcion={`${t.texto}: ${t.cantidad} prospectos (${Math.round(pct(t.cantidad))}% de la cartera). Estados: ${t.estados.join(", ")}`}
                  title={t.estados.join(" · ")}
                />
              ))}
            </Medidor>
          </Seccion>

          <Seccion titulo="Por etapa">
            <Medidor>
              {porEtapa.map(e => (
                <MedidorFila
                  key={e.etapa}
                  rotulo={e.etapa}
                  cifra={e.cantidad}
                  porcentaje={pct(e.cantidad)}
                  tono={e.etapa === "Descartado" ? "muted" : "ink"}
                  descripcion={`${e.etapa}: ${e.cantidad} prospectos (${Math.round(pct(e.cantidad))}% de la cartera)`}
                />
              ))}
            </Medidor>
          </Seccion>
        </div>
      )}
    </div>
  )
}

export default SupervisorResumenView
