import { useState, useEffect, useCallback } from "react"
import axios from "axios"
import { toast } from "sonner"
import { UserCheck, UserX, Users, RefreshCw, Search, Eye, UserPlus, Link2Off } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Supervisor {
  id: number
  first_name: string
  last_name: string
  email: string
  is_enabled?: boolean
  last_login?: string
  total_vendedores?: number
  vendedores_activos?: number
  phone_number?: string
  created_at?: string
}

interface VendedorDetalle {
  id: number
  first_name: string
  last_name: string
  email: string
  is_enabled?: boolean
  last_login?: string
  total_prospectos?: number
  ventas_realizadas?: number
  prospectos_activos?: number
  categoria_nombre?: string
}

interface SupervisorDetalle {
  supervisor: Supervisor
  vendedores: VendedorDetalle[]
}

interface VendedorSinSupervisor {
  id: number
  first_name: string
  last_name: string
  email: string
  is_enabled?: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────
const formatFecha = (dateStr?: string) => {
  if (!dateStr) return "Nunca"
  return new Date(dateStr).toLocaleDateString("es-AR")
}

const diasDesdeLogin = (lastLogin?: string) => {
  if (!lastLogin) return 999
  return Math.floor((Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * El color acá ES el dato: el supervisor tiene que ver de un vistazo quién se
 * desenganchó. Va de gris (cuenta apagada, no es una alarma) a rojo (lleva más
 * de una semana sin entrar) pasando por ámbar.
 */
const BADGE_BASE = "font-semibold uppercase text-[10px] px-2 py-0.5 rounded-full border"

function EstadoBadge({ isEnabled, lastLogin }: { isEnabled?: boolean; lastLogin?: string }) {
  if (!isEnabled)
    return (
      <Badge className={`${BADGE_BASE} bg-muted text-muted-foreground`}>
        Cuenta inactiva
      </Badge>
    )
  const dias = diasDesdeLogin(lastLogin)
  if (dias > 7)
    return (
      <Badge className={`${BADGE_BASE} bg-state-risk-soft text-state-risk-text border-state-risk/25`}>
        Sin entrar hace 7+ días
      </Badge>
    )
  if (dias > 3)
    return (
      <Badge className={`${BADGE_BASE} bg-state-warn-soft text-state-warn-text border-state-warn/25`}>
        Sin entrar hace {dias} días
      </Badge>
    )
  return (
    <Badge className={`${BADGE_BASE} bg-state-ok-soft text-state-ok-text border-state-ok/25`}>
      Activo
    </Badge>
  )
}

// ── Componente principal ───────────────────────────────────────────────────
export default function SupervisoresAdmin() {
  const [supervisores, setSupervisores] = useState<Supervisor[]>([])
  const [vendedoresSinSupervisor, setVendedoresSinSupervisor] = useState<VendedorSinSupervisor[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")

  const [detalleModal, setDetalleModal] = useState<{ open: boolean; sup: Supervisor | null }>({ open: false, sup: null })
  const [detalleData, setDetalleData] = useState<SupervisorDetalle | null>(null)
  const [detalleLoading, setDetalleLoading] = useState(false)

  const [asignarModal, setAsignarModal] = useState<{ open: boolean; sup: Supervisor | null }>({ open: false, sup: null })
  const [asignando, setAsignando] = useState(false)

  const [confirmToggle, setConfirmToggle] = useState<{ open: boolean; sup: Supervisor | null }>({ open: false, sup: null })

  const fetchAll = useCallback(async () => {
    const headers = { Authorization: `Bearer ${getAuthToken()}` }
    setLoading(true)
    try {
      const sRes = await axios.get(`${API_URL}/admin/supervisores`, { headers })
      setSupervisores(sRes.data?.data ?? sRes.data ?? [])
    } catch {
      toast.error("Error al cargar supervisores")
    }
    try {
      const vRes = await axios.get(`${API_URL}/admin/vendedores-sin-supervisor`, { headers })
      setVendedoresSinSupervisor(vRes.data?.data ?? vRes.data ?? [])
    } catch {
      // vendedores-sin-supervisor es opcional, no bloquea
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const filtrados = supervisores.filter(s => {
    const texto = `${s.first_name} ${s.last_name} ${s.email}`.toLowerCase()
    return !busqueda || texto.includes(busqueda.toLowerCase())
  })

  const getHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` })

  const abrirDetalle = async (s: Supervisor) => {
    setDetalleModal({ open: true, sup: s })
    setDetalleLoading(true)
    setDetalleData(null)
    try {
      const { data } = await axios.get(`${API_URL}/admin/supervisores/${s.id}`, { headers: getHeaders() })
      setDetalleData(data?.data ?? data)
    } catch {
      toast.error("Error al cargar detalles")
    } finally {
      setDetalleLoading(false)
    }
  }

  const ejecutarToggle = async () => {
    const s = confirmToggle.sup
    if (!s) return
    try {
      await axios.patch(`${API_URL}/admin/supervisores/${s.id}/toggle-status`, {}, { headers: getHeaders() })
      toast.success(`Supervisor ${s.is_enabled ? "deshabilitado" : "habilitado"} correctamente`)
      setConfirmToggle({ open: false, sup: null })
      fetchAll()
    } catch {
      toast.error("Error al cambiar estado")
    }
  }

  const asignarVendedor = async (vendedorId: number) => {
    if (!asignarModal.sup) return
    setAsignando(true)
    try {
      await axios.post(
        `${API_URL}/admin/vendedores/asignar`,
        { vendedorId, supervisorId: asignarModal.sup.id },
        { headers: getHeaders() }
      )
      toast.success("Vendedor asignado correctamente")
      setAsignarModal({ open: false, sup: null })
      fetchAll()
    } catch {
      toast.error("Error al asignar vendedor")
    } finally {
      setAsignando(false)
    }
  }

  const totalVendedores = supervisores.reduce((a, s) => a + (s.total_vendedores ?? 0), 0)
  const supervisoresActivos = supervisores.filter(s => s.is_enabled !== false).length

  return (
    <div className="space-y-5">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <UserCheck className="size-4 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold text-foreground">{supervisores.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Supervisores</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <UserCheck className="size-4 mx-auto mb-1 text-emerald-500" />
            <p className="text-2xl font-bold text-foreground">{supervisoresActivos}</p>
            <p className="text-xs text-muted-foreground mt-1">Supervisores Activos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="size-4 mx-auto mb-1 text-sky-500" />
            <p className="text-2xl font-bold text-foreground">{totalVendedores}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Vendedores</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <UserX className="size-4 mx-auto mb-1 text-amber-500" />
            <p className="text-2xl font-bold text-foreground">{vendedoresSinSupervisor.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Sin Supervisor</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabla principal ── */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-semibold">Lista de Supervisores</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-primary hover:bg-primary text-white size-7 rounded-full flex items-center justify-center text-sm p-0">
              {filtrados.length}
            </Badge>
            <Button variant="ghost" size="icon" className="size-8" onClick={fetchAll} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>

        <div className="px-6 pb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar supervisor..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="px-6 pb-6 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No se encontraron supervisores
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold text-xs uppercase">Supervisor</TableHead>
                    <TableHead className="font-semibold text-xs uppercase text-center">Estado</TableHead>
                    <TableHead className="font-semibold text-xs uppercase text-center">Equipo</TableHead>
                    <TableHead className="font-semibold text-xs uppercase text-center hidden md:table-cell">Vendedores Activos</TableHead>
                    <TableHead className="font-semibold text-xs uppercase text-center hidden lg:table-cell">Último Acceso</TableHead>
                    <TableHead className="font-semibold text-xs uppercase text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map(s => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <p className="font-semibold text-sm leading-tight">{s.first_name} {s.last_name}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </TableCell>
                      <TableCell className="text-center">
                        <EstadoBadge isEnabled={s.is_enabled} lastLogin={s.last_login} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-primary hover:bg-primary text-white font-semibold uppercase text-[10px] px-3 py-1 rounded-full">
                          {s.total_vendedores ?? 0} VENDEDORES
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center hidden md:table-cell">
                        <span className="inline-flex size-7 items-center justify-center rounded-full bg-green-500 text-white text-xs font-bold">
                          {s.vendedores_activos ?? 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground hidden lg:table-cell">
                        {formatFecha(s.last_login)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="icon"
                            onClick={() => abrirDetalle(s)}
                            title="Ver detalles"
                            className="size-8 bg-muted text-foreground border hover:bg-accent"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            onClick={() => setAsignarModal({ open: true, sup: s })}
                            title="Asignar vendedor"
                            className="size-8 bg-muted text-foreground border hover:bg-accent"
                          >
                            <UserPlus className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            onClick={() => setConfirmToggle({ open: true, sup: s })}
                            title={s.is_enabled !== false ? "Deshabilitar" : "Habilitar"}
                            className={`size-8 ${s.is_enabled !== false ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-500 hover:bg-emerald-600"} text-white border-0`}
                          >
                            <Link2Off className="size-3.5" />
                          </Button>
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

      {/* ════ Modal: Detalle de supervisor ════ */}
      <Dialog open={detalleModal.open} onOpenChange={open => setDetalleModal({ open, sup: open ? detalleModal.sup : null })}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="size-5 text-primary" />
              Detalles de {detalleModal.sup?.first_name} {detalleModal.sup?.last_name}
            </DialogTitle>
          </DialogHeader>

          {detalleLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          ) : detalleData ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 space-y-1.5 text-sm">
                  <p className="text-sm font-semibold text-primary mb-3">Información del supervisor</p>
                  <p><span className="font-medium">Nombre:</span> {detalleData.supervisor.first_name} {detalleData.supervisor.last_name}</p>
                  <p><span className="font-medium">Email:</span> {detalleData.supervisor.email}</p>
                  {detalleData.supervisor.phone_number && (
                    <p><span className="font-medium">Teléfono:</span> {detalleData.supervisor.phone_number}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Estado:</span>
                    <EstadoBadge isEnabled={detalleData.supervisor.is_enabled} lastLogin={detalleData.supervisor.last_login} />
                  </div>
                  <p className="text-xs text-muted-foreground">Último acceso: {formatFecha(detalleData.supervisor.last_login)}</p>
                  {detalleData.supervisor.created_at && (
                    <p className="text-xs text-muted-foreground">Alta: {formatFecha(detalleData.supervisor.created_at)}</p>
                  )}
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-semibold text-primary mb-3">Resumen del equipo</p>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div>
                      <p className="text-2xl font-bold">{(detalleData.vendedores ?? []).length}</p>
                      <p className="text-xs text-muted-foreground">Vendedores</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        {(detalleData.vendedores ?? []).filter(v => v.is_enabled !== false).length}
                      </p>
                      <p className="text-xs text-muted-foreground">Activos</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold mb-3">Vendedores del equipo</p>
                {(detalleData.vendedores ?? []).length === 0 ? (
                  <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                    Este supervisor no tiene vendedores asignados
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-xs uppercase">Vendedor</TableHead>
                          <TableHead className="text-xs uppercase text-center">Estado</TableHead>
                          <TableHead className="text-xs uppercase text-center hidden md:table-cell">Último acceso</TableHead>
                          <TableHead className="text-xs uppercase text-center">Prospectos</TableHead>
                          <TableHead className="text-xs uppercase text-center">Ventas</TableHead>
                          <TableHead className="text-xs uppercase text-center hidden lg:table-cell">Activos</TableHead>
                          <TableHead className="text-xs uppercase text-center hidden lg:table-cell">Categoría</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detalleData.vendedores.map(v => (
                          <TableRow key={v.id}>
                            <TableCell>
                              <p className="font-medium text-sm leading-tight">{v.first_name} {v.last_name}</p>
                              <p className="text-xs text-muted-foreground">{v.email}</p>
                            </TableCell>
                            <TableCell className="text-center">
                              <EstadoBadge isEnabled={v.is_enabled} lastLogin={v.last_login} />
                            </TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground hidden md:table-cell">
                              {formatFecha(v.last_login)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-primary hover:bg-primary text-white text-xs rounded-full px-2">
                                {v.total_prospectos ?? 0}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs rounded-full px-2">
                                {v.ventas_realizadas ?? 0}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center hidden lg:table-cell">
                              <Badge variant="secondary" className="text-xs rounded-full px-2">
                                {v.prospectos_activos ?? 0}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center hidden lg:table-cell">
                              <Badge variant="secondary" className="text-xs">
                                {v.categoria_nombre ?? "Sin categoría"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Sin información disponible</p>
          )}

          <DialogFooter>
            <Button variant="destructive"
              onClick={() => setDetalleModal({ open: false, sup: null })}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════ Modal: Asignar vendedor ════ */}
      <Dialog open={asignarModal.open} onOpenChange={open => setAsignarModal({ open, sup: open ? asignarModal.sup : null })}>
        <DialogContent className="sm:max-w-lg" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-green-600" />
              Asignar Vendedor a {asignarModal.sup?.first_name} {asignarModal.sup?.last_name}
            </DialogTitle>
          </DialogHeader>

          {vendedoresSinSupervisor.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No hay vendedores sin supervisor disponibles
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs uppercase">Vendedor</TableHead>
                    <TableHead className="text-xs uppercase">Email</TableHead>
                    <TableHead className="text-xs uppercase text-center">Estado</TableHead>
                    <TableHead className="text-xs uppercase text-center">Asignar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendedoresSinSupervisor.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium text-sm">{v.first_name} {v.last_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{v.email}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={v.is_enabled !== false
                          ? "bg-green-500 hover:bg-green-500 text-white text-[10px] rounded-full"
                          : "bg-muted text-foreground border hover:bg-accent text-[10px] rounded-full"}>
                          {v.is_enabled !== false ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" disabled={asignando} onClick={() => asignarVendedor(v.id)}
                          className="bg-green-500 hover:bg-green-600 text-white size-8 p-0">
                          <UserPlus className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            <Button variant="destructive"
              onClick={() => setAsignarModal({ open: false, sup: null })}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════ Modal: Confirmar toggle estado ════ */}
      <Dialog open={confirmToggle.open} onOpenChange={open => setConfirmToggle({ open, sup: open ? confirmToggle.sup : null })}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2Off className="size-5 text-red-500" />
              {confirmToggle.sup?.is_enabled !== false ? "Deshabilitar supervisor" : "Habilitar supervisor"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de que deseas{" "}
            <span className="font-semibold text-foreground">
              {confirmToggle.sup?.is_enabled !== false ? "deshabilitar" : "habilitar"}
            </span>{" "}
            a <span className="font-semibold text-foreground">
              {confirmToggle.sup?.first_name} {confirmToggle.sup?.last_name}
            </span>?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="destructive" onClick={() => setConfirmToggle({ open: false, sup: null })}>
              Cancelar
            </Button>
            <Button onClick={ejecutarToggle}
              className={confirmToggle.sup?.is_enabled !== false
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-green-500 hover:bg-green-600 text-white"}>
              {confirmToggle.sup?.is_enabled !== false ? "Sí, deshabilitar" : "Sí, habilitar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
