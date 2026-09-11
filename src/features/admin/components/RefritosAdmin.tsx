import { useState, useEffect, useMemo } from "react"
import axios from "axios"
import { toast } from "sonner"
import { Pista } from "@/components/common/Medidor"
import { Upload, BarChart3, History, Download, CheckCircle, AlertCircle, Users, Ban, Paperclip, Check } from "lucide-react"
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts"
import type { ColumnDef } from "@tanstack/react-table"
import { refritosService } from "@/services/refritosService"
import { useConfirm } from "@/components/common/confirm-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/ui/data-table"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

// ─── SubTabs ─────────────────────────────────────────────────────────────────

interface EstadisticasData {
  total_refritos?: number
  pendientes?: number
  contactados?: number
  ventas?: number
  sin_contacto?: number
  /** Real: `refritosModel.js` obtenerEstadisticasRefritos agrupa por estado y
   * visibilidad — no existe ni `definitivos` ni `por_vendedor` en la respuesta. */
  desglose_por_estado?: { estado: string; visible_refrito: number; total: number }[]
}

function CargarRefritos({ onSuccess }: { onSuccess: () => void }) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [cargando, setCargando] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [resultado, setResultado] = useState<Record<string, unknown> | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!["csv", "xlsx", "xls"].includes(ext ?? "")) {
      toast.error("Solo se permiten archivos CSV, XLSX o XLS")
      return
    }
    setArchivo(file)
    setResultado(null)
  }

  const handleCargar = async () => {
    if (!archivo) { toast.warning("Selecciona un archivo primero"); return }
    setCargando(true); setProgreso(0)
    const formData = new FormData()
    formData.append("archivo", archivo)
    const interval = setInterval(() => setProgreso(p => Math.min(p + 10, 90)), 200)
    try {
      const token = getAuthToken()
      const { data } = await axios.post(`${API_URL}/admin/refritos/cargar`, formData, {
        headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${token}` }
      })
      clearInterval(interval); setProgreso(100)
      setResultado(data)
      setArchivo(null)
      const input = document.getElementById("archivoRefritosInput") as HTMLInputElement
      if (input) input.value = ""
      toast.success(`${(data.resumen as { totalProcesados?: number })?.totalProcesados ?? "varios"} refritos procesados`)
      onSuccess()
    } catch (err: unknown) {
      clearInterval(interval); setProgreso(0)
      const msg = (err as { response?: { data?: { message?: string; columnas_faltantes?: string[] } } })?.response?.data
      toast.error(msg?.columnas_faltantes?.length ? `${msg.message} — Faltan: ${msg.columnas_faltantes.join(", ")}` : msg?.message ?? "Error al cargar")
    } finally {
      setCargando(false)
    }
  }

  const descargarEjemplo = async () => {
    try {
      const token = getAuthToken()
      const res = await axios.get(`${API_URL}/admin/refritos/descargar-ejemplo`, { headers: { Authorization: `Bearer ${token}` }, responseType: "blob" })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement("a"); a.href = url; a.download = "ejemplo_refritos.csv"; document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch { toast.error("Error al descargar ejemplo") }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted p-4 text-sm space-y-1">
        <p className="font-medium">Requisitos del archivo</p>
        <ul className="list-disc list-inside text-muted-foreground space-y-0.5 text-xs">
          <li>Formato: CSV, XLSX o XLS</li>
          <li>Columnas obligatorias: nombre, apellido, edad, numero_contacto, correo, localidad</li>
          <li>Columnas opcionales: tipo_afiliacion_id, sueldo_bruto, categoria_monotributo, comentario</li>
          <li>Tipos de afiliación: 1=Particular, 2=Con Recibo, 3=Monotributo</li>
        </ul>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Seleccionar archivo</label>
        <input
          id="archivoRefritosInput"
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          disabled={cargando}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:text-sm file:cursor-pointer cursor-pointer border rounded-lg p-1"
        />
        {archivo && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Paperclip className="size-3 shrink-0" aria-hidden="true" />{archivo.name}</p>}
      </div>

      {cargando && progreso > 0 && (
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progreso}%` }} />
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleCargar} disabled={!archivo || cargando}>
          <Upload className="size-4 mr-1" />{cargando ? "Cargando..." : "Cargar archivo"}
        </Button>
        <Button variant="outline" onClick={descargarEjemplo}>
          <Download className="size-4 mr-1" />Descargar ejemplo
        </Button>
      </div>

      {resultado && (
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-state-ok-text">
            <CheckCircle className="size-4" />Archivo procesado
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {Object.entries((resultado.resumen ?? {}) as Record<string, number>).map(([k, v]) => (
              <div key={k} className="bg-paper-sunk rounded p-2">
                <p className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</p>
                <p className="font-bold">{String(v)}</p>
              </div>
            ))}
          </div>
          {Array.isArray((resultado as { errores?: unknown[] }).errores) && (resultado as { errores: unknown[] }).errores.length > 0 && (
            <div className="rounded border border-state-risk/30 bg-state-risk-soft p-3">
              <div className="flex items-center gap-1 text-sm font-medium text-state-risk-text mb-2"><AlertCircle className="size-3" />Errores</div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {((resultado as { errores: Array<{ fila?: number; error?: string }> }).errores).map((e, i) => (
                  <p key={i} className="text-xs text-state-risk-text">Fila {e.fila}: {e.error}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Colores por estado del "Desglose por Estado" — réplica del colorMap de
 * EstadisticasRefritos.jsx (v1); estados fuera del mapa caen en --chart-2. */
const COLOR_DESGLOSE: Record<string, string> = {
  Venta: "var(--state-ok)",
  "No contesta": "var(--state-risk)",
  Lead: "var(--state-warn)",
  "1º Contacto": "var(--primary)",
}

function EstadisticasRefritos({ refreshTrigger }: { refreshTrigger: number }) {
  const [stats, setStats] = useState<EstadisticasData | null>(null)
  const [definitivos, setDefinitivos] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const token = getAuthToken()
        const [{ data: estData }, { data: listData }] = await Promise.all([
          axios.get(`${API_URL}/admin/refritos/estadisticas`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_URL}/admin/refritos/listar`, { headers: { Authorization: `Bearer ${token}` } }),
        ])
        setStats(estData?.estadisticas ?? estData)
        // "Definitivos": pasaron por todos los vendedores sin contacto — no es un
        // campo del backend, se computa igual que en v1 (comentario con "DEFINITIVO").
        const refritos = (listData?.refritos ?? []) as Array<{ comentario?: string }>
        setDefinitivos(refritos.filter(r => r.comentario?.includes("DEFINITIVO")).length)
      } catch { toast.error("Error al cargar estadísticas") }
      finally { setLoading(false) }
    }
    fetch()
  }, [refreshTrigger])

  if (loading) return <Skeleton className="h-64 w-full" />
  if (!stats) return <p className="text-sm text-muted-foreground text-center py-8">Sin estadísticas</p>

  const tarjetas = [
    { label: "Total", value: stats.total_refritos ?? 0 },
    { label: "Pendientes", value: stats.pendientes ?? 0 },
    { label: "Contactados", value: stats.contactados ?? 0 },
    { label: "Ventas", value: stats.ventas ?? 0 },
    { label: "Sin contacto", value: stats.sin_contacto ?? 0 },
    { label: "Definitivos", value: definitivos },
  ]

  // Nota: sin useMemo — el componente ya tiene returns tempranos arriba
  // (loading / sin stats) antes de este punto, así que un hook acá violaría
  // las reglas de hooks. Recrear este array chico en cada render no pesa.
  const desglose = [...(stats.desglose_por_estado ?? [])]
    .sort((a, b) => b.total - a.total)
    .map(item => ({
      estado: item.estado,
      total: item.total,
      label: item.visible_refrito === 1 ? `${item.estado} (visible)` : `${item.estado} (cola)`,
      color: item.visible_refrito === 1 ? (COLOR_DESGLOSE[item.estado] ?? "var(--chart-2)") : "var(--muted-foreground)",
    }))

  return (
    <div className="space-y-4">
      <dl className="readout">
        {tarjetas.map(t => (
          <div key={t.label}>
            <dt>{t.label}</dt>
            <dd>{t.value}</dd>
          </div>
        ))}
      </dl>

      {desglose.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Desglose por estado</CardTitle></CardHeader>
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={Math.max(300, desglose.length * 40)}>
              <BarChart data={desglose} layout="vertical" margin={{ top: 5, right: 40, left: 140, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" width={135} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${v} refritos`, "Cantidad"]} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {desglose.map((d, i) => <Cell key={i} fill={d.color} />)}
                  <LabelList dataKey="total" position="right" style={{ fontSize: 12, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2">
              Total: {desglose.reduce((sum, i) => sum + i.total, 0)} refritos — tonos sólidos = visibles, gris = en cola
            </p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        El detalle de asignaciones por vendedor (visibles/en cola/no contesta/trabajados) está en la pestaña "Por vendedor".
      </p>
    </div>
  )
}

function HistoricoRefritos({ refreshTrigger }: { refreshTrigger: number }) {
  const confirm = useConfirm()
  const [historico, setHistorico] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState("todos")
  const [eliminandoId, setEliminandoId] = useState<number | null>(null)

  /** Saca al prospecto del circuito de refritos (POST .../eliminar-flujo). */
  const eliminarDelFlujo = async (prospectoId: number, nombre: string) => {
    const ok = await confirm({
      title: `¿Sacar a ${nombre || `#${prospectoId}`} del circuito de refritos?`,
      description: "El prospecto deja de reciclarse y no vuelve a asignarse automáticamente.",
      confirmText: "Sacar del flujo",
      destructive: true,
    })
    if (!ok) return

    setEliminandoId(prospectoId)
    try {
      await refritosService.eliminarDelFlujo(prospectoId)
      toast.success("Prospecto retirado del circuito de refritos")
      setHistorico(prev => prev.filter(r => Number((r as { id?: number }).id) !== prospectoId))
    } catch {
      toast.error("No se pudo retirar el prospecto")
    } finally {
      setEliminandoId(null)
    }
  }

  // Únicos 4 estados que v1 ofrece como filtro estático (HistoricoRefritos.jsx) —
  // los anteriores ("No interesado", "Pendiente", "Contactado") no son valores
  // reales de `asignaciones.estado" y el filtro nunca traía resultados con ellos.
  const ESTADOS_REFRITOS = ["Lead", "1º Contacto", "Venta", "No contesta"]

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const token = getAuthToken()
        const { data } = await axios.get(`${API_URL}/admin/refritos/listar`, { headers: { Authorization: `Bearer ${token}` } })
        setHistorico(data?.data ?? data ?? [])
      } catch { toast.error("Error al cargar histórico") }
      finally { setLoading(false) }
    }
    fetch()
  }, [refreshTrigger])

  const filtrado = filtroEstado === "todos"
    ? (historico as Array<Record<string, unknown>>)
    : (historico as Array<Record<string, unknown>>).filter(r => r.estado === filtroEstado)

  const columnas = useMemo<ColumnDef<Record<string, unknown>>[]>(() => [
    {
      id: "nombre",
      header: "Nombre",
      meta: { className: "text-sm font-medium" },
      accessorFn: (r) => `${r.nombre ?? ""} ${r.apellido ?? ""}`,
    },
    {
      accessorKey: "numero_contacto",
      header: "Teléfono",
      meta: { className: "hidden sm:table-cell text-sm text-muted-foreground" },
      cell: ({ row }) => String(row.original.numero_contacto ?? "—"),
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => <Badge variant="outline" className="text-xs">{String(row.original.estado ?? "—")}</Badge>,
    },
    {
      accessorKey: "vendedor",
      header: "Vendedor",
      meta: { className: "hidden md:table-cell text-sm text-muted-foreground" },
      cell: ({ row }) => String(row.original.vendedor ?? "—"),
    },
    {
      accessorKey: "fecha_asignacion",
      header: "Fecha",
      meta: { className: "hidden lg:table-cell text-xs text-muted-foreground" },
      cell: ({ row }) => row.original.fecha_asignacion ? new Date(String(row.original.fecha_asignacion)).toLocaleDateString("es-AR") : "—",
    },
    {
      id: "acciones",
      header: "",
      enableSorting: false,
      meta: { className: "w-12" },
      cell: ({ row }) => {
        const r = row.original
        return (
          <Button
            size="icon" variant="outline" className="size-8"
            title="Sacar del circuito de refritos"
            disabled={eliminandoId === Number(r.id)}
            onClick={() => eliminarDelFlujo(Number(r.id), `${r.nombre ?? ""} ${r.apellido ?? ""}`.trim())}
          >
            <Ban className="size-3.5 text-muted-foreground" />
          </Button>
        )
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [eliminandoId])

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="text-sm border rounded-lg px-3 py-1.5 bg-background"
        >
          <option value="todos">Todos los estados</option>
          {ESTADOS_REFRITOS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <span className="text-xs text-muted-foreground self-center">{filtrado.length} registros</span>
      </div>
      {loading ? <Skeleton className="h-64 w-full" /> : (
        <DataTable columns={columnas} data={filtrado} emptyMessage="Sin registros" />
      )}
    </div>
  )
}

// ─── Principal ────────────────────────────────────────────────────────────────
// ─── Reporte por vendedor (GET /admin/refritos/reporte-vendedores) ──────────
// Campos reales de `refritosModel.js` obtenerReportePorVendedor — antes esta
// interfaz tenía campos inventados (vendedor_nombre/total_refritos/etc.) que
// el backend nunca devuelve, dejando la tabla siempre en 0/"—".
interface FilaReporte {
  id: number
  first_name?: string
  last_name?: string
  visible_actual?: number
  en_cola?: number
  no_contesta?: number
  otros_estados?: number
  total_asignaciones?: number
}

function ReporteVendedoresRefritos({ refreshTrigger }: { refreshTrigger: number }) {
  const [filas, setFilas] = useState<FilaReporte[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false
    const cargar = async () => {
      setLoading(true)
      try {
        const data = await refritosService.obtenerReporteVendedores()
        if (!cancelado) setFilas(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelado) { setFilas([]); toast.error("No se pudo cargar el reporte por vendedor") }
      } finally {
        if (!cancelado) setLoading(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [refreshTrigger])

  if (loading) return <Skeleton className="h-64 w-full rounded-lg" />

  if (filas.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <Users className="size-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Todavía no hay refritos asignados a vendedores.</p>
      </CardContent></Card>
    )
  }

  // Sin useMemo: hay returns tempranos arriba (loading / sin filas) antes de
  // este punto, así que un hook acá violaría las reglas de hooks.
  // Réplica de la tabla "Estado de Asignaciones por Vendedor" de
  // EstadisticasRefritos.jsx (v1): visibles/en cola/no contesta/trabajados
  // sobre el total, con dos barras de avance (% avanzado y % gestionado).
  const columnas: ColumnDef<FilaReporte>[] = [
    {
      id: "vendedor",
      header: "Vendedor",
      meta: { className: "font-medium text-sm" },
      accessorFn: f => `${f.first_name ?? ""} ${f.last_name ?? ""}`.trim() || `#${f.id}`,
    },
    {
      accessorKey: "visible_actual",
      header: "Visibles",
      meta: { className: "text-center", headerClassName: "text-center" },
      cell: ({ row }) => {
        const v = row.original.visible_actual ?? 0
        return <Badge variant={v > 0 ? "ok" : "secondary"}>{v}</Badge>
      },
    },
    {
      accessorKey: "en_cola",
      header: "En cola",
      meta: { className: "text-center", headerClassName: "text-center" },
      cell: ({ row }) => {
        const v = row.original.en_cola ?? 0
        return <Badge variant={v > 10 ? "default" : v > 0 ? "warn" : "secondary"}>{v}</Badge>
      },
    },
    {
      accessorKey: "no_contesta",
      header: "No contesta",
      meta: { className: "text-center", headerClassName: "text-center" },
      cell: ({ row }) => <Badge variant="risk">{row.original.no_contesta ?? 0}</Badge>,
    },
    {
      accessorKey: "otros_estados",
      header: "Trabajados",
      meta: { className: "text-center", headerClassName: "text-center" },
      cell: ({ row }) => <Badge variant="default">{row.original.otros_estados ?? 0}</Badge>,
    },
    {
      accessorKey: "total_asignaciones",
      header: "Total",
      meta: { className: "text-center font-medium", headerClassName: "text-center" },
      cell: ({ row }) => row.original.total_asignaciones ?? 0,
    },
    {
      id: "pct_avanzado",
      header: "% Avanzado",
      meta: { className: "min-w-[120px]" },
      cell: ({ row }) => {
        const total = row.original.total_asignaciones ?? 0
        const trabajados = row.original.otros_estados ?? 0
        if (total === 0) return <span className="text-muted-foreground text-xs">—</span>
        const pct = (trabajados / total) * 100
        return (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
            <Pista porcentaje={pct} tono={pct >= 60 ? "ok" : pct >= 20 ? "warn" : "risk"} />
          </div>
        )
      },
    },
    {
      id: "pct_gestionado",
      header: "% Gestionado",
      meta: { className: "min-w-[120px]" },
      cell: ({ row }) => {
        const total = row.original.total_asignaciones ?? 0
        const trabajados = row.original.otros_estados ?? 0
        const noContesta = row.original.no_contesta ?? 0
        if (total === 0) return <span className="text-muted-foreground text-xs">—</span>
        const pct = ((trabajados + noContesta) / total) * 100
        return (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%{Math.round(pct) === 100 && <Check className="ml-1 inline size-3 align-[-1px] text-state-ok-text" aria-hidden="true" />}</p>
            <Pista porcentaje={pct} tono={pct >= 60 ? "ok" : pct >= 20 ? "warn" : "risk"} />
          </div>
        )
      },
    },
  ]

  return <DataTable columns={columnas} data={filas} />
}

export default function RefritosAdmin() {
  const [estadisticas, setEstadisticas] = useState<EstadisticasData | null>(null)
  const [refreshStats, setRefreshStats] = useState(0)

  useEffect(() => {
    const fetch = async () => {
      try {
        const token = getAuthToken()
        const { data } = await axios.get(`${API_URL}/admin/refritos/estadisticas`, { headers: { Authorization: `Bearer ${token}` } })
        setEstadisticas(data?.estadisticas ?? data)
      } catch { /* silencioso */ }
    }
    fetch()
  }, [refreshStats])

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Carga y distribuye prospectos reciclados entre vendedores.</p>
      </div>

      {/* Stats rápidas */}
      {estadisticas && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: estadisticas.total_refritos ?? 0 },
            { label: "Pendientes", value: estadisticas.pendientes ?? 0 },
            { label: "Contactados", value: estadisticas.contactados ?? 0 },
            { label: "Ventas", value: estadisticas.ventas ?? 0 },
          ].map(t => (
            <Card key={t.label}><CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{t.value}</p>
              <p className="text-xs text-muted-foreground">{t.label}</p>
            </CardContent></Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="cargar">
        <TabsList className="mb-2">
          <TabsTrigger value="cargar" className="gap-1.5"><Upload className="size-3.5" />Cargar</TabsTrigger>
          <TabsTrigger value="estadisticas" className="gap-1.5"><BarChart3 className="size-3.5" />Estadísticas</TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5"><History className="size-3.5" />Histórico</TabsTrigger>
          <TabsTrigger value="reporte" className="gap-1.5"><Users className="size-3.5" />Por vendedor</TabsTrigger>
        </TabsList>
        <TabsContent value="cargar">
          <CargarRefritos onSuccess={() => setRefreshStats(s => s + 1)} />
        </TabsContent>
        <TabsContent value="estadisticas">
          <EstadisticasRefritos refreshTrigger={refreshStats} />
        </TabsContent>
        <TabsContent value="historico">
          <HistoricoRefritos refreshTrigger={refreshStats} />
        </TabsContent>
        <TabsContent value="reporte">
          <ReporteVendedoresRefritos refreshTrigger={refreshStats} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
