import { useState, useEffect, useCallback } from "react"
import { useConfirm } from "@/components/common/confirm-dialog"
import axios from "axios"
import { toast } from "sonner"
import {
  Users, UserCheck, UserX, RefreshCw, Search, Eye,
  ArrowLeftRight, UserCog, AlertCircle, Tag, Trash2
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Vendedor {
  id: number
  first_name: string
  last_name: string
  email: string
  activo?: boolean
  supervisor_nombre?: string
  supervisor_id?: number
  categoria?: string
  categoria_id?: number
  total_prospectos?: number
  prospectos_activos?: number
}

interface Supervisor {
  id: number
  first_name: string
  last_name: string
  email: string
}

interface Metricas {
  totalVendedores: number
  vendedoresActivos: number
  vendedoresSinSupervisor: number
  supervisioresActivos: number
}

interface Categoria {
  id: number
  nombre: string
  activa: boolean
  prioridad?: number
}

interface Categoria {
  id: number
  nombre: string
  activa: boolean
  prioridad?: number
}

interface Categoria {
  id: number
  nombre: string
  activa: boolean
  prioridad?: number
}

interface ProspectoVendedor {
  id: number
  nombre?: string
  apellido?: string
  numero_contacto?: string
  correo?: string
  estado?: string
  fecha_asignacion?: string
}

const getHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` })

export default function VendedoresAdmin() {
  const confirm = useConfirm()
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [supervisores, setSupervisores] = useState<Supervisor[]>([])
  const [metricas, setMetricas] = useState<Metricas>({ totalVendedores: 0, vendedoresActivos: 0, vendedoresSinSupervisor: 0, supervisioresActivos: 0 })
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("todos")

  // Modal detalle métricas
  const [detalleModal, setDetalleModal] = useState<{ open: boolean; vendedor: Vendedor | null }>({ open: false, vendedor: null })
  const [vendedorMetricas, setVendedorMetricas] = useState<Record<string, unknown> | null>(null)
  const [loadingMetricas, setLoadingMetricas] = useState(false)

  // Modal asignar supervisor
  const [supervisorModal, setSupervisorModal] = useState<{ open: boolean; vendedor: Vendedor | null }>({ open: false, vendedor: null })
  const [nuevoSupervisorId, setNuevoSupervisorId] = useState("")

  // -- Reasignación: paso 1 → ver prospectos con selección ------------------
  const [prospectosModal, setProspectosModal] = useState<{ open: boolean; vendedor: Vendedor | null }>({ open: false, vendedor: null })
  const [prospectos, setProspectos] = useState<ProspectoVendedor[]>([])
  const [loadingProspectos, setLoadingProspectos] = useState(false)
  const [seleccionados, setSeleccionados] = useState<number[]>([])

  // -- Reasignación: paso 2 → elegir vendedor destino ------------------------
  const [reasignarModal, setReasignarModal] = useState(false)
  const [nuevoVendedorId, setNuevoVendedorId] = useState("")
  const [reasignando, setReasignando] = useState(false)

  // Categorías
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaModal, setCategoriaModal] = useState<{ open: boolean; vendedor: Vendedor | null }>({ open: false, vendedor: null })
  const [nuevaCategoriaId, setNuevaCategoriaId] = useState("")

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [vRes, sRes, mRes, cRes] = await Promise.all([
        axios.get(`${API_URL}/admin/vendedores`, { headers: getHeaders() }),
        axios.get(`${API_URL}/admin/supervisores`, { headers: getHeaders() }),
        axios.get(`${API_URL}/admin/vendedores/metricas`, { headers: getHeaders() }),
        axios.get(`${API_URL}/admin/categorias`, { headers: getHeaders() }),
      ])
      setVendedores(vRes.data?.data ?? vRes.data ?? [])
      setSupervisores(sRes.data?.data ?? sRes.data ?? [])
      const stats = mRes.data?.data
      if (stats) setMetricas({
        totalVendedores: stats.totalVendedores ?? 0,
        vendedoresActivos: stats.vendedoresActivos ?? 0,
        vendedoresSinSupervisor: stats.vendedoresSinSupervisor ?? 0,
        supervisioresActivos: stats.supervisioresActivos ?? 0
      })
      const cats = cRes.data?.data ?? cRes.data ?? []
      setCategorias(Array.isArray(cats) ? cats.filter((c) => c.activa) : [])
    } catch {
      toast.error("Error al cargar vendedores")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const vendedoresFiltrados = vendedores.filter(v => {
    const texto = `${v.first_name} ${v.last_name} ${v.email}`.toLowerCase()
    if (busqueda && !texto.includes(busqueda.toLowerCase())) return false
    if (filtroEstado === "activo" && v.activo === false) return false
    if (filtroEstado === "inactivo" && v.activo !== false) return false
    return true
  })

  const abrirDetalle = async (v: Vendedor) => {
    setDetalleModal({ open: true, vendedor: v })
    setLoadingMetricas(true)
    try {
      const { data } = await axios.get(`${API_URL}/admin/vendedores/${v.id}/metricas`, { headers: getHeaders() })
      setVendedorMetricas(data?.data ?? data)
    } catch {
      toast.error("Error al cargar métricas del vendedor")
    } finally {
      setLoadingMetricas(false)
    }
  }

  const asignarSupervisor = async () => {
    if (!supervisorModal.vendedor || !nuevoSupervisorId) return
    try {
      await axios.post(`${API_URL}/admin/vendedores/asignar`, { vendedorId: supervisorModal.vendedor.id, supervisorId: Number(nuevoSupervisorId) }, { headers: getHeaders() })
      toast.success("Supervisor asignado")
      setSupervisorModal({ open: false, vendedor: null })
      fetchAll()
    } catch {
      toast.error("Error al asignar supervisor")
    }
  }

  const toggleEstado = async (v: Vendedor) => {
    const endpoint = v.activo !== false ? "disable-user" : "enable-user"
    try {
      await axios.put(`${API_URL}/admin/${endpoint}/${v.id}`, {}, { headers: getHeaders() })
      toast.success(`Vendedor ${v.activo !== false ? "deshabilitado" : "habilitado"}`)
      fetchAll()
    } catch {
      toast.error("Error al cambiar estado")
    }
  }

  const asignarCategoria = async () => {
    if (!categoriaModal.vendedor) return
    try {
      await axios.put(
        `${API_URL}/admin/categorias/vendedor/${categoriaModal.vendedor.id}/categoria`,
        { categoriaId: nuevaCategoriaId === "sin-categoria" ? null : nuevaCategoriaId || null },
        { headers: getHeaders() }
      )
        toast.success("Categoría asignada correctamente")
      setCategoriaModal({ open: false, vendedor: null })
      setNuevaCategoriaId("")
      fetchAll()
    } catch {
        toast.error("Error al asignar categoría")
    }
  }

  // -- Abrir modal prospectos (paso 1) ---------------------------------------

  const eliminarVendedor = async (v: Vendedor) => {
    const ok = await confirm({
      title: `¿Eliminar permanentemente a ${v.first_name} ${v.last_name}?`,
      description: "Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      destructive: true,
    })
    if (!ok) return
    try {
      await axios.delete(API_URL + "/admin/vendedores/" + v.id, { headers: getHeaders() })
      toast.success("Vendedor eliminado correctamente")
      fetchAll()
    } catch {
      toast.error("Error al eliminar vendedor")
    }
  }
  const abrirProspectos = async (v: Vendedor) => {
    setProspectosModal({ open: true, vendedor: v })
    setSeleccionados([])
    setLoadingProspectos(true)
    try {
      const { data } = await axios.get(`${API_URL}/admin/vendedores/${v.id}/prospectos`, { headers: getHeaders() })
      setProspectos(data?.data ?? data ?? [])
    } catch {
      toast.error("Error al cargar prospectos")
    } finally {
      setLoadingProspectos(false)
    }
  }

  const toggleSeleccion = (id: number) => {
    setSeleccionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const toggleSeleccionarTodos = () => {
    if (seleccionados.length === prospectos.length) {
      setSeleccionados([])
    } else {
      setSeleccionados(prospectos.map(p => p.id))
    }
  }

  // -- Confirmar reasignación (paso 2) ---------------------------------------
  const confirmarReasignacion = async () => {
    if (!prospectosModal.vendedor || !nuevoVendedorId || seleccionados.length === 0) return
    setReasignando(true)
    try {
      await axios.post(
        `${API_URL}/admin/vendedores/reasignar-prospectos`,
        {
          prospectos: seleccionados,
          nuevo_vendedor_id: Number(nuevoVendedorId),
          vendedor_anterior_id: prospectosModal.vendedor.id
        },
        { headers: getHeaders() }
      )
      toast.success(`${seleccionados.length} prospecto${seleccionados.length !== 1 ? "s" : ""} reasignado${seleccionados.length !== 1 ? "s" : ""} correctamente`)
      setReasignarModal(false)
      setNuevoVendedorId("")

      // Recargar prospectos restantes del vendedor
      const { data } = await axios.get(`${API_URL}/admin/vendedores/${prospectosModal.vendedor.id}/prospectos`, { headers: getHeaders() })
      const restantes: ProspectoVendedor[] = data?.data ?? data ?? []
      setProspectos(restantes)
      setSeleccionados([])
      fetchAll()

      // Si ya no tiene prospectos, ofrecer deshabilitar
      if (restantes.length === 0) {
        const nombre = `${prospectosModal.vendedor.first_name} ${prospectosModal.vendedor.last_name}`
        toast(`${nombre} ya no tiene prospectos asignados.`, {
          action: {
            label: "Deshabilitar vendedor",
            onClick: () => toggleEstado(prospectosModal.vendedor!)
          },
          duration: 8000,
        })
        setProspectosModal({ open: false, vendedor: null })
      }
    } catch {
      toast.error("Error al reasignar prospectos")
    } finally {
      setReasignando(false)
    }
  }

  return (
    <TooltipProvider>
    <div className="space-y-4">
      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center">
          <Users className="size-4 mx-auto mb-1 text-primary" />
          <p className="text-2xl font-bold text-foreground">{metricas.totalVendedores}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <UserCheck className="size-4 mx-auto mb-1 text-state-ok-text" />
          <p className="text-2xl font-bold text-foreground">{metricas.vendedoresActivos}</p>
          <p className="text-xs text-muted-foreground">Activos</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <UserX className="size-4 mx-auto mb-1 text-state-warn-text" />
          <p className="text-2xl font-bold text-foreground">{metricas.vendedoresSinSupervisor}</p>
          <p className="text-xs text-muted-foreground">Sin supervisor</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <UserCog className="size-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-2xl font-bold text-foreground">{metricas.supervisioresActivos}</p>
          <p className="text-xs text-muted-foreground">Supervisores activos</p>
        </CardContent></Card>
      </div>

      {/* Barra */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar vendedor..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="activo">Activos</SelectItem>
            <SelectItem value="inactivo">Inactivos</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchAll}><RefreshCw className="size-4" /></Button>
      </div>

      {/* Tabla */}
      {loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Supervisor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-36">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendedoresFiltrados.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium text-sm">{v.first_name} {v.last_name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{v.email}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {v.supervisor_nombre ?? <span className="text-muted-foreground text-xs">Sin asignar</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={v.activo !== false ? "ok" : "secondary"}>
                      {v.activo !== false ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                                        <div className="flex gap-1 flex-wrap">
                      <Tooltip><TooltipTrigger asChild>
                        <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => abrirDetalle(v)}><Eye className="size-3.5" /></Button>
                      </TooltipTrigger><TooltipContent>Ver métricas</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => { setSupervisorModal({ open: true, vendedor: v }); setNuevoSupervisorId("") }}><UserCog className="size-3.5" /></Button>
                      </TooltipTrigger><TooltipContent>Asignar supervisor</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => abrirProspectos(v)}><ArrowLeftRight className="size-3.5" /></Button>
                      </TooltipTrigger><TooltipContent>Ver y reasignar prospectos</TooltipContent></Tooltip>
                      {categorias.length > 0 && (
                        <Tooltip><TooltipTrigger asChild>
                          <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => { setCategoriaModal({ open: true, vendedor: v }); setNuevaCategoriaId(v.categoria_id ? String(v.categoria_id) : "") }}><Tag className="size-3.5" /></Button>
                        </TooltipTrigger><TooltipContent>Cambiar categoría</TooltipContent></Tooltip>
                      )}
                      <Tooltip><TooltipTrigger asChild>
                        <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => toggleEstado(v)}>
                          {v.activo !== false ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />}
                        </Button>
                      </TooltipTrigger><TooltipContent>{v.activo !== false ? "Deshabilitar" : "Habilitar"}</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <Button size="icon" variant="destructive" className="size-8" onClick={() => eliminarVendedor(v)}><Trash2 className="size-3.5" /></Button>
                      </TooltipTrigger><TooltipContent>Eliminar vendedor</TooltipContent></Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {vendedoresFiltrados.length === 0 && <div className="text-center py-12 text-sm text-muted-foreground">Sin resultados</div>}
        </div>
      )}

      {/* -- Modal Métricas Vendedor --------------------------------------- */}
      <Dialog open={detalleModal.open} onOpenChange={open => setDetalleModal({ open, vendedor: open ? detalleModal.vendedor : null })}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Métricas: {detalleModal.vendedor?.first_name} {detalleModal.vendedor?.last_name}</DialogTitle>
          </DialogHeader>
          {loadingMetricas ? (
            <Skeleton className="h-32 w-full" />
          ) : vendedorMetricas ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {Object.entries(vendedorMetricas).map(([key, val]) =>
                (typeof val === "number" || typeof val === "string") ? (
                  <div key={key} className="bg-muted/50 rounded p-3">
                    <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                    <p className="font-bold text-lg">{String(val)}</p>
                  </div>
                ) : null
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Sin métricas disponibles</p>
          )}
        </DialogContent>
      </Dialog>

      {/* -- Modal Asignar Supervisor -------------------------------------- */}
      <Dialog open={supervisorModal.open} onOpenChange={open => setSupervisorModal({ open, vendedor: open ? supervisorModal.vendedor : null })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Asignar supervisor</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Vendedor: <strong>{supervisorModal.vendedor?.first_name} {supervisorModal.vendedor?.last_name}</strong></p>
          <Select value={nuevoSupervisorId} onValueChange={setNuevoSupervisorId}>
            <SelectTrigger><SelectValue placeholder="Seleccionar supervisor..." /></SelectTrigger>
            <SelectContent>
              {supervisores.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.first_name} {s.last_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupervisorModal({ open: false, vendedor: null })}>Cancelar</Button>
            <Button onClick={asignarSupervisor} disabled={!nuevoSupervisorId} className="bg-primary hover:bg-primary/90 text-primary-foreground">Asignar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -- PASO 1: Modal prospectos del vendedor con selección ----------- */}
      <Dialog open={prospectosModal.open} onOpenChange={open => { if (!open) { setProspectosModal({ open: false, vendedor: null }); setSeleccionados([]) } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="size-4" />
              Prospectos de {prospectosModal.vendedor?.first_name} {prospectosModal.vendedor?.last_name}
            </DialogTitle>
          </DialogHeader>

          {loadingProspectos ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : prospectos.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="size-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Este vendedor no tiene prospectos asignados.</p>
            </div>
          ) : (
            <>
              {/* Barra de selección */}
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={seleccionados.length === prospectos.length && prospectos.length > 0}
                    onCheckedChange={toggleSeleccionarTodos}
                    id="select-all"
                  />
                  <Label htmlFor="select-all" className="text-sm cursor-pointer">
                    {seleccionados.length === prospectos.length ? "Deseleccionar todos" : "Seleccionar todos"}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Total: <strong>{prospectos.length}</strong>
                    {seleccionados.length > 0 && <> · <span className="text-primary">{seleccionados.length} seleccionados</span></>}
                  </span>
                </div>
              </div>

              {/* Tabla con scroll */}
              <div className="overflow-auto flex-1 min-h-0 rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="hidden sm:table-cell">Contacto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="hidden md:table-cell">Asignado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prospectos.map(p => (
                      <TableRow key={p.id} className={seleccionados.includes(p.id) ? "bg-primary/5" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={seleccionados.includes(p.id)}
                            onCheckedChange={() => toggleSeleccion(p.id)}
                          />
                        </TableCell>
                        <TableCell className="font-bold text-primary text-sm">{p.id}</TableCell>
                        <TableCell className="text-sm font-medium">{p.nombre} {p.apellido}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                          <div>{p.numero_contacto}</div>
                          <div>{p.correo}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{p.estado ?? "-"}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {p.fecha_asignacion ? new Date(p.fecha_asignacion).toLocaleDateString("es-AR") : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          <DialogFooter className="pt-2 border-t flex gap-2">
            <Button variant="outline" onClick={() => { setProspectosModal({ open: false, vendedor: null }); setSeleccionados([]) }}>
              Cerrar
            </Button>
            {prospectos.length > 0 && (
              <Button
                onClick={() => { setReasignarModal(true); setNuevoVendedorId("") }}
                disabled={seleccionados.length === 0}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <ArrowLeftRight className="size-3.5 mr-1.5" />
                Reasignar seleccionados ({seleccionados.length})
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -- PASO 2: Modal elegir vendedor destino ------------------------- */}
      <Dialog open={reasignarModal} onOpenChange={open => { if (!open) { setReasignarModal(false); setNuevoVendedorId("") } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reasignar prospectos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <p>Reasignando <strong>{seleccionados.length}</strong> prospecto{seleccionados.length !== 1 ? "s" : ""} de:</p>
              <p className="font-semibold">{prospectosModal.vendedor?.first_name} {prospectosModal.vendedor?.last_name}</p>
            </div>

            {seleccionados.length > 0 && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 max-h-24 overflow-y-auto">
                {prospectos.filter(p => seleccionados.includes(p.id)).map(p => (
                  <div key={p.id}>{p.nombre} {p.apellido} (ID: {p.id})</div>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Vendedor destino</Label>
              <Select value={nuevoVendedorId} onValueChange={setNuevoVendedorId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar vendedor..." /></SelectTrigger>
                <SelectContent>
                  {vendedores
                    .filter(v => v.id !== prospectosModal.vendedor?.id && v.activo !== false)
                    .map(v => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.first_name} {v.last_name}
                        {v.total_prospectos != null && <span className="text-muted-foreground ml-1">({v.total_prospectos} prospectos)</span>}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-muted border p-2 text-xs text-muted-foreground">
              <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
              <span>Al reasignar, el nuevo vendedor será notificado y podrá ver todo el historial del prospecto.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReasignarModal(false); setNuevoVendedorId("") }} disabled={reasignando}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarReasignacion}
              disabled={!nuevoVendedorId || reasignando}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <ArrowLeftRight className="size-3.5 mr-1.5" />
              {reasignando ? "Reasignando..." : "Confirmar reasignación"}               
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Cambiar Categoría */}
      <Dialog open={categoriaModal.open} onOpenChange={open => { if (!open) { setCategoriaModal({ open: false, vendedor: null }); setNuevaCategoriaId("") } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar categoría</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Vendedor: <strong>{categoriaModal.vendedor?.first_name} {categoriaModal.vendedor?.last_name}</strong>
          </p>
          <Select value={nuevaCategoriaId} onValueChange={setNuevaCategoriaId}>
            <SelectTrigger><SelectValue placeholder="Seleccionar categoría..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sin-categoria">Sin categoría</SelectItem>
              {categorias.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCategoriaModal({ open: false, vendedor: null }); setNuevaCategoriaId("") }}>Cancelar</Button>
            <Button onClick={asignarCategoria} className="bg-primary hover:bg-primary/90 text-primary-foreground">Asignar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  )
}