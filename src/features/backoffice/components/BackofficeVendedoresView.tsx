import { useEffect, useMemo, useState } from "react"
import axios from "axios"
import { toast } from "sonner"
import { Search, Users, Eye, ToggleLeft, ToggleRight, RefreshCw, LayoutGrid, LayoutList, UserCog, FileText, ArrowLeftRight, ShieldCheck, UserX, Trash2, Tag, AlertCircle } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/common/StatCard"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/ui/data-table"
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
  /** 0|1 desde MySQL (`categoriaConfigModel.js`), no boolean. */
  activa?: boolean | number
}

interface Vendedor {
  id: number
  first_name?: string
  last_name?: string
  nombre?: string
  email?: string
  /** 0|1 desde MySQL — sin `typeCast` configurado, mysql2 NO lo devuelve como
   * boolean (`backOfficeModel.js` getVendedores, `SELECT ... v.is_enabled`). */
  is_enabled?: number
  supervisor_first_name?: string
  supervisor_last_name?: string
  supervisor_id?: number
  total_prospectos?: number
  /** Alias real del backend: `COUNT(CASE WHEN p.estado = 'Venta' ...) as conversiones`. */
  conversiones?: number
  categoria_nombre?: string
  phone_number?: string
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
}

interface Prospecto {
  id: number
  nombre?: string
  apellido?: string
  estado?: string
}

export function BackofficeVendedoresView() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [supervisores, setSupervisores] = useState<{ id: number; first_name: string; last_name: string; is_enabled?: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("todos")
  const [filtroSupervisor, setFiltroSupervisor] = useState("todos")
  const [vista, setVista] = useState<"tabla" | "grilla">("tabla")
  const [metricas, setMetricas] = useState<Metricas>({ totalVendedores: 0, vendedoresActivos: 0, vendedoresSinSupervisor: 0 })

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
        vendedoresActivos: lista.filter(v => v.is_enabled !== 0).length,
        vendedoresSinSupervisor: lista.filter(v => !v.supervisor_id).length,
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
      // `activa` es 0|1 crudo de MySQL — comparar con `!== false` era siempre true.
      setCategorias((data ?? []).filter((c: Categoria) => c.activa !== 0 && c.activa !== false))
    } catch { /* silencioso */ }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchVendedores(); fetchSupervisores(); fetchCategorias() }, [])

  const supervisoresActivos = supervisores.filter(s => s.is_enabled).length

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
      toast.success(`Vendedor ${v.is_enabled !== 0 ? "deshabilitado" : "habilitado"}`)
      setVendedores(prev => prev.map(ven => ven.id === v.id ? { ...ven, is_enabled: v.is_enabled ? 0 : 1 } : ven))
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
  const getSupervisorNombre = (v: Vendedor) => `${v.supervisor_first_name ?? ""} ${v.supervisor_last_name ?? ""}`.trim()

  const filtrados = vendedores.filter(v => {
    const matchBusqueda = !busqueda || getNombre(v).toLowerCase().includes(busqueda.toLowerCase()) || (v.email ?? "").toLowerCase().includes(busqueda.toLowerCase())
    const matchEstado = filtroEstado === "todos" || (filtroEstado === "activo" ? v.is_enabled !== 0 : v.is_enabled === 0)
    const matchSupervisor = filtroSupervisor === "todos" || String(v.supervisor_id ?? "") === filtroSupervisor
    return matchBusqueda && matchEstado && matchSupervisor
  })

  const columnsVendedores = useMemo<ColumnDef<Vendedor>[]>(() => [
    { id: "nombre", header: "Nombre", accessorFn: getNombre, cell: ({ row }) => <span className="font-medium text-sm">{getNombre(row.original)}</span> },
    {
      accessorKey: "email",
      header: "Email",
      meta: { className: "hidden sm:table-cell text-sm text-muted-foreground" },
      cell: ({ row }) => row.original.email ?? "—",
    },
    {
      id: "supervisor_nombre",
      header: "Supervisor",
      accessorFn: getSupervisorNombre,
      meta: { className: "hidden md:table-cell text-sm text-muted-foreground" },
      cell: ({ row }) => getSupervisorNombre(row.original) || <Badge variant="warn">Sin asignar</Badge>,
    },
    {
      accessorKey: "total_prospectos",
      header: "Prospectos",
      meta: { className: "text-right", headerClassName: "text-right" },
      cell: ({ row }) => row.original.total_prospectos ?? "—",
    },
    {
      accessorKey: "conversiones",
      header: "Ventas",
      meta: { className: "text-right font-semibold", headerClassName: "text-right" },
      cell: ({ row }) => row.original.conversiones ?? "—",
    },
    {
      accessorKey: "is_enabled",
      header: "Estado",
      cell: ({ row }) => (
        <Badge variant={row.original.is_enabled !== 0 ? "ok" : "secondary"}>
          {row.original.is_enabled !== 0 ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      id: "acciones",
      header: "Acciones",
      enableSorting: false,
      cell: ({ row }) => {
        const v = row.original
        return (
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
                className="size-8 bg-muted text-foreground border hover:bg-accent"
                aria-label={v.is_enabled !== 0 ? "Deshabilitar vendedor" : "Habilitar vendedor"}
                disabled={savingToggle === v.id}
                onClick={() => toggleEstado(v)}>
                {v.is_enabled !== 0 ? <ToggleRight className="size-3.5" aria-hidden="true" /> : <ToggleLeft className="size-3.5" aria-hidden="true" />}
              </Button>
            </TooltipTrigger><TooltipContent>{v.is_enabled !== 0 ? "Deshabilitar" : "Habilitar"}</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="destructive" className="size-8" aria-label="Eliminar vendedor"
                disabled={deletingId === v.id}
                onClick={() => eliminarVendedor(v)}>
                <Trash2 className="size-3.5" aria-hidden="true" />
              </Button>
            </TooltipTrigger><TooltipContent>Eliminar vendedor</TooltipContent></Tooltip>
          </div>
        )
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [categorias.length, savingToggle, deletingId])

  const columnsProspectosVendedor = useMemo<ColumnDef<Prospecto>[]>(() => [
    {
      id: "seleccionar",
      header: () => (
        <Checkbox
          checked={selectedProspectos.length === prospectos.length && prospectos.length > 0}
          onCheckedChange={toggleTodos}
        />
      ),
      enableSorting: false,
      meta: { className: "w-10" },
      cell: ({ row }) => (
        <Checkbox checked={selectedProspectos.includes(row.original.id)} onCheckedChange={() => toggleProspecto(row.original.id)} />
      ),
    },
    {
      id: "numero",
      header: "#",
      accessorFn: (p) => p.id,
      cell: ({ row }) => <span className="font-mono text-xs">#{row.original.id}</span>,
    },
    {
      id: "nombre",
      header: "Nombre",
      accessorFn: (p) => `${p.nombre ?? ""} ${p.apellido ?? ""}`,
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.nombre} {row.original.apellido}</span>,
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => <Badge variant="secondary" className="text-xs">{row.original.estado ?? "—"}</Badge>,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selectedProspectos, prospectos])

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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Total vendedores", value: metricas.totalVendedores, icon: Users, tone: "neutral" as const },
          { label: "Activos", value: metricas.vendedoresActivos, icon: ShieldCheck, tone: "ok" as const },
          { label: "Sin supervisor", value: metricas.vendedoresSinSupervisor, icon: UserCog, tone: "warn" as const },
          { label: "Inactivos", value: metricas.totalVendedores - metricas.vendedoresActivos, icon: UserX, tone: "risk" as const },
          { label: "Supervisores activos", value: supervisoresActivos, icon: ShieldCheck, tone: "neutral" as const },
        ].map(s => (
          <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} tone={s.tone} />
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
            <div className="p-4">
              <DataTable
                columns={columnsVendedores}
                data={filtrados}
                emptyMessage={
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                    <div className="rounded-full bg-muted p-4"><Users className="size-8 text-muted-foreground" aria-hidden="true" /></div>
                    <div>
                      <p className="font-medium text-sm">Sin vendedores</p>
                      <p className="text-xs text-muted-foreground mt-1">No hay vendedores con los filtros seleccionados</p>
                    </div>
                  </div>
                }
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="reg reg--vend border-t-2 border-rule-heavy">
          <div className="reg-row reg-head" role="presentation">
            <span>Vendedor</span>
            <span>Supervisor</span>
            <span className="text-right">Prospectos</span>
            <span className="text-right">Ventas</span>
            <span>Estado</span>
            <span />
          </div>

          {filtrados.map(v => (
            <div key={v.id} className={`reg-row reg-entry${v.is_enabled === 0 ? " opacity-60" : ""}`}>
              {/* 1 · vendedor — el eje */}
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold">{getNombre(v)}</span>
                {v.email && <span className="block truncate text-[11.5px] text-muted-foreground">{v.email}</span>}
              </span>

              {/* 2 · supervisor */}
              <span className="truncate text-[12.5px] text-muted-foreground">
                {getSupervisorNombre(v) || "—"}
              </span>

              {/* 3 · prospectos */}
              <span className="text-right text-[13px] font-semibold tabular-nums">{v.total_prospectos ?? "—"}</span>

              {/* 4 · ventas */}
              <span className="text-right text-[13px] font-semibold tabular-nums">{v.conversiones ?? "—"}</span>

              {/* 5 · estado */}
              <span className="min-w-0">
                <Badge variant={v.is_enabled !== 0 ? "ok" : "secondary"} size="sm" className="pointer-events-none">
                  {v.is_enabled !== 0 ? "Activo" : "Inactivo"}
                </Badge>
              </span>

              {/* 6 · acciones */}
              <span className="reg-actions">
                <Button size="icon" variant="ghost" className="size-7" title="Ver detalle" onClick={() => verDetalle(v)}>
                  <Eye className="size-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="size-7" title="Asignar supervisor" onClick={() => abrirAsignarSupervisor(v)}>
                  <UserCog className="size-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="size-7" title="Ver prospectos" onClick={() => abrirProspectos(v)}>
                  <FileText className="size-3.5" />
                </Button>
                {categorias.length > 0 && (
                  <Button size="icon" variant="ghost" className="size-7" title="Categoría" onClick={() => abrirCategoria(v)}>
                    <Tag className="size-3.5" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="size-7"
                  title={v.is_enabled !== 0 ? "Deshabilitar" : "Habilitar"}
                  disabled={savingToggle === v.id}
                  onClick={() => toggleEstado(v)}>
                  {v.is_enabled !== 0 ? <ToggleRight className="size-3.5" /> : <ToggleLeft className="size-3.5" />}
                </Button>
                <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive"
                  title="Eliminar vendedor"
                  disabled={deletingId === v.id}
                  onClick={() => eliminarVendedor(v)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </span>
            </div>
          ))}

          {filtrados.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">Sin vendedores</p>
          )}
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
                  <p className="text-muted-foreground">{vendedorSeleccionado.phone_number ?? "—"}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="font-bold">Estado:</p>
                  <Badge variant={vendedorSeleccionado.is_enabled !== 0 ? "ok" : "risk"} className="mt-1 text-xs uppercase">
                    {vendedorSeleccionado.is_enabled !== 0 ? "Habilitado" : "Deshabilitado"}
                  </Badge>
                </div>
                <div>
                  <p className="font-bold">Supervisor:</p>
                  <p className="text-muted-foreground">{getSupervisorNombre(vendedorSeleccionado) || "Sin asignar"}</p>
                </div>
                <div>
                  <p className="font-bold">Categoría:</p>
                  <Badge variant="secondary" className="mt-1 text-xs uppercase">
                    {vendedorSeleccionado.categoria_nombre ?? "Sin asignar"}
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
                <dl className="readout">
                  {[
                    { label: "Total prospectos", value: vendedorMetricas.total_prospectos },
                    { label: "Prospectos activos", value: vendedorMetricas.prospectos_activos },
                    { label: "Ventas confirmadas", value: vendedorMetricas.ventas_confirmadas },
                    { label: "Pólizas generadas", value: vendedorMetricas.polizas },
                  ].map(m => (
                    <div key={m.label}>
                      <dt>{m.label}</dt>
                      <dd>{m.value ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
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
                {getSupervisorNombre(vendedorSeleccionado) ? (
                  <Badge variant="secondary" className="text-xs uppercase">
                    {getSupervisorNombre(vendedorSeleccionado)}
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
                      <Button size="sm" variant="outline"
                        onClick={() => { setNuevoVendedorId(""); setReasignarModal(true) }}>
                        <ArrowLeftRight className="size-3.5 mr-1" />Reasignar ({selectedProspectos.length})
                      </Button>
                    )}
                  </div>
                  <DataTable columns={columnsProspectosVendedor} data={prospectos} hideColumnToggle />
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
                {vendedorSeleccionado.categoria_nombre ? (
                  <Badge variant="secondary" className="text-xs uppercase">
                    {vendedorSeleccionado.categoria_nombre}
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
            <div className="rounded-full border-4 border-muted p-3">
              <AlertCircle className="size-10 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-semibold text-base">
                {vendedorParaToggle?.is_enabled !== 0 ? "¿Deshabilitar vendedor?" : "¿Habilitar vendedor?"}
              </h3>
              <p className="text-sm text-muted-foreground">
                ¿Estás seguro de que deseas {vendedorParaToggle?.is_enabled !== 0 ? "deshabilitar" : "habilitar"} a <strong>{vendedorParaToggle ? getNombre(vendedorParaToggle) : ""}</strong>?
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-center pb-4">
            <Button
              variant={vendedorParaToggle?.is_enabled !== 0 ? "destructive" : "default"}
              disabled={savingToggle !== null}
              onClick={confirmarToggle}
            >
              {savingToggle !== null ? "..." : vendedorParaToggle?.is_enabled !== 0 ? "Sí, deshabilitar" : "Sí, habilitar"}
            </Button>
            <Button variant="outline" onClick={() => setConfirmToggleModal(false)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar eliminar */}
      <Dialog open={confirmEliminarModal} onOpenChange={setConfirmEliminarModal}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <div className="flex flex-col items-center gap-4 pt-4 pb-2">
            <div className="rounded-full border-4 border-state-risk/30 p-3">
              <AlertCircle className="size-10 text-state-risk-text" />
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
              variant="destructive"
              disabled={deletingId !== null}
              onClick={confirmarEliminar}
            >
              {deletingId !== null ? "Eliminando..." : "Sí, eliminar"}
            </Button>
            <Button variant="outline" onClick={() => setConfirmEliminarModal(false)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  )
}
