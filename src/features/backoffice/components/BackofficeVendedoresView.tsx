import { useEffect, useState } from "react"
import axios from "axios"
import { toast } from "sonner"
import { Search, Users, Eye, ToggleLeft, ToggleRight, RefreshCw, LayoutGrid, LayoutList, UserCog, FileText, ArrowLeftRight, ShieldCheck, UserX, Trash2, Tag, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Checkbox } from "@/components/ui/checkbox"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Categoria {
  id: number
  nombre: string
  activa?: boolean
}

interface Vendedor {
  id: number
  first_name?: string
  last_name?: string
  nombre?: string
  email?: string
  is_enabled?: boolean
  supervisor_nombre?: string
  supervisor_id?: number
  total_prospectos?: number
  ventas?: number
  categoria?: string
  phone?: string
}

interface VendedorMetricas {
  total_prospectos?: number
  prospectos_activos?: number
  ventas_confirmadas?: number
  polizas?: number
  conversion_rate?: number
  ingresos?: number
}

interface Metricas {
  totalVendedores: number
  vendedoresActivos: number
  vendedoresSinSupervisor: number
  supervisoresActivos: number
}

interface Prospecto {
  id: number
  nombre?: string
  apellido?: string
  estado?: string
}

export function BackofficeVendedoresView() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [supervisores, setSupervisores] = useState<{ id: number; first_name: string; last_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("todos")
  const [filtroSupervisor, setFiltroSupervisor] = useState("todos")
  const [vista, setVista] = useState<"tabla" | "grilla">("tabla")
  const [metricas, setMetricas] = useState<Metricas>({ totalVendedores: 0, vendedoresActivos: 0, vendedoresSinSupervisor: 0, supervisoresActivos: 0 })

  // Detalle
  const [detalleModal, setDetalleModal] = useState(false)
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState<Vendedor | null>(null)
  const [vendedorMetricas, setVendedorMetricas] = useState<VendedorMetricas | null>(null)
  const [loadingMetricas, setLoadingMetricas] = useState(false)
  const [savingToggle, setSavingToggle] = useState<number | null>(null)

  // Asignar supervisor
  const [supervisorModal, setSupervisorModal] = useState(false)
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("")
  const [savingSupervisor, setSavingSupervisor] = useState(false)

  // Prospectos del vendedor / reasignación
  const [prospectosModal, setProspectosModal] = useState(false)
  const [prospectos, setProspectos] = useState<Prospecto[]>([])
  const [loadingProspectos, setLoadingProspectos] = useState(false)
  const [selectedProspectos, setSelectedProspectos] = useState<number[]>([])
  const [reasignarModal, setReasignarModal] = useState(false)
  const [nuevoVendedorId, setNuevoVendedorId] = useState("")
  const [savingReasignar, setSavingReasignar] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [confirmToggleModal, setConfirmToggleModal] = useState(false)
  const [vendedorParaToggle, setVendedorParaToggle] = useState<Vendedor | null>(null)
  const [confirmEliminarModal, setConfirmEliminarModal] = useState(false)
  const [vendedorParaEliminar, setVendedorParaEliminar] = useState<Vendedor | null>(null)

  // Categoría
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaModal, setCategoriaModal] = useState(false)
  const [selectedCategoriaId, setSelectedCategoriaId] = useState("")
  const [savingCategoria, setSavingCategoria] = useState(false)

  const getAuth = () => ({ Authorization: `Bearer ${getAuthToken()}` })

  const fetchVendedores = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API_URL}/backoffice/vendedores`, { headers: getAuth() })
      const lista: Vendedor[] = data.data ?? data ?? []
      setVendedores(lista)
      setMetricas({
        totalVendedores: lista.length,
        vendedoresActivos: lista.filter(v => v.is_enabled !== false).length,
        vendedoresSinSupervisor: lista.filter(v => !v.supervisor_id).length,
        supervisoresActivos: 0
      })
    } catch { toast.error("Error al cargar vendedores") }
    finally { setLoading(false) }
  }

  const fetchSupervisores = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/backoffice/supervisores`, { headers: getAuth() })
      setSupervisores(data.data ?? data ?? [])
    } catch { /* silencioso */ }
  }

  const fetchCategorias = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/admin/categorias`, { headers: getAuth() })
      setCategorias((data ?? []).filter((c: Categoria) => c.activa !== false))
    } catch { /* silencioso */ }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchVendedores(); fetchSupervisores(); fetchCategorias() }, [])

  const verDetalle = async (v: Vendedor) => {
    setVendedorSeleccionado(v)
    setDetalleModal(true)
    setLoadingMetricas(true)
    setVendedorMetricas(null)
    try {
      const { data } = await axios.get(`${API_URL}/backoffice/vendedores/${v.id}/metricas`, { headers: getAuth() })
      setVendedorMetricas(data.data ?? data ?? null)
    } catch { /* silencioso */ }
    finally { setLoadingMetricas(false) }
  }

  const toggleEstado = (v: Vendedor) => {
    setVendedorParaToggle(v)
    setConfirmToggleModal(true)
  }

  const confirmarToggle = async () => {
    if (!vendedorParaToggle) return
    const v = vendedorParaToggle
    setSavingToggle(v.id)
    try {
      await axios.patch(`${API_URL}/backoffice/vendedores/${v.id}/toggle-status`, {}, { headers: getAuth() })
      toast.success(`Vendedor ${v.is_enabled !== false ? "deshabilitado" : "habilitado"}`)
      setVendedores(prev => prev.map(ven => ven.id === v.id ? { ...ven, is_enabled: !v.is_enabled } : ven))
      setConfirmToggleModal(false)
    } catch { toast.error("Error al cambiar estado") }
    finally { setSavingToggle(null) }
  }

  const abrirAsignarSupervisor = (v: Vendedor) => {
    setVendedorSeleccionado(v)
    setSelectedSupervisorId(v.supervisor_id ? String(v.supervisor_id) : "")
    setSupervisorModal(true)
  }

  const guardarSupervisor = async () => {
    if (!vendedorSeleccionado) return
    setSavingSupervisor(true)
    const esQuitar = !selectedSupervisorId || selectedSupervisorId === "__quitar__"
    try {
      await axios.post(`${API_URL}/backoffice/vendedores/asignar`, {
        vendedorId: vendedorSeleccionado.id,
        supervisorId: esQuitar ? null : parseInt(selectedSupervisorId)
      }, { headers: getAuth() })
      toast.success(esQuitar ? "Supervisor quitado correctamente" : "Supervisor asignado correctamente")
      setSupervisorModal(false)
      fetchVendedores()
    } catch { toast.error("Error al asignar supervisor") }
    finally { setSavingSupervisor(false) }
  }

  const abrirProspectos = async (v: Vendedor) => {
    setVendedorSeleccionado(v)
    setProspectosModal(true)
    setLoadingProspectos(true)
    setProspectos([])
    setSelectedProspectos([])
    try {
      const { data } = await axios.get(`${API_URL}/backoffice/vendedores/${v.id}/prospectos`, { headers: getAuth() })
      setProspectos(data.data ?? data ?? [])
    } catch { toast.error("Error al cargar prospectos del vendedor") }
    finally { setLoadingProspectos(false) }
  }

  const toggleProspecto = (id: number) => {
    setSelectedProspectos(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const toggleTodos = () => {
    setSelectedProspectos(prev =>
      prev.length === prospectos.length ? [] : prospectos.map(p => p.id)
    )
  }

  const guardarReasignacion = async () => {
    if (!vendedorSeleccionado || !nuevoVendedorId || selectedProspectos.length === 0) return
    setSavingReasignar(true)
    try {
      await axios.post(`${API_URL}/backoffice/reasignar-prospectos`, {
        prospectos: selectedProspectos,
        nuevo_vendedor_id: parseInt(nuevoVendedorId),
        vendedor_anterior_id: vendedorSeleccionado.id
      }, { headers: getAuth() })
      toast.success(`${selectedProspectos.length} prospectos reasignados`)
      setReasignarModal(false)
      setNuevoVendedorId("")
      setSelectedProspectos([])
      await abrirProspectos(vendedorSeleccionado)
    } catch { toast.error("Error al reasignar prospectos") }
    finally { setSavingReasignar(false) }
  }

  const eliminarVendedor = async (v: Vendedor) => {
    // Verificar si tiene prospectos primero
    setDeletingId(v.id)
    try {
      const { data } = await axios.get(`${API_URL}/backoffice/vendedores/${v.id}/prospectos`, { headers: getAuth() })
      const listaProspectos: Prospecto[] = data.data ?? data ?? []
      if (listaProspectos.length > 0) {
        toast.error(`${getNombre(v)} tiene ${listaProspectos.length} prospectos asignados. Reasígnalos primero.`)
        setProspectos(listaProspectos)
        setVendedorSeleccionado(v)
        setSelectedProspectos([])
        setProspectosModal(true)
      } else {
        setVendedorParaEliminar(v)
        setConfirmEliminarModal(true)
      }
    } catch { toast.error("Error al eliminar vendedor") }
    finally { setDeletingId(null) }
  }

  const confirmarEliminar = async () => {
    if (!vendedorParaEliminar) return
    const v = vendedorParaEliminar
    setDeletingId(v.id)
    try {
      await axios.delete(`${API_URL}/backoffice/vendedores/${v.id}`, { headers: getAuth() })
      toast.success("Vendedor eliminado")
      setVendedores(prev => prev.filter(ven => ven.id !== v.id))
      setConfirmEliminarModal(false)
    } catch { toast.error("Error al eliminar vendedor") }
    finally { setDeletingId(null) }
  }

  const abrirCategoria = (v: Vendedor) => {
    setVendedorSeleccionado(v)
    setSelectedCategoriaId("")
    setCategoriaModal(true)
  }

  const guardarCategoria = async () => {
    if (!vendedorSeleccionado) return
    setSavingCategoria(true)
    try {
      const catId = selectedCategoriaId === "none" ? null : selectedCategoriaId || null
      await axios.put(`${API_URL}/admin/categorias/vendedor/${vendedorSeleccionado.id}/categoria`,
        { categoriaId: catId }, { headers: getAuth() })
      toast.success("Categoría asignada correctamente")
      setCategoriaModal(false)
      fetchVendedores()
    } catch { toast.error("Error al asignar categoría") }
    finally { setSavingCategoria(false) }
  }

  const getNombre = (v: Vendedor) => v.nombre ?? `${v.first_name ?? ""} ${v.last_name ?? ""}`.trim()

  const filtrados = vendedores.filter(v => {
    const matchBusqueda = !busqueda || getNombre(v).toLowerCase().includes(busqueda.toLowerCase()) || (v.email ?? "").toLowerCase().includes(busqueda.toLowerCase())
    const matchEstado = filtroEstado === "todos" || (filtroEstado === "activo" ? v.is_enabled !== false : v.is_enabled === false)
    const matchSupervisor = filtroSupervisor === "todos" || String(v.supervisor_id ?? "") === filtroSupervisor
    return matchBusqueda && matchEstado && matchSupervisor
  })

  return (
    <TooltipProvider>
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Vendedores</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Gestión del equipo de ventas, supervisores y prospectos asignados</p>
        </div>
        <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Actualizar vendedores" onClick={fetchVendedores}>
          <RefreshCw className="size-3.5" aria-hidden="true" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total vendedores", value: metricas.totalVendedores, icon: <Users className="size-5" />, iconBg: "bg-blue-50", iconColor: "text-blue-600" },
          { label: "Activos", value: metricas.vendedoresActivos, icon: <ShieldCheck className="size-5" />, iconBg: "bg-green-50", iconColor: "text-green-600" },
          { label: "Sin supervisor", value: metricas.vendedoresSinSupervisor, icon: <UserCog className="size-5" />, iconBg: "bg-amber-50", iconColor: "text-amber-600" },
          { label: "Inactivos", value: metricas.totalVendedores - metricas.vendedoresActivos, icon: <UserX className="size-5" />, iconBg: "bg-red-50", iconColor: "text-red-600" },
        ].map(s => (
          <Card key={s.label} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center gap-3 p-4">
                <div className={`rounded-xl p-2.5 ${s.iconBg} shrink-0`}>
                  <span className={s.iconColor} aria-hidden="true">{s.icon}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold tabular-nums leading-none">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Controles */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
          <Input className="pl-9 h-9" placeholder="Buscar por nombre o email…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="activo">Activos</SelectItem>
            <SelectItem value="inactivo">Inactivos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroSupervisor} onValueChange={setFiltroSupervisor}>
          <SelectTrigger className="h-9 w-[175px]"><SelectValue placeholder="Supervisor…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los supervisores</SelectItem>
            {supervisores.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.first_name} {s.last_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-1 ml-auto">
          <Button size="icon" variant={vista === "tabla" ? "default" : "outline"} className="h-9 w-9" aria-label="Vista tabla" onClick={() => setVista("tabla")}><LayoutList className="size-3.5" aria-hidden="true" /></Button>
          <Button size="icon" variant={vista === "grilla" ? "default" : "outline"} className="h-9 w-9" aria-label="Vista grilla" onClick={() => setVista("grilla")}><LayoutGrid className="size-3.5" aria-hidden="true" /></Button>
        </div>
      </div>
      {filtrados.length !== vendedores.length && (
        <p className="text-xs text-muted-foreground -mt-2">{filtrados.length} de {vendedores.length} vendedores</p>
      )}

      {loading ? <Skeleton className="h-64 w-full" /> : vista === "tabla" ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead className="hidden md:table-cell">Supervisor</TableHead>
                    <TableHead className="text-right">Prospectos</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                          <div className="rounded-full bg-muted p-4"><Users className="size-8 text-muted-foreground" aria-hidden="true" /></div>
                          <div>
                            <p className="font-medium text-sm">Sin vendedores</p>
                            <p className="text-xs text-muted-foreground mt-1">No hay vendedores con los filtros seleccionados</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filtrados.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium text-sm">{getNombre(v)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{v.email ?? "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{v.supervisor_nombre ?? <Badge variant="outline" className="text-orange-500 border-orange-400">Sin asignar</Badge>}</TableCell>
                      <TableCell className="text-right text-sm">{v.total_prospectos ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm font-semibold text-green-600">{v.ventas ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={v.is_enabled !== false ? "outline" : "secondary"} className={v.is_enabled !== false ? "border-green-500 text-green-600" : ""}>
                          {v.is_enabled !== false ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Tooltip><TooltipTrigger asChild>
                            <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" aria-label="Ver detalle" onClick={() => verDetalle(v)}><Eye className="size-3.5" aria-hidden="true" /></Button>
                          </TooltipTrigger><TooltipContent>Ver detalle</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild>
                            <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" aria-label="Asignar supervisor" onClick={() => abrirAsignarSupervisor(v)}><UserCog className="size-3.5" aria-hidden="true" /></Button>
                          </TooltipTrigger><TooltipContent>Asignar supervisor</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild>
                            <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" aria-label="Ver prospectos" onClick={() => abrirProspectos(v)}><FileText className="size-3.5" aria-hidden="true" /></Button>
                          </TooltipTrigger><TooltipContent>Ver prospectos</TooltipContent></Tooltip>
                          {categorias.length > 0 && (
                            <Tooltip><TooltipTrigger asChild>
                              <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" aria-label="Cambiar categoría" onClick={() => abrirCategoria(v)}><Tag className="size-3.5" aria-hidden="true" /></Button>
                            </TooltipTrigger><TooltipContent>Cambiar categoría</TooltipContent></Tooltip>
                          )}
                          <Tooltip><TooltipTrigger asChild>
                            <Button size="icon"
                              className={`size-8 ${v.is_enabled !== false ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-500 hover:bg-emerald-600"} text-white border-0`}
                              aria-label={v.is_enabled !== false ? "Deshabilitar vendedor" : "Habilitar vendedor"}
                              disabled={savingToggle === v.id}
                              onClick={() => toggleEstado(v)}>
                              {v.is_enabled !== false ? <ToggleRight className="size-3.5" aria-hidden="true" /> : <ToggleLeft className="size-3.5" aria-hidden="true" />}
                            </Button>
                          </TooltipTrigger><TooltipContent>{v.is_enabled !== false ? "Deshabilitar" : "Habilitar"}</TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild>
                            <Button size="icon" className="size-8 bg-red-500 hover:bg-red-600 text-white border-0" aria-label="Eliminar vendedor"
                              disabled={deletingId === v.id}
                              onClick={() => eliminarVendedor(v)}>
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </Button>
                          </TooltipTrigger><TooltipContent>Eliminar vendedor</TooltipContent></Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Vista grilla */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtrados.map(v => (
            <Card key={v.id} className={v.is_enabled === false ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-sm">{getNombre(v)}</CardTitle>
                  <Badge variant={v.is_enabled !== false ? "outline" : "secondary"} className={`text-xs ${v.is_enabled !== false ? "border-green-500 text-green-600" : ""}`}>
                    {v.is_enabled !== false ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
                {v.email && <p className="text-xs text-muted-foreground">{v.email}</p>}
                {v.supervisor_nombre && <p className="text-xs text-muted-foreground">Sup: {v.supervisor_nombre}</p>}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex gap-4 mb-3">
                  <div><p className="text-xs text-muted-foreground">Prospectos</p><p className="font-bold text-sm">{v.total_prospectos ?? "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Ventas</p><p className="font-bold text-sm text-green-600">{v.ventas ?? "—"}</p></div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => verDetalle(v)}><Eye className="size-3 mr-1" />Detalle</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-blue-500 text-blue-600" onClick={() => abrirAsignarSupervisor(v)}><UserCog className="size-3 mr-1" />Supervisor</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-indigo-500 text-indigo-600" onClick={() => abrirProspectos(v)}><FileText className="size-3 mr-1" />Prospectos</Button>
                  {categorias.length > 0 && (
                    <Button size="sm" variant="outline" className="h-7 text-xs border-amber-500 text-amber-600" onClick={() => abrirCategoria(v)}><Tag className="size-3 mr-1" />Categoría</Button>
                  )}
                  <Button size="sm" variant="outline" className={`h-7 text-xs ${v.is_enabled !== false ? "border-red-400 text-red-500" : "border-green-500 text-green-600"}`}
                    disabled={savingToggle === v.id}
                    onClick={() => toggleEstado(v)}>
                    {v.is_enabled !== false ? <ToggleRight className="size-3" /> : <ToggleLeft className="size-3" />}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-red-500 text-red-600"
                    disabled={deletingId === v.id}
                    onClick={() => eliminarVendedor(v)}>
                    <Trash2 className="size-3 mr-1" />Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtrados.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-12">Sin vendedores</p>}
        </div>
      )}

      {/* Modal: Detalle vendedor */}
      <Dialog open={detalleModal} onOpenChange={setDetalleModal}>
        <DialogContent className="sm:max-w-2xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Users className="size-5" />
              Detalle del Vendedor
            </DialogTitle>
          </DialogHeader>
          <Separator />
          {vendedorSeleccionado && (
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 py-2 text-sm">
              <div className="space-y-4">
                <div>
                  <p className="font-bold">ID:</p>
                  <p className="text-muted-foreground">{vendedorSeleccionado.id}</p>
                </div>
                <div>
                  <p className="font-bold">Nombre completo:</p>
                  <p className="text-muted-foreground">{getNombre(vendedorSeleccionado)}</p>
                </div>
                <div>
                  <p className="font-bold">Email:</p>
                  <p className="text-muted-foreground">{vendedorSeleccionado.email ?? "—"}</p>
                </div>
                <div>
                  <p className="font-bold">Teléfono:</p>
                  <p className="text-muted-foreground">{vendedorSeleccionado.phone ?? "—"}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="font-bold">Estado:</p>
                  <Badge className={`mt-1 text-xs uppercase ${vendedorSeleccionado.is_enabled !== false ? "bg-teal-600 hover:bg-teal-600" : "bg-red-500 hover:bg-red-500"} text-white`}>
                    {vendedorSeleccionado.is_enabled !== false ? "Habilitado" : "Deshabilitado"}
                  </Badge>
                </div>
                <div>
                  <p className="font-bold">Supervisor:</p>
                  <p className="text-muted-foreground">{vendedorSeleccionado.supervisor_nombre ?? "Sin asignar"}</p>
                </div>
                <div>
                  <p className="font-bold">Categoría:</p>
                  <Badge variant="secondary" className="mt-1 text-xs uppercase">
                    {vendedorSeleccionado.categoria ?? "Sin asignar"}
                  </Badge>
                </div>
                <div>
                  <p className="font-bold">Prospectos asignados:</p>
                  <p className="text-muted-foreground">{vendedorSeleccionado.total_prospectos ?? 0}</p>
                </div>
              </div>
            </div>
          )}
          {loadingMetricas && <Skeleton className="h-20 w-full" />}
          {vendedorMetricas && !loadingMetricas && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Métricas</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "Total prospectos", value: vendedorMetricas.total_prospectos },
                    { label: "Prospectos activos", value: vendedorMetricas.prospectos_activos },
                    { label: "Ventas confirmadas", value: vendedorMetricas.ventas_confirmadas },
                    { label: "Pólizas generadas", value: vendedorMetricas.polizas },
                  ].map(m => (
                    <Card key={m.label}><CardContent className="p-3 text-center">
                      <p className="text-xl font-bold">{m.value ?? "—"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
                    </CardContent></Card>
                  ))}
                </div>
              </div>
            </>
          )}
          <Separator />
          <div className="flex justify-end gap-2">
            <Button variant="destructive" onClick={() => setDetalleModal(false)}>Cerrar</Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => { setDetalleModal(false); if (vendedorSeleccionado) abrirProspectos(vendedorSeleccionado) }}
            >
              <Users className="size-4 mr-1.5" />Ver Prospectos
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Asignar supervisor */}
      <Dialog open={supervisorModal} onOpenChange={setSupervisorModal}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <UserCog className="size-5" />
              Asignar Supervisor
            </DialogTitle>
          </DialogHeader>
          <Separator />
          {vendedorSeleccionado && (
            <div className="space-y-4 py-1 text-sm">
              <div>
                <span className="font-bold">Vendedor:</span>{" "}
                <span>{getNombre(vendedorSeleccionado)}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold">Supervisor actual:</span>
                {vendedorSeleccionado.supervisor_nombre ? (
                  <Badge variant="secondary" className="text-xs uppercase">
                    {vendedorSeleccionado.supervisor_nombre}
                  </Badge>
                ) : (
                  <Badge className="bg-state-warn-soft text-state-warn-text border border-state-warn/25 text-xs uppercase">Sin supervisor</Badge>
                )}
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Nuevo supervisor</Label>
                <Select value={selectedSupervisorId} onValueChange={setSelectedSupervisorId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="-- Quitar Supervisor (Sin asignar) --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__quitar__">-- Quitar Supervisor (Sin asignar) --</SelectItem>
                    {supervisores.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.first_name} {s.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <Separator />
          <div className="flex justify-center gap-3">
            <Button variant="destructive" onClick={() => setSupervisorModal(false)}>Cancelar</Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white gap-1.5"
              onClick={guardarSupervisor}
              disabled={savingSupervisor}
            >
              <UserCog className="size-4" />
              {savingSupervisor ? "Guardando..." : (!selectedSupervisorId || selectedSupervisorId === "__quitar__") ? "Quitar Supervisor" : "Asignar Supervisor"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Prospectos del vendedor */}
      <Dialog open={prospectosModal} onOpenChange={setProspectosModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle><FileText className="inline size-4 mr-2" />Prospectos de {vendedorSeleccionado ? getNombre(vendedorSeleccionado) : ""}</DialogTitle>
          </DialogHeader>
          {loadingProspectos ? <Skeleton className="h-48 w-full" /> : (
            <div className="space-y-3">
              {prospectos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                  <Users className="size-12 text-muted-foreground opacity-30" />
                  <p className="font-semibold text-sm">Sin prospectos</p>
                  <p className="text-xs text-muted-foreground">Este vendedor no tiene prospectos asignados.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="todos"
                        checked={selectedProspectos.length === prospectos.length && prospectos.length > 0}
                        onCheckedChange={toggleTodos}
                      />
                      <Label htmlFor="todos" className="text-sm cursor-pointer">Seleccionar todos ({prospectos.length})</Label>
                    </div>
                    {selectedProspectos.length > 0 && (
                      <Button size="sm" variant="outline" className="border-orange-400 text-orange-600"
                        onClick={() => { setNuevoVendedorId(""); setReasignarModal(true) }}>
                        <ArrowLeftRight className="size-3.5 mr-1" />Reasignar ({selectedProspectos.length})
                      </Button>
                    )}
                  </div>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>#</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {prospectos.map(p => (
                          <TableRow key={p.id} className="cursor-pointer" onClick={() => toggleProspecto(p.id)}>
                            <TableCell><Checkbox checked={selectedProspectos.includes(p.id)} onCheckedChange={() => toggleProspecto(p.id)} /></TableCell>
                            <TableCell className="font-mono text-xs">#{p.id}</TableCell>
                            <TableCell className="text-sm font-medium">{p.nombre} {p.apellido}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-xs">{p.estado ?? "—"}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Reasignar prospectos */}
      <Dialog open={reasignarModal} onOpenChange={setReasignarModal}>
        <DialogContent className="max-w-md" showCloseButton={false}>
          <DialogHeader><DialogTitle><ArrowLeftRight className="inline size-4 mr-2" />Reasignar {selectedProspectos.length} prospectos</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Selecciona el vendedor al que quieres reasignar los {selectedProspectos.length} prospectos seleccionados.
            </p>
            <div>
              <Label className="text-sm mb-1.5 block">Nuevo vendedor</Label>
              <Select value={nuevoVendedorId} onValueChange={setNuevoVendedorId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar vendedor..." /></SelectTrigger>
                <SelectContent>
                  {vendedores
                    .filter(v => v.id !== vendedorSeleccionado?.id)
                    .map(v => (
                      <SelectItem key={v.id} value={String(v.id)}>{getNombre(v)}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="destructive" onClick={() => setReasignarModal(false)}>Cancelar</Button>
              <Button onClick={guardarReasignacion} disabled={savingReasignar || !nuevoVendedorId}>
                {savingReasignar ? "Reasignando..." : "Confirmar reasignación"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Cambiar categoría */}
      <Dialog open={categoriaModal} onOpenChange={setCategoriaModal}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Tag className="size-5" />
              Cambiar Categoría de Vendedor
            </DialogTitle>
          </DialogHeader>
          <Separator />
          {vendedorSeleccionado && (
            <div className="space-y-4 py-1 text-sm">
              <div>
                <span className="font-bold">Vendedor:</span>{" "}
                <span>{getNombre(vendedorSeleccionado)}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold">Categoría actual:</span>
                {vendedorSeleccionado.categoria ? (
                  <Badge variant="secondary" className="text-xs uppercase">
                    {vendedorSeleccionado.categoria}
                  </Badge>
                ) : (
                  <Badge className="bg-state-warn-soft text-state-warn-text border border-state-warn/25 text-xs uppercase">Sin asignar</Badge>
                )}
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 block">Nueva categoría</Label>
                <Select value={selectedCategoriaId} onValueChange={setSelectedCategoriaId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin categoría asignada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoría asignada</SelectItem>
                    {categorias.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <Separator />
          <div className="flex justify-center gap-3">
            <Button variant="destructive" onClick={() => setCategoriaModal(false)}>Cancelar</Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white gap-1.5"
              onClick={guardarCategoria}
              disabled={savingCategoria}
            >
              <Tag className="size-4" />
              {savingCategoria ? "Guardando..." : "Cambiar Categoría"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Modal: Confirmar toggle estado */}
      <Dialog open={confirmToggleModal} onOpenChange={setConfirmToggleModal}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <div className="flex flex-col items-center gap-4 pt-4 pb-2">
            <div className={`rounded-full border-4 p-3 ${vendedorParaToggle?.is_enabled !== false ? "border-gray-300" : "border-teal-300"}`}>
              <AlertCircle className={`size-10 ${vendedorParaToggle?.is_enabled !== false ? "text-gray-400" : "text-teal-500"}`} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-semibold text-base">
                {vendedorParaToggle?.is_enabled !== false ? "¿Deshabilitar vendedor?" : "¿Habilitar vendedor?"}
              </h3>
              <p className="text-sm text-muted-foreground">
                ¿Estás seguro de que deseas {vendedorParaToggle?.is_enabled !== false ? "deshabilitar" : "habilitar"} a <strong>{vendedorParaToggle ? getNombre(vendedorParaToggle) : ""}</strong>?
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-center pb-4">
            <Button
              className={vendedorParaToggle?.is_enabled !== false ? "bg-gray-600 hover:bg-gray-700 text-white" : "bg-muted text-foreground border hover:bg-accent"}
              disabled={savingToggle !== null}
              onClick={confirmarToggle}
            >
              {savingToggle !== null ? "..." : vendedorParaToggle?.is_enabled !== false ? "Sí, deshabilitar" : "Sí, habilitar"}
            </Button>
            <Button variant="destructive" onClick={() => setConfirmToggleModal(false)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar eliminar */}
      <Dialog open={confirmEliminarModal} onOpenChange={setConfirmEliminarModal}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <div className="flex flex-col items-center gap-4 pt-4 pb-2">
            <div className="rounded-full border-4 border-orange-300 p-3">
              <AlertCircle className="size-10 text-orange-400" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-semibold text-base">¿Eliminar vendedor?</h3>
              <p className="text-sm text-muted-foreground">
                Esta acción eliminará permanentemente a <strong>{vendedorParaEliminar ? getNombre(vendedorParaEliminar) : ""}</strong>.
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-center pb-4">
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              disabled={deletingId !== null}
              onClick={confirmarEliminar}
            >
              {deletingId !== null ? "Eliminando..." : "Sí, eliminar"}
            </Button>
            <Button variant="destructive" onClick={() => setConfirmEliminarModal(false)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  )
}
