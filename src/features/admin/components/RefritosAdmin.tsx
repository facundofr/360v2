import { useState, useEffect } from "react"
import axios from "axios"
import { toast } from "sonner"
import { Upload, BarChart3, History, Download, CheckCircle, AlertCircle, Users, Ban } from "lucide-react"
import { refritosService } from "@/services/refritosService"
import { useConfirm } from "@/components/common/confirm-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

// ─── SubTabs ─────────────────────────────────────────────────────────────────

interface EstadisticasData {
  total_refritos?: number
  pendientes?: number
  contactados?: number
  ventas?: number
  sin_contacto?: number
  definitivos?: number
  por_vendedor?: { vendedor_nombre: string; total: number; pendientes: number; contactados: number; ventas: number }[]
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
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4 text-sm space-y-1">
        <p className="font-medium text-blue-800 dark:text-blue-400">Requisitos del archivo</p>
        <ul className="list-disc list-inside text-blue-700 dark:text-blue-300 space-y-0.5 text-xs">
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
          className="block w-full text-sm text-muted-foreground file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-primary file:text-white file:text-sm file:cursor-pointer cursor-pointer border rounded-lg p-1"
        />
        {archivo && <p className="text-xs text-muted-foreground">📁 {archivo.name}</p>}
      </div>

      {cargando && progreso > 0 && (
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progreso}%` }} />
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleCargar} disabled={!archivo || cargando} className="bg-primary hover:bg-primary/90">
          <Upload className="size-4 mr-1" />{cargando ? "Cargando..." : "Cargar archivo"}
        </Button>
        <Button variant="outline" onClick={descargarEjemplo}>
          <Download className="size-4 mr-1" />Descargar ejemplo
        </Button>
      </div>

      {resultado && (
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-green-700">
            <CheckCircle className="size-4" />Archivo procesado
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {Object.entries((resultado.resumen ?? {}) as Record<string, number>).map(([k, v]) => (
              <div key={k} className="bg-muted/50 rounded p-2">
                <p className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</p>
                <p className="font-bold">{String(v)}</p>
              </div>
            ))}
          </div>
          {Array.isArray((resultado as { errores?: unknown[] }).errores) && (resultado as { errores: unknown[] }).errores.length > 0 && (
            <div className="rounded border border-red-200 bg-red-50 dark:bg-red-950/20 p-3">
              <div className="flex items-center gap-1 text-sm font-medium text-red-700 mb-2"><AlertCircle className="size-3" />Errores</div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {((resultado as { errores: Array<{ fila?: number; error?: string }> }).errores).map((e, i) => (
                  <p key={i} className="text-xs text-red-600">Fila {e.fila}: {e.error}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EstadisticasRefritos({ refreshTrigger }: { refreshTrigger: number }) {
  const [stats, setStats] = useState<EstadisticasData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const token = getAuthToken()
        const { data } = await axios.get(`${API_URL}/admin/refritos/estadisticas`, { headers: { Authorization: `Bearer ${token}` } })
        setStats(data?.estadisticas ?? data)
      } catch { toast.error("Error al cargar estadísticas") }
      finally { setLoading(false) }
    }
    fetch()
  }, [refreshTrigger])

  if (loading) return <Skeleton className="h-64 w-full" />
  if (!stats) return <p className="text-sm text-muted-foreground text-center py-8">Sin estadísticas</p>

  const tarjetas = [
    { label: "Total", value: stats.total_refritos ?? 0, color: "text-primary" },
    { label: "Pendientes", value: stats.pendientes ?? 0, color: "text-amber-500" },
    { label: "Contactados", value: stats.contactados ?? 0, color: "text-sky-500" },
    { label: "Ventas", value: stats.ventas ?? 0, color: "text-emerald-500" },
    { label: "Sin contacto", value: stats.sin_contacto ?? 0, color: "text-orange-500" },
    { label: "Definitivos", value: stats.definitivos ?? 0, color: "text-red-500" },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {tarjetas.map(t => (
          <Card key={t.label}><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{t.value}</p>
            <p className="text-xs text-muted-foreground">{t.label}</p>
          </CardContent></Card>
        ))}
      </div>

      {stats.por_vendedor && stats.por_vendedor.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Distribución por vendedor</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="hidden sm:table-cell">Pendientes</TableHead>
                  <TableHead className="hidden sm:table-cell">Contactados</TableHead>
                  <TableHead>Ventas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.por_vendedor.map((v, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium">{v.vendedor_nombre}</TableCell>
                    <TableCell className="text-sm">{v.total}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-yellow-600">{v.pendientes}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-blue-600">{v.contactados}</TableCell>
                    <TableCell className="text-sm text-green-600 font-medium">{v.ventas}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
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

  const ESTADOS_REFRITOS = ["Lead", "Venta", "No contesta", "No interesado", "Pendiente", "Contactado"]

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
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden sm:table-cell">Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden md:table-cell">Vendedor</TableHead>
                <TableHead className="hidden lg:table-cell">Fecha</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrado.slice(0, 100).map((r, i) => (
                <TableRow key={String(r.id ?? i)}>
                  <TableCell className="text-sm font-medium">{String(r.nombre ?? "")} {String(r.apellido ?? "")}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{String(r.numero_contacto ?? "—")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{String(r.estado ?? "—")}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{String(r.vendedor_nombre ?? "—")}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {r.created_at ? new Date(String(r.created_at)).toLocaleDateString("es-AR") : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon" variant="outline" className="size-8"
                      title="Sacar del circuito de refritos"
                      disabled={eliminandoId === Number(r.id)}
                      onClick={() => eliminarDelFlujo(Number(r.id), `${r.nombre ?? ""} ${r.apellido ?? ""}`.trim())}
                    >
                      <Ban className="size-3.5 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtrado.length === 0 && <div className="text-center py-10 text-sm text-muted-foreground">Sin registros</div>}
        </div>
      )}
    </div>
  )
}

// ─── Principal ────────────────────────────────────────────────────────────────
// ─── Reporte por vendedor (GET /admin/refritos/reporte-vendedores) ──────────
interface FilaReporte {
  vendedor_id?: number
  vendedor_nombre?: string
  nombre?: string
  total_refritos?: number
  refritos_activos?: number
  convertidos?: number
  tasa_conversion?: number
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

  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />

  if (filas.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <Users className="size-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Todavía no hay refritos asignados a vendedores.</p>
      </CardContent></Card>
    )
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendedor</TableHead>
            <TableHead className="text-right">Total refritos</TableHead>
            <TableHead className="text-right">Activos</TableHead>
            <TableHead className="text-right">Convertidos</TableHead>
            <TableHead className="text-right">Tasa</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((f, i) => (
            <TableRow key={f.vendedor_id ?? i}>
              <TableCell className="font-medium text-sm">
                {f.vendedor_nombre ?? f.nombre ?? `#${f.vendedor_id ?? i}`}
              </TableCell>
              <TableCell className="text-right">{f.total_refritos ?? 0}</TableCell>
              <TableCell className="text-right">{f.refritos_activos ?? 0}</TableCell>
              <TableCell className="text-right text-emerald-600 font-medium">{f.convertidos ?? 0}</TableCell>
              <TableCell className="text-right">
                {f.tasa_conversion != null ? `${f.tasa_conversion}%` : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
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
