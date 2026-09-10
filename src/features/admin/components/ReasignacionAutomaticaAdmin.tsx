import { useState, useEffect, useMemo } from "react"
import axios from "axios"
import { RefreshCw, TrendingUp, Clock, CheckCircle, Users, CalendarDays } from "lucide-react"
import { toast } from "sonner"
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts"
import type { ColumnDef } from "@tanstack/react-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Feriado {
  date: string
  name?: string
  localName?: string
  type?: string
  types?: string[]
}

const NOMBRES_MES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
const DIAS_SEMANA = ["L","M","X","J","V","S","D"]

function pad2(n: number) { return String(n).padStart(2, "0") }
function isoLocal(y: number, m0: number, d: number) { return `${y}-${pad2(m0 + 1)}-${pad2(d)}` }

interface Celda { date: Date; inMonth: boolean; iso: string; isHoliday: boolean }

/** Réplica de `ReasignacionAutomaticaAdmin.jsx:169-207` — semana arranca lunes. */
function construirMatrizMes(y: number, m0: number, feriadosSet: Set<string>): Celda[][] {
  const first = new Date(y, m0, 1)
  let startIdx = first.getDay()
  startIdx = (startIdx + 6) % 7
  const daysInMonth = new Date(y, m0 + 1, 0).getDate()
  const prevMonthDays = new Date(y, m0, 0).getDate()
  const cells: Celda[] = []
  for (let i = 0; i < startIdx; i++) {
    const day = prevMonthDays - startIdx + 1 + i
    const date = new Date(y, m0 - 1, day)
    cells.push({ date, inMonth: false, iso: isoLocal(date.getFullYear(), date.getMonth(), date.getDate()), isHoliday: feriadosSet.has(isoLocal(date.getFullYear(), date.getMonth(), date.getDate())) })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m0, d)
    const iso = isoLocal(y, m0, d)
    cells.push({ date, inMonth: true, iso, isHoliday: feriadosSet.has(iso) })
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1].date
    const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1)
    const iso = isoLocal(next.getFullYear(), next.getMonth(), next.getDate())
    cells.push({ date: next, inMonth: false, iso, isHoliday: feriadosSet.has(iso) })
  }
  const rows: Celda[][] = []
  for (let i = 0; i < 6; i++) rows.push(cells.slice(i * 7, i * 7 + 7))
  return rows
}

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
  const [feriados, setFeriados] = useState<Feriado[]>([])
  const [anioFeriados, setAnioFeriados] = useState(new Date().getFullYear())
  const [mesFeriados, setMesFeriados] = useState(new Date().getMonth())
  const [loadingFeriados, setLoadingFeriados] = useState(false)

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

  // GET /reasignaciones/feriados (`ReasignacionAutomaticaAdmin.jsx:52-65,342-457`)
  const fetchFeriados = async (anio: number, opts: { refresh?: boolean } = {}) => {
    setLoadingFeriados(true)
    try {
      const { data } = await axios.get(`${API_URL}/reasignaciones/feriados`, {
        headers: authHeaders,
        params: { anio, refresh: opts.refresh ? 1 : 0 },
      })
      setFeriados(data?.holidays ?? [])
    } catch {
      // no romper la vista principal
    } finally {
      setLoadingFeriados(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchFeriados(anioFeriados) }, [anioFeriados])

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

  const columnasHoras = useMemo<ColumnDef<EfectividadHora>[]>(() => [
    {
      accessorKey: "hora_ejecucion",
      header: "Hora",
      cell: ({ row }) => <Badge variant="secondary">{row.original.hora_ejecucion}</Badge>,
    },
    {
      accessorKey: "total_reasignados",
      header: "Reasignados",
      meta: { className: "text-right font-bold", headerClassName: "text-right" },
    },
    {
      accessorKey: "porcentaje_con_actividad",
      header: "% Actividad",
      meta: { className: "text-right", headerClassName: "text-right" },
      cell: ({ row }) => `${row.original.porcentaje_con_actividad ?? 0}%`,
    },
    {
      accessorKey: "porcentaje_cambio_estado",
      header: "% Cambio estado",
      meta: { className: "text-right", headerClassName: "text-right" },
      cell: ({ row }) => `${row.original.porcentaje_cambio_estado ?? 0}%`,
    },
  ], [])

  const feriadosSet = useMemo(() => new Set(feriados.map(f => f.date)), [feriados])
  const matrizMes = useMemo(() => construirMatrizMes(anioFeriados, mesFeriados, feriadosSet), [anioFeriados, mesFeriados, feriadosSet])
  const feriadosPorMes = useMemo(() => {
    const map = new Map<number, Feriado[]>()
    feriados.forEach(f => {
      const mes = new Date(`${f.date}T00:00:00`).getMonth()
      if (!map.has(mes)) map.set(mes, [])
      map.get(mes)!.push(f)
    })
    for (const [k, arr] of map.entries()) map.set(k, [...arr].sort((a, b) => a.date.localeCompare(b.date)))
    return map
  }, [feriados])

  const columnasCandidatos = useMemo<ColumnDef<Candidato>[]>(() => [
    {
      id: "prospecto",
      header: "Prospecto",
      meta: { className: "text-sm font-medium" },
      accessorFn: (c) => `${c.nombre ?? ""} ${c.apellido ?? ""}`,
    },
    {
      accessorKey: "vendedor_nombre",
      header: "Vendedor actual",
      meta: { className: "text-sm text-muted-foreground" },
      cell: ({ row }) => row.original.vendedor_nombre ?? "—",
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => <Badge variant="outline" className="text-xs">{row.original.estado ?? "—"}</Badge>,
    },
  ], [])

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
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
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
              <p className="text-sm font-semibold">Actividad {promedioActividad}%</p>
              <p className="text-sm font-semibold">Cambio estado {promedioCambioEstado}%</p>
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
                <CheckCircle className="size-4 text-muted-foreground" />Efectividad por hora (hoy)
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
                    <Bar dataKey="porcentaje_con_actividad" name="% Actividad" fill="var(--chart-2)" radius={[4,4,0,0]} />
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
            <CardContent className="p-4">
              <DataTable columns={columnasHoras} data={horasMostradas} hideColumnToggle emptyMessage="Sin datos" />
            </CardContent>
          </Card>

          {/* Candidatos */}
          {candidatos.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Candidatos en cola ({candidatos.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <DataTable columns={columnasCandidatos} data={candidatos} hideColumnToggle />
              </CardContent>
            </Card>
          )}

          <div className="rounded-lg bg-paper-sunk p-3 text-xs text-muted-foreground">
            Vista simplificada: última corrida, efectividad del día, promedios por hora y backlog de candidatos.
          </div>

          {/* Feriados nacionales (Argentina) */}
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0 flex-wrap gap-2">
              <CardTitle className="text-sm">Feriados nacionales (Argentina)</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={String(mesFeriados)} onValueChange={v => setMesFeriados(Number(v))}>
                  <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NOMBRES_MES.map((n, m) => <SelectItem key={m} value={String(m)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={String(anioFeriados)} onValueChange={v => setAnioFeriados(Number(v))}>
                  <SelectTrigger className="h-8 w-[100px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[anioFeriados - 1, anioFeriados, anioFeriados + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="h-8" onClick={() => fetchFeriados(anioFeriados, { refresh: true })} disabled={loadingFeriados}>
                  <RefreshCw className={loadingFeriados ? "size-3.5 mr-1 animate-spin" : "size-3.5 mr-1"} />Refrescar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingFeriados ? (
                <Skeleton className="h-64 w-full" />
              ) : feriados.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Sin datos de feriados para {anioFeriados}.</p>
              ) : (
                <>
                  {/* Calendario mensual */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">{NOMBRES_MES[mesFeriados]} {anioFeriados}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="size-3" />Días feriados marcados
                      </p>
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {DIAS_SEMANA.map(d => (
                        <div key={d} className="text-center text-xs text-muted-foreground">{d}</div>
                      ))}
                      {matrizMes.flat().map((cell, idx) => {
                        const nombreFeriado = feriados.find(f => f.date === cell.iso)
                        return (
                          <div
                            key={idx}
                            title={cell.isHoliday ? (nombreFeriado?.localName ?? nombreFeriado?.name) : undefined}
                            className={`border rounded-md p-1.5 text-center min-h-12 ${cell.isHoliday ? "bg-state-ok-soft" : ""} ${cell.inMonth ? "" : "opacity-50"}`}
                          >
                            <p className="font-semibold text-xs leading-none">{cell.date.getDate()}</p>
                            {cell.isHoliday && <Badge variant="ok" size="sm" className="mt-1 px-1">Feriado</Badge>}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Lista agrupada por mes */}
                  <Accordion type="multiple">
                    {NOMBRES_MES.map((nombreMes, mes) => {
                      const items = feriadosPorMes.get(mes) ?? []
                      return (
                        <AccordionItem key={mes} value={String(mes)}>
                          <AccordionTrigger>
                            <span className="flex items-center gap-2">
                              {nombreMes}<Badge variant="secondary">{items.length}</Badge>
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            {items.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Sin feriados</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-32">Fecha</TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Tipo</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {items.map((f, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell><Badge variant="secondary">{f.date}</Badge></TableCell>
                                      <TableCell className="text-sm">{f.localName ?? f.name}</TableCell>
                                      <TableCell>
                                        {(Array.isArray(f.types) ? f.types : [f.type ?? "Public"]).map((t, i) => (
                                          <Badge key={i} variant={t === "Public" ? "ok" : "outline"} className="mr-1 text-xs">{t}</Badge>
                                        ))}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      )
                    })}
                  </Accordion>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
