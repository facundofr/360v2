import { useState, useEffect, useMemo } from "react"
import axios from "axios"
import { RefreshCw, TrendingUp, Clock, CheckCircle, Users } from "lucide-react"
import { toast } from "sonner"
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface EfectividadHora {
  hora_ejecucion: string
  total_reasignados: number
  porcentaje_con_actividad: number
  porcentaje_cambio_estado: number
}

interface ResumenHoy {
  porcentaje_efectividad_hoy?: number
  con_actividad_hoy?: number
}

interface EstadisticasEfectividad {
  efectividad_por_hora?: EfectividadHora[]
  resumen_hoy?: ResumenHoy
}

interface Candidato {
  id: number
  nombre?: string
  apellido?: string
  vendedor_nombre?: string
  estado?: string
}

export default function ReasignacionAutomaticaAdmin() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [estadisticasEfectividad, setEstadisticasEfectividad] = useState<EstadisticasEfectividad | null>(null)
  const [candidatos, setCandidatos] = useState<Candidato[]>([])

  const token = useMemo(() => getAuthToken(), [])
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const fetchAll = async () => {
    setLoading(true); setError(null)
    try {
      const [efectividadRes, candRes] = await Promise.all([
        axios.get(`${API_URL}/reasignaciones/estadisticas-efectividad`, { headers: authHeaders }),
        axios.get(`${API_URL}/reasignaciones/candidatos`, { headers: authHeaders }),
      ])
      setEstadisticasEfectividad(efectividadRes.data ?? null)
      setCandidatos(candRes.data?.candidatos ?? [])
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Error al cargar información"
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const efectividadPorHora = estadisticasEfectividad?.efectividad_por_hora ?? []
  const resumenHoy = estadisticasEfectividad?.resumen_hoy ?? {}
  const ultimaEjecucion = efectividadPorHora[0] ?? null

  const promedioActividad = useMemo(() => {
    if (!efectividadPorHora.length) return 0
    return Math.round(efectividadPorHora.reduce((a, e) => a + Number(e.porcentaje_con_actividad ?? 0), 0) / efectividadPorHora.length)
  }, [efectividadPorHora])

  const promedioCambioEstado = useMemo(() => {
    if (!efectividadPorHora.length) return 0
    return Math.round(efectividadPorHora.reduce((a, e) => a + Number(e.porcentaje_cambio_estado ?? 0), 0) / efectividadPorHora.length)
  }, [efectividadPorHora])

  const chartData = useMemo(() => ({
    labels: [...efectividadPorHora].reverse().map(e => e.hora_ejecucion),
    data: [...efectividadPorHora].reverse(),
  }), [efectividadPorHora])

  const horasMostradas = efectividadPorHora.slice(0, 6)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" />
          <span className="font-semibold text-sm">Reasignación automática</span>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw className="size-3.5 mr-1" />Actualizar
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Tarjetas métricas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Clock className="size-4 text-muted-foreground" /></div>
              <p className="text-xs text-muted-foreground uppercase mb-1">Última corrida</p>
              {ultimaEjecucion ? (
                <>
                  <p className="font-bold">{ultimaEjecucion.hora_ejecucion}</p>
                  <p className="text-xs text-muted-foreground">{ultimaEjecucion.total_reasignados} reasignados</p>
                </>
              ) : <p className="text-sm text-muted-foreground">Sin ejecuciones hoy</p>}
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><CheckCircle className="size-4 text-muted-foreground" /></div>
              <p className="text-xs text-muted-foreground uppercase mb-1">Efectividad hoy</p>
              <p className="font-bold text-lg">{resumenHoy.porcentaje_efectividad_hoy ?? 0}%</p>
              <p className="text-xs text-muted-foreground">Con actividad: {resumenHoy.con_actividad_hoy ?? 0}</p>
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase mb-1">Promedio por hora</p>
              <p className="text-sm font-semibold text-primary">Actividad {promedioActividad}%</p>
              <p className="text-sm font-semibold text-blue-600">Cambio estado {promedioCambioEstado}%</p>
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Users className="size-4 text-muted-foreground" /></div>
              <p className="text-xs text-muted-foreground uppercase mb-1">Candidatos en cola</p>
              <p className="text-3xl font-bold">{candidatos.length}</p>
              <p className="text-xs text-muted-foreground">Pendientes de actividad</p>
            </CardContent></Card>
          </div>

          {/* Gráfico efectividad */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="size-4 text-green-500" />Efectividad por hora (hoy)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.data.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hay ejecuciones registradas hoy.</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData.data}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="hora_ejecucion" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Legend />
                    <Bar dataKey="porcentaje_cambio_estado" name="% Cambio de estado" fill="var(--primary)" radius={[4,4,0,0]} />
                    <Bar dataKey="porcentaje_con_actividad" name="% Actividad" fill="#20c997" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Tabla detalle últimas horas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />Detalle últimas horas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead className="text-right">Reasignados</TableHead>
                    <TableHead className="text-right">% Actividad</TableHead>
                    <TableHead className="text-right">% Cambio estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {horasMostradas.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sin datos</TableCell></TableRow>
                  ) : horasMostradas.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell><Badge variant="secondary">{h.hora_ejecucion}</Badge></TableCell>
                      <TableCell className="text-right font-bold">{h.total_reasignados}</TableCell>
                      <TableCell className="text-right text-green-600">{h.porcentaje_con_actividad ?? 0}%</TableCell>
                      <TableCell className="text-right text-blue-600">{h.porcentaje_cambio_estado ?? 0}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Candidatos */}
          {candidatos.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Candidatos en cola ({candidatos.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prospecto</TableHead>
                      <TableHead>Vendedor actual</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidatos.slice(0, 20).map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm font-medium">{c.nombre} {c.apellido}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.vendedor_nombre ?? "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{c.estado ?? "—"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            Vista simplificada: última corrida, efectividad del día, promedios por hora y backlog de candidatos.
          </div>
        </>
      )}
    </div>
  )
}
