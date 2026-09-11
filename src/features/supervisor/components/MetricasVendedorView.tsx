import * as React from "react"
import axios from "axios"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Medidor, MedidorFila } from "@/components/common/Medidor"
import { EstadoVacio } from "@/components/common/EstadoVacio"
import { ETAPAS, etapaDe } from "@/utils/estados"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  LabelList,
} from "recharts"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

/**
 * Rampa de etapa: monótona en luminosidad, sin matiz.
 *
 * Cinco pasos de tinta sobre papel, uno por etapa del embudo. «Más oscuro es
 * más adelante» se lee sin leyenda, y al no tener matiz no compite con los
 * sellos de estado ni gasta el violeta, que en esta app significa ACCIÓN.
 * Reemplaza ocho colores Material que se reciclaban cada ocho estados.
 */
const RAMPA_ETAPA = [
  "color-mix(in oklch, var(--foreground) 18%, var(--background))",
  "color-mix(in oklch, var(--foreground) 34%, var(--background))",
  "color-mix(in oklch, var(--foreground) 52%, var(--background))",
  "color-mix(in oklch, var(--foreground) 72%, var(--background))",
  "var(--foreground)",
]

interface ConversionVendedor {
  vendedor_id: number
  vendedor: string
  total_prospectos: number
  ventas: number
  tasa_conversion: number
}

interface EstadoVendedor {
  vendedor: string
  estado: string
  cantidad: number
}

interface TiempoConversion {
  vendedor_id: number
  horas_promedio_conversion: number
}

interface Metricas {
  prospectosPorVendedor: { vendedor: string; total: number }[]
  conversionPorVendedor: ConversionVendedor[]
  estadosPorVendedor: EstadoVendedor[]
  tiempoPromedioConversion: TiempoConversion[]
}

const getHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` })

export default function MetricasVendedorView() {
  const [loading, setLoading] = React.useState(true)
  const [metricas, setMetricas] = React.useState<Metricas>({
    prospectosPorVendedor: [],
    conversionPorVendedor: [],
    estadosPorVendedor: [],
    tiempoPromedioConversion: [],
  })

  React.useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/supervisor/metricas-vendedor`, { headers: getHeaders() })
        setMetricas(data)
      } catch {
        toast.error("Error al cargar métricas de vendedores")
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  const barData = metricas.conversionPorVendedor.map(row => {
    const tiempo = metricas.tiempoPromedioConversion.find(t => t.vendedor_id === row.vendedor_id)
    return {
      vendedor: row.vendedor,
      Prospectos: row.total_prospectos,
      Ventas: row.ventas,
      "Conversión (%)": row.tasa_conversion,
      "Tiempo Prom (hs)": tiempo?.horas_promedio_conversion ?? 0,
    }
  })

  const tasas = metricas.conversionPorVendedor
    .map(row => ({ name: row.vendedor, value: row.tasa_conversion }))
    .sort((a, b) => b.value - a.value)

  const vendedores = [...new Set(metricas.estadosPorVendedor.map(e => e.vendedor))]
  const stackedData = vendedores.map(vendedor => {
    const obj: Record<string, string | number> = { vendedor }
    for (const etapa of ETAPAS) obj[etapa] = 0
    for (const e of metricas.estadosPorVendedor) {
      if (e.vendedor !== vendedor) continue
      const etapa = etapaDe(e.estado)
      obj[etapa] = Number(obj[etapa]) + (e.cantidad ?? 0)
    }
    return obj
  })

  return (
    <div className="space-y-6">
      <h2 className="text-[14px] font-bold tracking-[-0.01em]">Métricas por vendedor</h2>

      {/* Conversión y prospectos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Conversión por vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          {barData.length === 0 ? (
            <EstadoVacio titulo="Sin datos" descripcion="Todavía no hay prospectos cargados por el equipo." compacto />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                <XAxis dataKey="vendedor" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {/* La cartera en filete y las ventas en tinta: se lee «de esto,
                    esto cerró» sin aprender una paleta. DESIGN.md § Ink-Carries-Data. */}
                <Bar dataKey="Prospectos" fill="var(--rule-firm)">
                  <LabelList dataKey="Prospectos" position="top" fontSize={10} />
                </Bar>
                <Bar dataKey="Ventas" fill="var(--foreground)">
                  <LabelList dataKey="Ventas" position="top" fontSize={10} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tasa de conversión.
            Era una torta. Una torta reparte un entero entre sus partes, y estas
            son TASAS por vendedor: no suman 100 y ninguna es una porción de
            otra. El medidor dice lo mismo sin afirmar algo falso, y además
            ordena de mayor a menor, que es la pregunta real. */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Tasa de conversión</CardTitle>
          </CardHeader>
          <CardContent>
            {tasas.length === 0 ? (
              <EstadoVacio titulo="Sin datos" descripcion="Ningún vendedor tiene conversiones registradas." compacto />
            ) : (
              <Medidor>
                {tasas.map(t => (
                  <MedidorFila
                    key={t.name}
                    rotulo={t.name}
                    cifra={`${t.value}%`}
                    porcentaje={t.value}
                    descripcion={`${t.name}: ${t.value}% de conversión`}
                  />
                ))}
              </Medidor>
            )}
          </CardContent>
        </Card>

        {/* Prospectos por etapa y vendedor.
            Antes eran los 26 estados apilados con ocho colores reciclados: dos
            estados distintos podían compartir color. Ahora se agrupan en las
            cinco etapas del embudo, con una rampa monótona en luminosidad —más
            oscuro es más adelante—, así el apilado se lee sin leyenda. */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Prospectos por etapa</CardTitle>
          </CardHeader>
          <CardContent>
            {stackedData.length === 0 ? (
              <EstadoVacio titulo="Sin datos" descripcion="Todavía no hay prospectos asignados." compacto />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stackedData} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
                  <XAxis dataKey="vendedor" angle={-30} textAnchor="end" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {ETAPAS.map((etapa, i) => (
                    <Bar key={etapa} dataKey={etapa} stackId="a" fill={RAMPA_ETAPA[i]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabla de conversión */}
      {metricas.conversionPorVendedor.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Resumen de Conversión</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2">Vendedor</th>
                    <th className="text-right py-2">Prospectos</th>
                    <th className="text-right py-2">Ventas</th>
                    <th className="text-right py-2">Conversión</th>
                  </tr>
                </thead>
                <tbody>
                  {metricas.conversionPorVendedor.map((v, i) => (
                    <tr key={i} className="border-b hover:bg-muted/30">
                      <td className="py-2 font-medium">{v.vendedor}</td>
                      <td className="text-right py-2">{v.total_prospectos}</td>
                      <td className="text-right py-2 font-medium">{v.ventas}</td>
                      <td className="text-right py-2">{v.tasa_conversion}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
