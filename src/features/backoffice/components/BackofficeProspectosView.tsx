import { useEffect, useState, useCallback } from "react"
import axios from "axios"
import { toast } from "sonner"
import {
  Search, Filter, Download, RefreshCw, History, DollarSign,
  MessageCircle, Edit, ArrowLeftRight, Users, Calendar,
  FileText, ShieldCheck, TrendingUp, Phone, Mail, ChevronLeft, ChevronRight,
  LayoutGrid, List
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/common/StatCard"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { getBadgeEstado } from "@/utils/estadosHelper"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Prospecto {
  id: number
  nombre: string
  apellido: string
  edad?: number
  localidad?: string
  correo?: string
  numero_contacto?: string
  whatsapp_opt_in?: boolean
  estado: string
  vendedor_nombre?: string
  vendedor_apellido?: string
  vendedor_email?: string
  supervisor_nombre?: string
  supervisor_apellido?: string
  fecha_registro?: string
  cotizaciones_count?: number
  polizas_count?: number
  acciones_count?: number
  ultima_accion?: string
}

interface FiltroOpciones {
  vendedores: { id: number; first_name: string; last_name: string }[]
  supervisores: { id: number; first_name: string; last_name: string }[]
  estados: { estado: string; count: number }[]
}

interface Estadisticas {
  total_prospectos?: number
  prospectos_hoy?: number
  con_cotizaciones?: number
  con_polizas?: number
  ventas?: number
  whatsapp_activo?: number
}

const ESTADOS_DISPONIBLES = [
  "Lead", "1º Contacto", "Calificado Cotización", "Calificado Póliza",
  "Calificado Pago", "Venta", "Fuera de zona", "Fuera de edad",
  "Preexistencia", "Reafiliación", "No contesta", "prueba interna",
  "Ya es socio", "Busca otra Cobertura", "Teléfono erróneo",
  "No le interesa (económico)", "No le interesa cartilla", "No busca cobertura médica",
]

export function BackofficeProspectosView() {
  const [prospectos, setProspectos] = useState<Prospecto[]>([])
  const [loading, setLoading] = useState(false)
  const [estadisticas, setEstadisticas] = useState<Estadisticas>({})
  const [opcionesFiltros, setOpcionesFiltros] = useState<FiltroOpciones>({ vendedores: [], supervisores: [], estados: [] })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalProspectos, setTotalProspectos] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState("50")

  const [filtros, setFiltros] = useState({
    search: "", estado: "", vendedor_id: "", supervisor_id: "", fecha_desde: "", fecha_hasta: ""
  })

  // Modales
  const [historialModal, setHistorialModal] = useState(false)
  const [historial, setHistorial] = useState<Record<string, unknown>[]>([])
  const [cotizacionesModal, setCotizacionesModal] = useState(false)
  const [cotizaciones, setCotizaciones] = useState<Record<string, unknown>[]>([])
  const [showDetallesCotizacion, setShowDetallesCotizacion] = useState<Record<number, boolean>>({})
  const [cambioEstadoModal, setCambioEstadoModal] = useState(false)
  const [reasignarModal, setReasignarModal] = useState(false)
  const [whatsappModal, setWhatsappModal] = useState(false)
  const [mensajesWA, setMensajesWA] = useState<Record<string, unknown>[]>([])
  const [loadingWA, setLoadingWA] = useState(false)

  const [prospectoSeleccionado, setProspectoSeleccionado] = useState<Prospecto | null>(null)
  const [nuevoEstado, setNuevoEstado] = useState("")
  const [notasEstado, setNotasEstado] = useState("")
  const [nuevoVendedorId, setNuevoVendedorId] = useState("")
  const [savingEstado, setSavingEstado] = useState(false)
  const [savingReasignar, setSavingReasignar] = useState(false)
  const [tipoVista, setTipoVista] = useState<"tabla" | "tarjetas">("tabla")

  const getAuth = () => ({ Authorization: `Bearer ${getAuthToken()}` })

  const fetchProspectos = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(currentPage), limit: itemsPerPage, ...filtros
      })
      const { data } = await axios.get(`${API_URL}/backoffice/prospectos?${params}`, { headers: getAuth() })
      setProspectos(data.data ?? data ?? [])
      if (data.pagination) {
        setTotalPages(data.pagination.pages ?? 0)
        setTotalProspectos(data.pagination.total ?? 0)
      }
    } catch { toast.error("Error al cargar prospectos") }
    finally { setLoading(false) }
  }, [currentPage, itemsPerPage, filtros])

  const fetchOpciones = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/backoffice/prospectos/filtros`, { headers: getAuth() })
      if (data.success) setOpcionesFiltros(data.data)
    } catch { /* silencioso */ }
  }

  const fetchEstadisticas = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/backoffice/prospectos/estadisticas`, { headers: getAuth() })
      if (data.success) setEstadisticas(data.data)
    } catch { /* silencioso */ }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchProspectos(); fetchOpciones(); fetchEstadisticas() }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchProspectos() }, [currentPage, itemsPerPage])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setCurrentPage(1); fetchProspectos() }, [filtros])

  const abrirHistorial = async (p: Prospecto) => {
    setProspectoSeleccionado(p)
    setHistorialModal(true)
    setHistorial([])
    try {
      const { data } = await axios.get(`${API_URL}/backoffice/prospectos/${p.id}/historial`, { headers: getAuth() })
      setHistorial(data.data ?? data ?? [])
    } catch { /* silencioso */ }
  }

  const abrirCotizaciones = async (p: Prospecto) => {
    setProspectoSeleccionado(p)
    setCotizacionesModal(true)
    setCotizaciones([])
    try {
      const { data } = await axios.get(`${API_URL}/backoffice/prospectos/${p.id}/cotizaciones`, { headers: getAuth() })
      setCotizaciones(data.data ?? data ?? [])
    } catch { /* silencioso */ }
  }

  const abrirWhatsapp = async (p: Prospecto) => {
    setProspectoSeleccionado(p)
    setWhatsappModal(true)
    setLoadingWA(true)
    setMensajesWA([])
    try {
      const telefono = p.numero_contacto
      if (!telefono) { toast.error("Sin teléfono registrado"); setLoadingWA(false); return }
      const { data } = await axios.get(`${API_URL}/backoffice/prospectos/whatsapp/telefono/${encodeURIComponent(telefono)}`, { headers: getAuth() })
      const conversaciones: Record<string, unknown>[] = data?.data ?? []
      const promesas = conversaciones.map((c: Record<string, unknown>) =>
        axios.get(`${API_URL}/backoffice/prospectos/whatsapp/conversaciones/${c.id}/mensajes`, { headers: getAuth() })
      )
      const respuestas = await Promise.all(promesas)
      const todos = respuestas.flatMap(r => r.data?.data ?? [])
      setMensajesWA(todos.sort((a: Record<string, unknown>, b: Record<string, unknown>) => new Date(a.fecha_envio as string).getTime() - new Date(b.fecha_envio as string).getTime()))
    } catch { toast.error("Error al cargar conversaciones") }
    finally { setLoadingWA(false) }
  }

  const abrirCambioEstado = (p: Prospecto) => {
    setProspectoSeleccionado(p)
    setNuevoEstado(p.estado)
    setNotasEstado("")
    setCambioEstadoModal(true)
  }

  const guardarEstado = async () => {
    if (!prospectoSeleccionado) return
    setSavingEstado(true)
    try {
      await axios.put(`${API_URL}/backoffice/prospectos/${prospectoSeleccionado.id}/estado`, { estado: nuevoEstado, notas: notasEstado }, { headers: getAuth() })
      toast.success("Estado actualizado")
      setCambioEstadoModal(false)
      fetchProspectos()
    } catch { toast.error("Error al actualizar estado") }
    finally { setSavingEstado(false) }
  }

  const guardarReasignacion = async () => {
    if (!prospectoSeleccionado || !nuevoVendedorId) return
    setSavingReasignar(true)
    try {
      await axios.put(`${API_URL}/backoffice/prospectos/${prospectoSeleccionado.id}/asignar-vendedor`, { vendedor_id: parseInt(nuevoVendedorId) }, { headers: getAuth() })
      toast.success("Prospecto reasignado")
      setReasignarModal(false)
      fetchProspectos()
    } catch { toast.error("Error al reasignar") }
    finally { setSavingReasignar(false) }
  }

  const exportar = async () => {
    try {
      const params = new URLSearchParams({ formato: "csv", ...filtros })
      const r = await axios.get(`${API_URL}/backoffice/prospectos/exportar?${params}`, { headers: getAuth(), responseType: "blob" })
      const url = URL.createObjectURL(new Blob([r.data]))
      const a = document.createElement("a")
      a.href = url; a.download = `prospectos_${new Date().toISOString().slice(0, 10)}.csv`
      a.click(); URL.revokeObjectURL(url)
    } catch { toast.error("Error al exportar") }
  }

  const fmtFecha = (f?: string) => {
    if (!f) return "—"
    const d = f.includes("T") ? f : `${f}T00:00:00`
    return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  const fmtPeso = (v: unknown) => {
    const n = parseFloat(String(v ?? 0)) || 0
    return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const getPlanBadgeClass = (plan?: unknown) => {
    const lp = String(plan ?? "").toLowerCase()
    if (lp.includes("wagon")) return "bg-orange-100 text-orange-800 border border-orange-200"
    if (lp.includes("taylored")) return "bg-blue-100 text-blue-800 border border-blue-200"
    if (lp.includes("cober x")) return "bg-purple-100 text-purple-800 border border-purple-200"
    if (lp.includes("classic")) return "bg-green-100 text-green-800 border border-green-200"
    if (lp.includes("premium")) return "bg-rose-100 text-rose-800 border border-rose-200"
    if (lp.includes("básico") || lp.includes("basico")) return "bg-emerald-100 text-emerald-800 border border-emerald-200"
    return "bg-muted text-muted-foreground"
  }

  const fmtNum = (n?: number) => Number(n ?? 0).toLocaleString("es-AR")

  const STAT_DEFS = [
    { label: "Total prospectos", value: estadisticas.total_prospectos, icon: Users },
    { label: "Ingresados hoy", value: estadisticas.prospectos_hoy, icon: Calendar },
    { label: "Con cotización", value: estadisticas.con_cotizaciones, icon: FileText },
    { label: "Con póliza", value: estadisticas.con_polizas, icon: ShieldCheck },
    { label: "Ventas", value: estadisticas.ventas, icon: TrendingUp },
    { label: "WhatsApp activo", value: estadisticas.whatsapp_activo, icon: MessageCircle },
  ]

  const activeFiltersCount = [filtros.estado, filtros.vendedor_id, filtros.supervisor_id, filtros.fecha_desde, filtros.fecha_hasta].filter(Boolean).length

  return (
    <TooltipProvider>
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Prospectos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Gestión y seguimiento de todos los prospectos del sistema</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Toggle Tabla / Tarjetas */}
          <div className="flex rounded-md border overflow-hidden">
            <Button
              variant={tipoVista === "tabla" ? "default" : "ghost"}
              size="sm"
              className="h-8 rounded-none text-xs gap-1.5 px-3"
              onClick={() => setTipoVista("tabla")}
            >
              <List className="size-3.5" />Tabla
            </Button>
            <Button
              variant={tipoVista === "tarjetas" ? "default" : "ghost"}
              size="sm"
              className="h-8 rounded-none text-xs gap-1.5 px-3 border-l"
              onClick={() => setTipoVista("tarjetas")}
            >
              <LayoutGrid className="size-3.5" />Tarjetas
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download className="size-3.5 mr-1.5" aria-hidden="true" />Exportar CSV
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={fetchProspectos} aria-label="Actualizar prospectos">
            <RefreshCw className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_DEFS.map(s => (
          <StatCard
            key={s.label}
            icon={s.icon}
            label={s.label}
            value={s.value !== undefined ? fmtNum(s.value) : "—"}
          />
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-base">Filtros</CardTitle>
              {activeFiltersCount > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium h-5 min-w-[1.25rem] px-1">{activeFiltersCount}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">{fmtNum(totalProspectos)} prospectos</span>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setFiltros({ search: "", estado: "", vendedor_id: "", supervisor_id: "", fecha_desde: "", fecha_hasta: "" })}>
                  Limpiar filtros
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">

            {/* Buscar — 2 cols en lg */}
            <div className="lg:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input className="pl-9 h-9" placeholder="Nombre, email, teléfono..." value={filtros.search}
                  onChange={e => setFiltros(f => ({ ...f, search: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Estado</Label>
              <Select value={filtros.estado || "todos"} onValueChange={v => setFiltros(f => ({ ...f, estado: v === "todos" ? "" : v }))}>
                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" className="max-h-72 overflow-y-auto z-50">
                  <SelectItem value="todos">Todos</SelectItem>
                  {opcionesFiltros.estados.map(e => <SelectItem key={e.estado} value={e.estado}>{e.estado} ({e.count})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Vendedor</Label>
              <Select value={filtros.vendedor_id || "todos"} onValueChange={v => setFiltros(f => ({ ...f, vendedor_id: v === "todos" ? "" : v }))}>
                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" className="max-h-60 overflow-y-auto z-50">
                  <SelectItem value="todos">Todos ({opcionesFiltros.vendedores.length})</SelectItem>
                  {opcionesFiltros.vendedores.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.first_name} {v.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Supervisor</Label>
              <Select value={filtros.supervisor_id || "todos"} onValueChange={v => setFiltros(f => ({ ...f, supervisor_id: v === "todos" ? "" : v }))}>
                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" className="max-h-60 overflow-y-auto z-50">
                  <SelectItem value="todos">Todos ({opcionesFiltros.supervisores.length})</SelectItem>
                  {opcionesFiltros.supervisores.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.first_name} {s.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Desde</Label>
              <Input type="date" className="h-9 w-full" value={filtros.fecha_desde}
                onChange={e => setFiltros(f => ({ ...f, fecha_desde: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Hasta</Label>
              <Input type="date" className="h-9 w-full" value={filtros.fecha_hasta}
                onChange={e => setFiltros(f => ({ ...f, fecha_hasta: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Por página</Label>
              <Select value={itemsPerPage} onValueChange={setItemsPerPage}>
                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" className="z-50">
                  {["25", "50", "100"].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Tabla / Tarjetas */}
      <Card>
        <CardContent className="p-0">
          {loading ? <Skeleton className="h-64 w-full rounded-xl" /> : prospectos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="rounded-full bg-muted p-4"><Users className="size-8 text-muted-foreground" /></div>
              <div>
                <p className="font-medium text-sm">Sin resultados</p>
                <p className="text-xs text-muted-foreground mt-1">No hay prospectos para los filtros aplicados</p>
              </div>
              {activeFiltersCount > 0 && <Button variant="outline" size="sm" onClick={() => setFiltros({ search: "", estado: "", vendedor_id: "", supervisor_id: "", fecha_desde: "", fecha_hasta: "" })}>Limpiar filtros</Button>}
            </div>
          ) : tipoVista === "tabla" ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Prospecto</TableHead>
                    <TableHead className="hidden sm:table-cell">Contacto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="hidden md:table-cell">Vendedor</TableHead>
                    <TableHead className="hidden lg:table-cell">Supervisor</TableHead>
                    <TableHead className="hidden md:table-cell">Registro</TableHead>
                    <TableHead className="hidden lg:table-cell">Actividad</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prospectos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                          <div className="rounded-full bg-muted p-4">
                            <Users className="size-8 text-muted-foreground" aria-hidden="true" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Sin resultados</p>
                            <p className="text-xs text-muted-foreground mt-1">No hay prospectos para los filtros aplicados</p>
                          </div>
                          {activeFiltersCount > 0 && (
                            <Button variant="outline" size="sm" onClick={() => setFiltros({ search: "", estado: "", vendedor_id: "", supervisor_id: "", fecha_desde: "", fecha_hasta: "" })}>Limpiar filtros</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : prospectos.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">#{p.id}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{p.nombre} {p.apellido}</div>
                        {(p.edad || p.localidad) && (
                          <div className="text-xs text-muted-foreground">{p.edad ? `${p.edad} años` : ""}{p.edad && p.localidad ? " · " : ""}{p.localidad ?? ""}</div>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex gap-2">
                          {p.correo && <span title={p.correo}><Mail className="size-4 text-muted-foreground" /></span>}
                          {p.numero_contacto && <span title={p.numero_contacto}><Phone className="size-4 text-muted-foreground" /></span>}
                          {p.whatsapp_opt_in && <MessageCircle className="size-4 text-muted-foreground" />}
                        </div>
                      </TableCell>
                      <TableCell>{getBadgeEstado(p.estado)}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {p.vendedor_nombre ? <>{p.vendedor_nombre} {p.vendedor_apellido}<br /><span className="text-xs text-muted-foreground">{p.vendedor_email}</span></> : <Badge variant="warn">Sin asignar</Badge>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {p.supervisor_nombre ? `${p.supervisor_nombre} ${p.supervisor_apellido ?? ""}` : <Badge variant="secondary">N/A</Badge>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{fmtFecha(p.fecha_registro)}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex gap-1 flex-wrap">
                          {(p.cotizaciones_count ?? 0) > 0 && <Badge variant="outline" className="text-xs"><FileText className="size-3 mr-0.5" />{p.cotizaciones_count}</Badge>}
                          {(p.polizas_count ?? 0) > 0 && <Badge variant="ok" className="text-xs"><ShieldCheck className="size-3 mr-0.5" />{p.polizas_count}</Badge>}
                          {(p.acciones_count ?? 0) > 0 && <Badge variant="outline" className="text-xs"><History className="size-3 mr-0.5" />{p.acciones_count}</Badge>}
                        </div>
                        {p.ultima_accion && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[120px]">{p.ultima_accion}</p>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Tooltip><TooltipTrigger asChild>
                            <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" aria-label="Ver historial" onClick={() => abrirHistorial(p)}><History className="size-3.5" aria-hidden="true" /></Button>
                          </TooltipTrigger><TooltipContent>Historial</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild>
                            <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" aria-label="Ver cotizaciones" onClick={() => abrirCotizaciones(p)}><DollarSign className="size-3.5" aria-hidden="true" /></Button>
                          </TooltipTrigger><TooltipContent>Cotizaciones</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild>
                            <Button size="icon" className="size-8 bg-green-500 hover:bg-green-600 text-white border-0" aria-label="Ver WhatsApp" onClick={() => abrirWhatsapp(p)}><MessageCircle className="size-3.5" aria-hidden="true" /></Button>
                          </TooltipTrigger><TooltipContent>WhatsApp</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild>
                            <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" aria-label="Cambiar estado" onClick={() => abrirCambioEstado(p)}><Edit className="size-3.5" aria-hidden="true" /></Button>
                          </TooltipTrigger><TooltipContent>Cambiar estado</TooltipContent></Tooltip>
                          {opcionesFiltros.vendedores.length > 0 && (
                            <Tooltip><TooltipTrigger asChild>
                              <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" aria-label="Reasignar vendedor"
                                onClick={() => { setProspectoSeleccionado(p); setNuevoVendedorId(""); setReasignarModal(true) }}>
                                <ArrowLeftRight className="size-3.5" aria-hidden="true" />
                              </Button>
                            </TooltipTrigger><TooltipContent>Reasignar vendedor</TooltipContent></Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* ── Vista tarjetas ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
              {prospectos.map(p => (
                <Card key={p.id} className="flex flex-col shadow-sm hover:shadow-md transition-shadow">
                  <div className="p-4 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{p.nombre} {p.apellido}</p>
                      {(p.edad || p.localidad) && (
                        <p className="text-xs text-muted-foreground">{p.edad ? `${p.edad} años` : ""}{p.edad && p.localidad ? " · " : ""}{p.localidad ?? ""}</p>
                      )}
                    </div>
                    <div className="shrink-0">{getBadgeEstado(p.estado)}</div>
                  </div>

                  <div className="px-4 pb-3 space-y-2 flex-1">
                    {p.correo && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                        <Mail className="size-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{p.correo}</span>
                      </div>
                    )}
                    {p.numero_contacto && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="size-3.5 shrink-0 text-muted-foreground" /><span>{p.numero_contacto}</span>
                        {p.whatsapp_opt_in && <MessageCircle className="size-3.5 text-muted-foreground" />}
                      </div>
                    )}
                    {p.vendedor_nombre && (
                      <p className="text-xs text-muted-foreground truncate">
                        <span className="font-medium">Vendedor:</span> {p.vendedor_nombre} {p.vendedor_apellido ?? ""}
                      </p>
                    )}
                    {p.supervisor_nombre && (
                      <p className="text-xs text-primary truncate font-medium">👔 {p.supervisor_nombre} {p.supervisor_apellido ?? ""}</p>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex gap-1">
                        {(p.cotizaciones_count ?? 0) > 0 && <Badge variant="outline" className="text-xs"><FileText className="size-3 mr-0.5" />{p.cotizaciones_count}</Badge>}
                        {(p.polizas_count ?? 0) > 0 && <Badge variant="ok" className="text-xs"><ShieldCheck className="size-3 mr-0.5" />{p.polizas_count}</Badge>}
                        {(p.acciones_count ?? 0) > 0 && <Badge variant="outline" className="text-xs"><History className="size-3 mr-0.5" />{p.acciones_count}</Badge>}
                      </div>
                      <span className="text-xs text-muted-foreground">{fmtFecha(p.fecha_registro)}</span>
                    </div>
                  </div>

                  <div className="border-t px-3 py-2">
                    <div className="flex gap-1 justify-center flex-wrap">
                      <Tooltip><TooltipTrigger asChild>
                        <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => abrirHistorial(p)}><History className="size-3.5" /></Button>
                      </TooltipTrigger><TooltipContent>Historial</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => abrirCotizaciones(p)}><DollarSign className="size-3.5" /></Button>
                      </TooltipTrigger><TooltipContent>Cotizaciones</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <Button size="icon" className="size-8 bg-green-500 hover:bg-green-600 text-white border-0" onClick={() => abrirWhatsapp(p)}><MessageCircle className="size-3.5" /></Button>
                      </TooltipTrigger><TooltipContent>WhatsApp</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => abrirCambioEstado(p)}><Edit className="size-3.5" /></Button>
                      </TooltipTrigger><TooltipContent>Cambiar estado</TooltipContent></Tooltip>
                      {opcionesFiltros.vendedores.length > 0 && (
                        <Tooltip><TooltipTrigger asChild>
                          <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent"
                            onClick={() => { setProspectoSeleccionado(p); setNuevoVendedorId(""); setReasignarModal(true) }}>
                            <ArrowLeftRight className="size-3.5" />
                          </Button>
                        </TooltipTrigger><TooltipContent>Reasignar vendedor</TooltipContent></Tooltip>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
            <p className="text-xs text-muted-foreground hidden sm:block">Página {currentPage} de {totalPages} · {fmtNum(totalProspectos)} resultados</p>
            <div className="flex items-center gap-1.5 mx-auto sm:mx-0">
            <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Página anterior" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft className="size-4" aria-hidden="true" /></Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
              const page = start + i
              return page <= totalPages ? (
                <Button key={page} variant={page === currentPage ? "default" : "outline"} size="icon" className="h-7 w-7 text-xs" onClick={() => setCurrentPage(page)}>{page}</Button>
              ) : null
            })}
            <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Página siguiente" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight className="size-4" aria-hidden="true" /></Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal: Historial */}
      <Dialog open={historialModal} onOpenChange={setHistorialModal}>
        <DialogContent className="sm:max-w-3xl lg:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle><History className="inline size-4 mr-2" />Historial — #{prospectoSeleccionado?.id} {prospectoSeleccionado?.nombre} {prospectoSeleccionado?.apellido}</DialogTitle></DialogHeader>
          {historial.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sin historial registrado</p> : (
            <div className="space-y-2">
              {historial.map((ev, i) => (
                <div key={i} className="border-b pb-2">
                  <div className="flex justify-between text-sm">
                    <strong>{String(ev.accion ?? ev.tipo ?? "Acción")}</strong>
                    <span className="text-muted-foreground text-xs">{fmtFecha(String(ev.fecha ?? ""))}</span>
                  </div>
                  {!!ev.notas && <p className="text-xs text-muted-foreground mt-0.5">{String(ev.notas)}</p>}
                  {!!ev.usuario_nombre && <p className="text-xs text-muted-foreground">Por: {String(ev.usuario_nombre)}</p>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Cotizaciones */}
      <Dialog open={cotizacionesModal} onOpenChange={(open) => { setCotizacionesModal(open); if (!open) setShowDetallesCotizacion({}) }}>
        <DialogContent className="sm:max-w-3xl lg:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <DollarSign className="inline size-4 mr-2" />
              Cotizaciones — {prospectoSeleccionado?.nombre} {prospectoSeleccionado?.apellido}
            </DialogTitle>
          </DialogHeader>
          {cotizaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin cotizaciones</p>
          ) : (
            <div className="space-y-4">
              {cotizaciones.map((c, i) => {
                const descTotal = (parseFloat(String(c.total_descuento_aporte ?? 0)) || 0) +
                  (parseFloat(String(c.total_descuento_promocion ?? 0)) || 0)
                const detalles = Array.isArray(c.detalles) ? c.detalles as Record<string, unknown>[] : []
                const personasCount = detalles.length || Number(c.cantidad_personas ?? 1)
                const expanded = !!showDetallesCotizacion[i]
                return (
                  <div key={i} className="rounded-lg border shadow-sm overflow-hidden">
                    {/* Colored top bar */}
                    <div className="h-1.5 w-full" style={{ background: "linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e, #14b8a6, #3b82f6, #6366f1)" }} />
                    {/* Header */}
                    <div className="flex items-start justify-between px-4 pt-3 pb-2 bg-card">
                      <div>
                        <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${getPlanBadgeClass(c.plan_nombre)}`}>
                          {String(c.plan_nombre ?? `Plan #${i + 1}`)}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">Año: {String(c.anio ?? new Date().getFullYear())}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">${fmtPeso(c.total_final)}</p>
                        <p className="text-xs text-muted-foreground">Total Final</p>
                      </div>
                    </div>
                    {/* Body */}
                    <div className="px-4 pb-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Bruto</p>
                          <p className="font-semibold">${fmtPeso(c.total_bruto)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Descuento</p>
                          <p className="font-semibold">${fmtPeso(descTotal)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Personas</p>
                          <p className="font-semibold">{personasCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Fecha</p>
                          <p className="font-semibold text-xs">{fmtFecha(String(c.fecha ?? c.fecha_cotizacion ?? ""))}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => setShowDetallesCotizacion(prev => ({ ...prev, [i]: !prev[i] }))}
                      >
                        {expanded ? "Ocultar" : "Ver"} Detalles
                      </Button>
                      {expanded && (
                        <div className="mt-3 border-t pt-3">
                          {detalles.length > 0 ? (
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Persona</TableHead>
                                    <TableHead className="text-xs">Vínculo</TableHead>
                                    <TableHead className="text-xs">Edad</TableHead>
                                    <TableHead className="text-xs">Tipo Afiliación</TableHead>
                                    <TableHead className="text-xs">Base</TableHead>
                                    <TableHead className="text-xs">Desc. Aporte</TableHead>
                                    <TableHead className="text-xs">Desc. Promoción</TableHead>
                                    <TableHead className="text-xs">Promoción</TableHead>
                                    <TableHead className="text-xs">Final</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {detalles.map((d, di) => (
                                    <TableRow key={di}>
                                      <TableCell className="text-xs">{String(d.persona ?? "—")}</TableCell>
                                      <TableCell className="text-xs">{String(d.vinculo ?? "—")}</TableCell>
                                      <TableCell className="text-xs">{String(d.edad ?? "—")}</TableCell>
                                      <TableCell className="text-xs">
                                        {String(d.tipo_afiliacion_completo ?? d.tipo_afiliacion ?? "—")}
                                        {Boolean(d.categoria_monotributo) && (
                                          <div className="text-muted-foreground text-xs">Aporte: ${fmtPeso(d.categoria_monotributo_aporte as unknown)}</div>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-xs">${fmtPeso(d.precio_base)}</TableCell>
                                      <TableCell className="text-xs">
                                        ${fmtPeso(d.descuento_aporte)}
                                        {parseFloat(String(d.descuento_aporte ?? 0)) > 0 && (
                                          <Badge variant="secondary" className="ml-1 text-xs">Aporte</Badge>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-xs">
                                        ${fmtPeso(d.descuento_promocion)}
                                        {parseFloat(String(d.descuento_promocion ?? 0)) > 0 && (
                                          <Badge variant="outline" className="ml-1 text-xs">Prom.</Badge>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-xs">
                                        {d.promocion_aplicada
                                          ? <Badge variant="outline" className="text-xs">{String(d.promocion_aplicada)}</Badge>
                                          : <span className="text-muted-foreground">—</span>
                                        }
                                      </TableCell>
                                      <TableCell className="text-xs font-bold">${fmtPeso(d.precio_final)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-2">Sin detalles disponibles</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: WhatsApp */}
      <Dialog open={whatsappModal} onOpenChange={setWhatsappModal}>
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle><MessageCircle className="inline size-4 mr-2 text-muted-foreground" />WhatsApp — {prospectoSeleccionado?.nombre} {prospectoSeleccionado?.apellido}</DialogTitle></DialogHeader>
          {loadingWA ? <Skeleton className="h-40 w-full" /> : mensajesWA.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin mensajes registrados</p>
          ) : (
            <div className="space-y-2">
              {mensajesWA.map((m, i) => {
                const esEnviado = m.tipo === "enviado"
                return (
                  <div key={i} className={`flex ${esEnviado ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${esEnviado ? "bg-primary/10" : "bg-muted"}`}>
                      <p>{String(m.contenido ?? m.mensaje ?? "")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{fmtFecha(String(m.fecha_envio ?? ""))}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Cambio de estado */}
      <Dialog open={cambioEstadoModal} onOpenChange={setCambioEstadoModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle><Edit className="inline size-4 mr-2" />Cambiar estado — {prospectoSeleccionado?.nombre} {prospectoSeleccionado?.apellido}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm mb-1.5 block">Nuevo estado</Label>
              <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS_DISPONIBLES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Notas (opcional)</Label>
              <Textarea rows={3} placeholder="Motivo del cambio..." value={notasEstado} onChange={e => setNotasEstado(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="destructive" onClick={() => setCambioEstadoModal(false)}>Cancelar</Button>
              <Button onClick={guardarEstado} disabled={savingEstado}>{savingEstado ? "Guardando..." : "Guardar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Reasignar vendedor */}
      <Dialog open={reasignarModal} onOpenChange={setReasignarModal}>
        <DialogContent className="sm:max-w-lg" showCloseButton={false}>
          <DialogHeader><DialogTitle><ArrowLeftRight className="inline size-4 mr-2" />Reasignar vendedor — {prospectoSeleccionado?.nombre} {prospectoSeleccionado?.apellido}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm mb-1.5 block">Nuevo vendedor</Label>
              <Select value={nuevoVendedorId} onValueChange={setNuevoVendedorId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar vendedor..." /></SelectTrigger>
                <SelectContent>
                  {opcionesFiltros.vendedores.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.first_name} {v.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="destructive" onClick={() => setReasignarModal(false)}>Cancelar</Button>
              <Button onClick={guardarReasignacion} disabled={savingReasignar || !nuevoVendedorId}>{savingReasignar ? "Guardando..." : "Reasignar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  )
}
