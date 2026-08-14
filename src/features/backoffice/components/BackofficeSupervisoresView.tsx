import { useEffect, useState } from "react"
import axios from "axios"
import { toast } from "sonner"
import { Search, Users, UserPlus, UserCheck, Eye, ToggleLeft, ToggleRight, RefreshCw, ShieldCheck, UserX, TrendingUp, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/common/StatCard"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Supervisor {
  id: number
  first_name?: string
  last_name?: string
  nombre?: string
  email?: string
  is_enabled?: boolean
  total_vendedores?: number
  total_prospectos?: number
  ventas?: number
}

interface VendedorSinSupervisor {
  id: number
  first_name: string
  last_name: string
  email?: string
}

interface VendedorEquipo {
  id: number
  first_name: string
  last_name: string
  email?: string
  categoria_nombre?: string
  is_enabled?: boolean
  prospectos?: number
  ventas?: number
  last_login?: string
}

interface SupervisorDetalle {
  supervisor: Supervisor
  vendedores?: VendedorEquipo[]
  estadisticas?: { total_prospectos: number; ventas_mes: number; polizas: number }
}

export function BackofficeSupervisoresView() {
  const [supervisores, setSupervisores] = useState<Supervisor[]>([])
  const [vendedoresSin, setVendedoresSin] = useState<VendedorSinSupervisor[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")

  const [detalleModal, setDetalleModal] = useState(false)
  const [asignacionModal, setAsignacionModal] = useState(false)
  const [supervisorSeleccionado, setSupervisorSeleccionado] = useState<Supervisor | null>(null)
  const [detalle, setDetalle] = useState<SupervisorDetalle | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [vendedorAsignarId, setVendedorAsignarId] = useState("")
  const [savingAsignacion, setSavingAsignacion] = useState(false)
  const [savingToggle, setSavingToggle] = useState<number | null>(null)
  const [savingToggleVendedor, setSavingToggleVendedor] = useState<number | null>(null)

  const getAuth = () => ({ Authorization: `Bearer ${getAuthToken()}` })

  const fetchSupervisores = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API_URL}/backoffice/supervisores`, { headers: getAuth() })
      setSupervisores(data.data ?? data ?? [])
    } catch { toast.error("Error al cargar supervisores") }
    finally { setLoading(false) }
  }

  const fetchVendedoresSin = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/backoffice/vendedores-sin-supervisor`, { headers: getAuth() })
      setVendedoresSin(data.data ?? data ?? [])
    } catch { /* silencioso */ }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchSupervisores(); fetchVendedoresSin() }, [])

  const verDetalle = async (sup: Supervisor) => {
    setSupervisorSeleccionado(sup)
    setDetalleModal(true)
    setLoadingDetalle(true)
    setDetalle(null)
    try {
      const { data } = await axios.get(`${API_URL}/backoffice/supervisores/${sup.id}`, { headers: getAuth() })
      setDetalle(data.data ?? data ?? null)
    } catch { toast.error("Error al cargar detalles") }
    finally { setLoadingDetalle(false) }
  }

  const abrirAsignacion = (sup: Supervisor) => {
    setSupervisorSeleccionado(sup)
    setVendedorAsignarId("")
    setAsignacionModal(true)
  }

  const asignarVendedor = async () => {
    if (!supervisorSeleccionado || !vendedorAsignarId) return
    setSavingAsignacion(true)
    try {
      await axios.post(`${API_URL}/backoffice/vendedores/asignar`, { vendedorId: parseInt(vendedorAsignarId), supervisorId: supervisorSeleccionado.id }, { headers: getAuth() })
      toast.success("Vendedor asignado correctamente")
      setAsignacionModal(false)
      fetchSupervisores(); fetchVendedoresSin()
    } catch { toast.error("Error al asignar vendedor") }
    finally { setSavingAsignacion(false) }
  }

  const toggleEstado = async (sup: Supervisor) => {
    setSavingToggle(sup.id)
    try {
      await axios.patch(`${API_URL}/backoffice/supervisores/${sup.id}/toggle-status`, {}, { headers: getAuth() })
      toast.success(`Supervisor ${sup.is_enabled ? "deshabilitado" : "habilitado"}`)
      setSupervisores(prev => prev.map(s => s.id === sup.id ? { ...s, is_enabled: !s.is_enabled } : s))
    } catch { toast.error("Error al cambiar estado") }
    finally { setSavingToggle(null) }
  }

  const toggleVendedorEnEquipo = async (vendedor: VendedorEquipo) => {
    setSavingToggleVendedor(vendedor.id)
    try {
      await axios.patch(`${API_URL}/backoffice/vendedores/${vendedor.id}/toggle-status`, {}, { headers: getAuth() })
      toast.success(`Vendedor ${vendedor.is_enabled ? "deshabilitado" : "habilitado"}`)
      // Actualizar el estado en el detalle local
      setDetalle(prev => {
        if (!prev) return prev
        return {
          ...prev,
          vendedores: prev.vendedores?.map(v =>
            v.id === vendedor.id ? { ...v, is_enabled: !v.is_enabled } : v
          )
        }
      })
    } catch { toast.error("Error al cambiar estado del vendedor") }
    finally { setSavingToggleVendedor(null) }
  }

  const getNombre = (s: Supervisor) => s.nombre ?? `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim()

  const filtrados = supervisores.filter(s => !busqueda || getNombre(s).toLowerCase().includes(busqueda.toLowerCase()) || (s.email ?? "").toLowerCase().includes(busqueda.toLowerCase()))

  return (
    <TooltipProvider>
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Supervisores</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Gestión de supervisores y asignación de equipos de vendedores</p>
        </div>
        <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Actualizar supervisores" onClick={fetchSupervisores}>
          <RefreshCw className="size-3.5" aria-hidden="true" />
        </Button>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={ShieldCheck} label="Total supervisores" value={supervisores.length} />
        <StatCard icon={Users} label="Activos" value={supervisores.filter(s => s.is_enabled !== false).length} />
        <StatCard icon={UserCheck} label="Total vendedores" value={supervisores.reduce((acc, s) => acc + (s.total_vendedores ?? 0), 0)} />
        <StatCard
          icon={UserPlus}
          label="Sin supervisor"
          value={vendedoresSin.length}
          tone={vendedoresSin.length > 0 ? "warn" : "neutral"}
        />
      </div>

      {/* Búsqueda */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
          <Input className="pl-9 h-9" placeholder="Buscar supervisor por nombre o email…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {loading ? <Skeleton className="h-64 w-full" /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supervisor</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead className="text-center">Vendedores</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Prospectos</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Ventas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                          <div className="rounded-full bg-muted p-4"><ShieldCheck className="size-8 text-muted-foreground" aria-hidden="true" /></div>
                          <div>
                            <p className="font-medium text-sm">Sin supervisores</p>
                            <p className="text-xs text-muted-foreground mt-1">No hay supervisores que coincidan con la búsqueda</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filtrados.map(sup => (
                    <TableRow key={sup.id}>
                      <TableCell className="font-medium text-sm">{getNombre(sup)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{sup.email ?? "—"}</TableCell>
                      <TableCell className="text-center font-semibold">{sup.total_vendedores ?? "—"}</TableCell>
                      <TableCell className="text-center hidden md:table-cell">{sup.total_prospectos ?? "—"}</TableCell>
                      <TableCell className="text-center hidden md:table-cell font-semibold">{sup.ventas ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={sup.is_enabled !== false ? "ok" : "secondary"}>
                          {sup.is_enabled !== false ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Tooltip><TooltipTrigger asChild>
                            <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" aria-label="Ver equipo" onClick={() => verDetalle(sup)}><Eye className="size-3.5" aria-hidden="true" /></Button>
                          </TooltipTrigger><TooltipContent>Ver equipo</TooltipContent></Tooltip>
                          {vendedoresSin.length > 0 && (
                            <Tooltip><TooltipTrigger asChild>
                              <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" aria-label="Asignar vendedor" onClick={() => abrirAsignacion(sup)}><UserPlus className="size-3.5" aria-hidden="true" /></Button>
                            </TooltipTrigger><TooltipContent>Asignar vendedor</TooltipContent></Tooltip>
                          )}
                          <Tooltip><TooltipTrigger asChild>
                            <Button size="icon"
                              className="size-8 bg-muted text-foreground border hover:bg-accent"
                              aria-label={sup.is_enabled !== false ? "Deshabilitar supervisor" : "Habilitar supervisor"}
                              disabled={savingToggle === sup.id}
                              onClick={() => toggleEstado(sup)}>
                              {sup.is_enabled !== false ? <ToggleRight className="size-3.5" aria-hidden="true" /> : <ToggleLeft className="size-3.5" aria-hidden="true" />}
                            </Button>
                          </TooltipTrigger><TooltipContent>{sup.is_enabled !== false ? "Deshabilitar" : "Habilitar"}</TooltipContent></Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Detalle supervisor */}
      <Dialog open={detalleModal} onOpenChange={setDetalleModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <Eye className="inline size-4 mr-2" />
              Equipo — {supervisorSeleccionado ? getNombre(supervisorSeleccionado) : "Supervisor"}
            </DialogTitle>
          </DialogHeader>
          {loadingDetalle ? <Skeleton className="h-48 w-full" /> : detalle ? (
            <div className="flex flex-col gap-4">
              {/* Estadísticas del supervisor */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total prospectos", value: detalle.estadisticas?.total_prospectos, icon: Users },
                  { label: "Ventas del mes", value: detalle.estadisticas?.ventas_mes, icon: TrendingUp },
                  { label: "Pólizas", value: detalle.estadisticas?.polizas, icon: FileText },
                ].map(m => (
                  <StatCard key={m.label} icon={m.icon} label={m.label} value={m.value ?? "—"} />
                ))}
              </div>
              <Separator />
              {/* Equipo de vendedores con toggle */}
              <div>
                <h4 className="font-semibold text-sm mb-3">
                  Vendedores del equipo
                  <Badge variant="secondary" className="ml-2">{detalle.vendedores?.length ?? 0}</Badge>
                </h4>
                {(detalle.vendedores?.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center py-6 gap-2 text-muted-foreground">
                    <UserX className="size-6 opacity-40" />
                    <p className="text-sm">Sin vendedores asignados</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="hidden sm:table-cell">Email</TableHead>
                        <TableHead className="text-right">Prospectos</TableHead>
                        <TableHead className="text-right">Ventas</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalle.vendedores?.map(v => (
                        <TableRow key={v.id}>
                          <TableCell>
                            <p className="text-sm font-medium">{v.first_name} {v.last_name}</p>
                            {v.categoria_nombre && <p className="text-xs text-muted-foreground">{v.categoria_nombre}</p>}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{v.email ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{v.prospectos ?? "—"}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="ok">{v.ventas ?? "—"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={v.is_enabled !== false ? "ok" : "secondary"} className="text-xs">
                              {v.is_enabled !== false ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="size-7"
                                  disabled={savingToggleVendedor === v.id}
                                  onClick={() => toggleVendedorEnEquipo(v)}
                                  aria-label={v.is_enabled !== false ? "Deshabilitar vendedor" : "Habilitar vendedor"}
                                >
                                  {v.is_enabled !== false
                                    ? <ToggleRight className="size-3.5" aria-hidden="true" />
                                    : <ToggleLeft className="size-3.5" aria-hidden="true" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{v.is_enabled !== false ? "Deshabilitar vendedor" : "Habilitar vendedor"}</TooltipContent>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground text-center py-8">Sin datos disponibles</p>}
        </DialogContent>
      </Dialog>

      {/* Modal: Asignar vendedor */}
      <Dialog open={asignacionModal} onOpenChange={setAsignacionModal}>
        <DialogContent className="max-w-md" showCloseButton={false}>
          <DialogHeader><DialogTitle><UserPlus className="inline size-4 mr-2" />Asignar vendedor a {supervisorSeleccionado ? getNombre(supervisorSeleccionado) : ""}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm mb-1.5 block">Vendedor sin supervisor</Label>
              <Select value={vendedorAsignarId} onValueChange={setVendedorAsignarId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar vendedor..." /></SelectTrigger>
                <SelectContent>
                  {vendedoresSin.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.first_name} {v.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="destructive" onClick={() => setAsignacionModal(false)}>Cancelar</Button>
              <Button onClick={asignarVendedor} disabled={savingAsignacion || !vendedorAsignarId}>{savingAsignacion ? "Asignando..." : "Asignar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  )
}
