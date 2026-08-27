import * as React from "react"
import axios from "axios"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList,
} from "recharts"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

const COLORS = ["#1976D2","#388E3C","#FBC02D","#D32F2F","#7B1FA2","#0288D1","#C2185B","#FFA000"]

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

  const pieData = metricas.conversionPorVendedor.map(row => ({
    name: row.vendedor,
    value: row.tasa_conversion,
  }))

  const estados = [...new Set(metricas.estadosPorVendedor.map(e => e.estado))]
  const vendedores = [...new Set(metricas.estadosPorVendedor.map(e => e.vendedor))]
  const stackedData = vendedores.map(vendedor => {
    const obj: Record<string, string | number> = { vendedor }
    estados.forEach(estado => {
      const found = metricas.estadosPorVendedor.find(e => e.vendedor === vendedor && e.estado === estado)
      obj[estado] = found?.cantidad ?? 0
    })
    return obj
  })

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Métricas por Vendedor</h2>

      {/* Conversión y prospectos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Conversión por Vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
              <XAxis dataKey="vendedor" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Prospectos" fill={COLORS[0]}>
                <LabelList dataKey="Prospectos" position="top" fontSize={10} />
              </Bar>
              <Bar dataKey="Ventas" fill={COLORS[1]}>
                <LabelList dataKey="Ventas" position="top" fontSize={10} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pie conversión */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Conversión (%)</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, value }) => `${name}: ${value}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Stacked estados */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Prospectos por Estado y Vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            {stackedData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stackedData} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
                  <XAxis dataKey="vendedor" angle={-30} textAnchor="end" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  {estados.map((estado, i) => (
                    <Bar key={estado} dataKey={estado} stackId="a" fill={COLORS[i % COLORS.length]} />
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
