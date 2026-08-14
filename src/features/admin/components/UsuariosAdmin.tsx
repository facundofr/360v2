import { useState, useEffect, useCallback } from "react"
import axios from "axios"
import { toast } from "sonner"
import {
  Users, UserCheck, UserX, UserPlus, RefreshCw, Search,
  Edit2, Trash2, Eye, ShieldOff, ShieldCheck,
  Mail, Phone, User, Lock, Shield, Ban, CheckCircle,
  LayoutGrid, List, Wifi, Info, Calendar, BarChart2
} from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { API_URL } from "@/lib/config"
import ActiveUsersMonitor from "./ActiveUsersMonitor"
import { getAuthToken } from "@/lib/auth"

const ROLES = [
  { value: "1", label: "Vendedor" },
  { value: "2", label: "Supervisor" },
  { value: "3", label: "Administrador" },
  { value: "4", label: "Back Office" },
]

interface Usuario {
  id: number
  first_name: string
  last_name: string
  email: string
  phone_number?: string
  role: number
  activo?: boolean
  created_at?: string
  updated_at?: string
  last_login?: string
  email_verified?: boolean
}

const ROLE_LABELS: Record<number, string> = { 1: "Vendedor", 2: "Supervisor", 3: "Administrador", 4: "Backoffice" }

const defaultForm = {
  first_name: "", last_name: "", email: "", phone_number: "", role: "1", password: "",
}

export default function UsuariosAdmin() {
  const [users, setUsers] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [filtroRol, setFiltroRol] = useState("todos")
  const [filtroEstado, setFiltroEstado] = useState("todos")
  const [modal, setModal] = useState<{ open: boolean; user: Usuario | null }>({ open: false, user: null })
  const [form, setForm] = useState(defaultForm)
  const [guardando, setGuardando] = useState(false)
  const [detalleModal, setDetalleModal] = useState<{ open: boolean; user: Usuario | null }>({ open: false, user: null })
  const [confirmToggleModal, setConfirmToggleModal] = useState<{ open: boolean; user: Usuario | null }>({ open: false, user: null })
  const [reenviando, setReenviando] = useState<number | null>(null)
  const [confirmEliminarModal, setConfirmEliminarModal] = useState<{ open: boolean; user: Usuario | null }>({ open: false, user: null })
  const [textoEliminar, setTextoEliminar] = useState("")
  const [viewMode, setViewMode] = useState<"lista" | "tarjetas">("lista")

  const authHeaders = { Authorization: `Bearer ${getAuthToken()}` }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API_URL}/admin/list-users`, { headers: authHeaders })
      setUsers(data?.data ?? data ?? [])
    } catch {
      toast.error("Error al cargar usuarios")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const usuariosFiltrados = users.filter(u => {
    const texto = `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase()
    if (busqueda && !texto.includes(busqueda.toLowerCase())) return false
    if (filtroRol !== "todos" && String(u.role) !== filtroRol) return false
    if (filtroEstado === "activo" && u.activo === false) return false
    if (filtroEstado === "inactivo" && u.activo !== false) return false
    return true
  })

  const abrirCrear = () => {
    setForm(defaultForm)
    setModal({ open: true, user: null })
  }

  const abrirEditar = (u: Usuario) => {
    setForm({ first_name: u.first_name, last_name: u.last_name, email: u.email, phone_number: u.phone_number ?? "", role: String(u.role), password: "" })
    setModal({ open: true, user: u })
  }

  const guardar = async () => {
    if (!form.first_name || !form.last_name || !form.email) {
      toast.error("Nombre, apellido y email son obligatorios")
      return
    }
    if (!modal.user && !form.password) {
      toast.error("La contraseña es obligatoria para usuarios nuevos")
      return
    }
    setGuardando(true)
    try {
      if (modal.user) {
        const { password: _, ...data } = form
        await axios.put(`${API_URL}/admin/update-user/${modal.user.id}`, data, { headers: authHeaders })
        toast.success("Usuario actualizado")
      } else {
        await axios.post(`${API_URL}/admin/create-user`, form, { headers: authHeaders })
        toast.success("Usuario creado. Se envió email de verificación.")
      }
      setModal({ open: false, user: null })
      fetchUsers()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Error al guardar"
      toast.error(msg)
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (u: Usuario) => {
    setTextoEliminar("")
    setConfirmEliminarModal({ open: true, user: u })
  }

  const confirmarEliminar = async () => {
    const u = confirmEliminarModal.user
    if (!u) return
    setConfirmEliminarModal({ open: false, user: null })
    try {
      await axios.delete(`${API_URL}/admin/delete-user/${u.id}`, { headers: authHeaders })
      toast.success("Usuario eliminado")
      fetchUsers()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "No se pudo eliminar"
      toast.error(msg)
    }
  }

  const abrirConfirmToggle = (u: Usuario) => {
    setConfirmToggleModal({ open: true, user: u })
  }

  const confirmarToggle = async () => {
    const u = confirmToggleModal.user
    if (!u) return
    const endpoint = u.activo !== false ? "disable-user" : "enable-user"
    const accion = u.activo !== false ? "deshabilitado" : "habilitado"
    setConfirmToggleModal({ open: false, user: null })
    try {
      await axios.put(`${API_URL}/admin/${endpoint}/${u.id}`, {}, { headers: authHeaders })
      toast.success(`Usuario ${accion}`)
      fetchUsers()
    } catch {
      toast.error("Error al cambiar estado")
    }
  }

  const toggleEstado = abrirConfirmToggle

  // ─── Reenviar email de verificación ───────────────────────────────────────
  // POST /admin/resend-verification/:id (paridad con producción).
  const reenviarVerificacion = async (u: Usuario) => {
    setReenviando(u.id)
    try {
      await axios.post(`${API_URL}/admin/resend-verification/${u.id}`, {}, { headers: authHeaders })
      toast.success("Email de verificación reenviado correctamente")
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? "No se pudo reenviar el email"
      toast.error(msg)
    } finally {
      setReenviando(null)
    }
  }

  return (
    <Tabs defaultValue="gestion">
      <TabsList className="mb-4">
        <TabsTrigger value="gestion" className="flex items-center gap-1.5">
          <Users className="size-3.5" />Gestión de Usuarios
        </TabsTrigger>
        <TabsTrigger value="activos" className="flex items-center gap-1.5">
          <Wifi className="size-3.5" />Usuarios Activos
          <Badge variant="ok" className="ml-1 text-[9px] px-1 py-0 h-4 leading-none">TIEMPO REAL</Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="activos">
        <ActiveUsersMonitor />
      </TabsContent>

      <TabsContent value="gestion">
    <div className="space-y-4">
      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center">
          <Users className="size-4 mx-auto mb-1 text-primary" />
          <p className="text-2xl font-bold text-foreground">{users.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <UserCheck className="size-4 mx-auto mb-1 text-state-ok-text" />
          <p className="text-2xl font-bold text-foreground">{users.filter(u => u.activo !== false).length}</p>
          <p className="text-xs text-muted-foreground">Activos</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <UserX className="size-4 mx-auto mb-1 text-state-risk-text" />
          <p className="text-2xl font-bold text-foreground">{users.filter(u => u.activo === false).length}</p>
          <p className="text-xs text-muted-foreground">Inactivos</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <UserPlus className="size-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-2xl font-bold text-foreground">{users.filter(u => u.role === 1).length}</p>
          <p className="text-xs text-muted-foreground">Vendedores</p>
        </CardContent></Card>
      </div>

      {/* Barra de herramientas */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar usuario..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <Select value={filtroRol} onValueChange={setFiltroRol}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Rol" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los roles</SelectItem>
            {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="activo">Activos</SelectItem>
            <SelectItem value="inactivo">Inactivos</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchUsers}><RefreshCw className="size-4" /></Button>
        {/* Toggle vista */}
        <div className="flex rounded-md border overflow-hidden">
          <Button
            variant={viewMode === "lista" ? "default" : "ghost"}
            size="icon"
            className={`h-9 w-9 rounded-none border-0 ${viewMode === "lista" ? "bg-primary hover:bg-primary/90 text-white" : ""}`}
            onClick={() => setViewMode("lista")}
            title="Vista lista"
          >
            <List className="size-4" />
          </Button>
          <Button
            variant={viewMode === "tarjetas" ? "default" : "ghost"}
            size="icon"
            className={`h-9 w-9 rounded-none border-0 ${viewMode === "tarjetas" ? "bg-primary hover:bg-primary/90 text-white" : ""}`}
            onClick={() => setViewMode("tarjetas")}
            title="Vista tarjetas"
          >
            <LayoutGrid className="size-4" />
          </Button>
        </div>
        <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={abrirCrear}>
          <UserPlus className="size-4 mr-1" />Nuevo
        </Button>
      </div>

      {/* Vista */}
      {loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : viewMode === "lista" ? (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="hidden sm:table-cell">Teléfono</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-32">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuariosFiltrados.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium text-sm">{u.first_name} {u.last_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{u.phone_number ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{ROLE_LABELS[u.role] ?? "?"}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={u.activo !== false ? "ok" : "secondary"}>
                      {u.activo !== false ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => setDetalleModal({ open: true, user: u })} title="Ver detalle">
                        <Eye className="size-3.5" />
                      </Button>
                      <Button size="icon" className="size-8 bg-primary hover:bg-primary/90 text-white border-0" onClick={() => abrirEditar(u)} title="Editar">
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => toggleEstado(u)} title={u.activo !== false ? "Deshabilitar" : "Habilitar"}>
                        {u.activo !== false ? <ShieldOff className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
                      </Button>
                      {/* Reenviar verificación: sólo si el email sigue sin verificar. */}
                      {u.email_verified === false && (
                        <Button
                          size="icon"
                          className="size-8 bg-muted text-foreground border hover:bg-accent"
                          onClick={() => reenviarVerificacion(u)}
                          disabled={reenviando === u.id}
                          title="Reenviar email de verificación"
                        >
                          <Mail className="size-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="destructive" className="size-8" onClick={() => eliminar(u)} title="Eliminar">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {usuariosFiltrados.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">Sin resultados</div>
          )}
        </div>
      ) : (
        /* Vista tarjetas */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {usuariosFiltrados.length === 0 && (
            <p className="col-span-full text-center py-12 text-sm text-muted-foreground">Sin resultados</p>
          )}
          {usuariosFiltrados.map(u => (
            <Card key={u.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
                      <span className="text-sm font-bold text-primary dark:text-purple-300">
                        {u.first_name.charAt(0).toUpperCase()}{u.last_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{u.first_name} {u.last_name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>
                  <Badge
                    variant={u.activo !== false ? "ok" : "secondary"}
                    className="shrink-0 text-[10px]"
                  >
                    {u.activo !== false ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="size-3 shrink-0" />
                  <Badge variant="outline" className="text-[10px] py-0 h-4">{ROLE_LABELS[u.role] ?? "?"}</Badge>
                </div>
                {u.phone_number && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="size-3 shrink-0" />
                    <span className="truncate">{u.phone_number}</span>
                  </div>
                )}
                {u.last_login && (
                  <p className="text-[10px] text-muted-foreground">
                    Último acceso: {new Date(u.last_login).toLocaleDateString("es-AR")}
                  </p>
                )}
                <div className="flex gap-1 pt-1 border-t">
                  <Button size="icon" className="size-8 flex-1 bg-muted text-foreground border hover:bg-accent" onClick={() => setDetalleModal({ open: true, user: u })} title="Ver detalle">
                    <Eye className="size-3.5" />
                  </Button>
                  <Button size="icon" className="size-8 flex-1 bg-primary hover:bg-primary/90 text-white border-0" onClick={() => abrirEditar(u)} title="Editar">
                    <Edit2 className="size-3.5" />
                  </Button>
                  <Button size="icon" className="size-8 flex-1 bg-muted text-foreground border hover:bg-accent" onClick={() => toggleEstado(u)} title={u.activo !== false ? "Deshabilitar" : "Habilitar"}>
                    {u.activo !== false ? <ShieldOff className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
                  </Button>
                  <Button size="icon" variant="destructive" className="size-8 flex-1" onClick={() => eliminar(u)} title="Eliminar">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      <Dialog open={modal.open} onOpenChange={open => setModal({ open, user: open ? modal.user : null })}>
        <DialogContent className="w-full max-w-2xl sm:max-w-2xl" showCloseButton={false}>
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="size-5 text-primary" />
              {modal.user ? "Editar usuario" : "Crear Usuario"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Nombre + Apellido */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                  <User className="size-3.5 text-muted-foreground" />NOMBRE
                </Label>
                <Input
                  placeholder="Ingrese el nombre"
                  value={form.first_name}
                  onChange={e => setForm({...form, first_name: e.target.value})}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                  <User className="size-3.5 text-muted-foreground" />APELLIDO
                </Label>
                <Input
                  placeholder="Ingrese el apellido"
                  value={form.last_name}
                  onChange={e => setForm({...form, last_name: e.target.value})}
                  className="h-11"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                <Mail className="size-3.5 text-muted-foreground" />CORREO ELECTRÓNICO
              </Label>
              <Input
                type="email"
                placeholder="usuario@ejemplo.com"
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">Se enviará un email de verificación a esta dirección.</p>
            </div>

            {/* Teléfono */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                <Phone className="size-3.5 text-muted-foreground" />TELÉFONO
              </Label>
              <Input
                placeholder="Ej: +1234567890"
                value={form.phone_number}
                onChange={e => setForm({...form, phone_number: e.target.value})}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">Formato: números, espacios, paréntesis, guiones y signo +</p>
            </div>

            {/* Rol */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                <Shield className="size-3.5 text-muted-foreground" />ROL
              </Label>
              <Select value={form.role} onValueChange={v => setForm({...form, role: v})}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Define los permisos y accesos del usuario en el sistema.</p>
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                <Lock className="size-3.5 text-muted-foreground" />
                {modal.user ? "NUEVA CONTRASEÑA" : "CONTRASEÑA TEMPORAL"}
              </Label>
              <Input
                type="password"
                placeholder={modal.user ? "Dejar vacío para no cambiar" : "Ingrese una contraseña segura temporal"}
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                {modal.user
                  ? "Solo complete este campo si desea cambiar la contraseña actual."
                  : "El usuario deberá cambiar esta contraseña en su primer inicio de sesión."}
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t gap-2">
            <Button
              variant="destructive"
              onClick={() => setModal({ open: false, user: null })}
              className="gap-1.5"
            >
              Cancelar
            </Button>
            <Button
              onClick={guardar}
              disabled={guardando}
              className="bg-primary hover:bg-primary/90 gap-1.5"
            >
              <UserPlus className="size-4" />
              {guardando ? "Guardando..." : modal.user ? "Guardar cambios" : "Crear Usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal detalle */}
      <Dialog open={detalleModal.open} onOpenChange={open => setDetalleModal({ open, user: open ? detalleModal.user : null })}>
        <DialogContent className="sm:max-w-lg" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="size-5" />
              Detalles del Usuario
            </DialogTitle>
          </DialogHeader>
          {detalleModal.user && (() => {
            const u = detalleModal.user
            const diasSistema = u.created_at
              ? Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400000)
              : null
            const fmtFecha = (d?: string) => d
              ? new Date(d).toLocaleString("es-AR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
              : "—"
            const fmtCorta = (d?: string) => d
              ? new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
              : "—"
            return (
              <div className="space-y-5 text-sm">
                {/* Información General */}
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Info className="size-4 text-primary" />
                    <span className="text-primary font-semibold text-xs uppercase tracking-wide">Información General</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                    <div>
                      <p className="text-muted-foreground text-xs">ID</p>
                      <p className="font-medium">{u.id}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Rol</p>
                      <Badge variant="outline" className="mt-0.5 text-xs font-bold uppercase">
                        {ROLE_LABELS[u.role]}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Nombre completo</p>
                      <p className="font-medium">{u.first_name} {u.last_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Estado</p>
                      <Badge variant={u.activo !== false ? "ok" : "risk"} className="mt-0.5 text-xs font-bold uppercase">
                        {u.activo !== false ? "Habilitado" : "Deshabilitado"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Email</p>
                      <p className="font-medium">{u.email}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Email verificado</p>
                      {u.email_verified !== undefined ? (
                        <Badge variant={u.email_verified ? "ok" : "risk"} className="mt-0.5">
                          {u.email_verified ? "✓ Verificado" : "✗ No verificado"}
                        </Badge>
                      ) : <p className="text-muted-foreground">—</p>}
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Teléfono</p>
                      <p className="font-medium">{u.phone_number ?? "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Fechas */}
                {(u.created_at || u.updated_at || u.last_login) && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <Calendar className="size-4 text-primary" />
                      <span className="text-primary font-semibold text-xs uppercase tracking-wide">Fechas Importantes</span>
                    </div>
                    <div className="rounded-xl bg-muted/40 border p-3 space-y-2">
                      {u.created_at && (
                        <div>
                          <p className="font-semibold text-xs">Fecha de creación:</p>
                          <p className="text-muted-foreground text-xs">{fmtFecha(u.created_at)}</p>
                        </div>
                      )}
                      {u.updated_at && (
                        <div>
                          <p className="font-semibold text-xs">Última actualización:</p>
                          <p className="text-muted-foreground text-xs">{fmtFecha(u.updated_at)}</p>
                        </div>
                      )}
                      {u.last_login && (
                        <div>
                          <p className="font-semibold text-xs">Último login:</p>
                          <p className="text-muted-foreground text-xs">{fmtFecha(u.last_login)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Estadísticas */}
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <BarChart2 className="size-4 text-primary" />
                    <span className="text-primary font-semibold text-xs uppercase tracking-wide">Estadísticas</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-muted/40 border p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{diasSistema ?? "—"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Días en el sistema</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 border p-3 flex flex-col items-center justify-center gap-1">
                      <CheckCircle className={`size-6 ${u.email_verified !== false ? "text-state-ok-text" : "text-muted-foreground"}`} />
                      <p className="text-xs text-muted-foreground text-center">Email verificado</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 border p-3 flex flex-col items-center justify-center gap-1">
                      <span className={`inline-block size-3 rounded-full ${u.activo !== false ? "bg-state-ok" : "bg-state-risk"}`} />
                      <p className="text-xs text-muted-foreground text-center">Estado actual</p>
                    </div>
                  </div>
                </div>

                {/* Footer info + botones */}
                <div className="flex items-center justify-between pt-1 border-t gap-2 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    Usuario ID: {u.id}{u.created_at ? ` | Creado: ${fmtCorta(u.created_at)}` : ""}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      className="h-9 gap-1.5"
                      onClick={() => setDetalleModal({ open: false, user: null })}
                    >
                      <Ban className="size-4" />Cerrar
                    </Button>
                    <Button
                      className="bg-muted text-foreground border hover:bg-accent h-9 gap-1.5"
                      onClick={() => { setDetalleModal({ open: false, user: null }); setModal({ open: true, user: u }) }}
                    >
                      <Edit2 className="size-4" />Editar
                    </Button>
                  </div>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal confirmar deshabilitar/habilitar */}
      <Dialog open={confirmToggleModal.open} onOpenChange={open => setConfirmToggleModal({ open, user: open ? confirmToggleModal.user : null })}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          {confirmToggleModal.user && (() => {
            const deshabilitar = confirmToggleModal.user.activo !== false
            return (
              <>
                <DialogHeader className="pb-2">
                  <DialogTitle className={`flex items-center gap-2 text-lg ${deshabilitar ? "text-state-risk-text" : "text-state-ok-text"}`}>
                    {deshabilitar
                      ? <Ban className="size-5" />
                      : <CheckCircle className="size-5" />
                    }
                    {deshabilitar ? "Deshabilitar Usuario" : "Habilitar Usuario"}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-1">
                  <p className="text-sm text-foreground">
                    ¿Estás seguro de que quieres {deshabilitar ? "deshabilitar" : "habilitar"} a{" "}
                    <strong>{confirmToggleModal.user.first_name} {confirmToggleModal.user.last_name}</strong>?
                  </p>

                  <div className="rounded-lg p-3 text-sm flex gap-2 bg-muted text-muted-foreground border">
                    <span className="mt-0.5 shrink-0 text-base">ℹ️</span>
                    <div>
                      <p className="font-semibold mb-0.5">Información:</p>
                      {deshabilitar
                        ? "El usuario no podrá iniciar sesión, pero sus datos y registros se conservarán. Podrás habilitarlo nuevamente en cualquier momento."
                        : "El usuario podrá volver a iniciar sesión con sus credenciales existentes."
                      }
                    </div>
                  </div>
                </div>

                <DialogFooter className="gap-2 pt-2">
                  <Button onClick={confirmarToggle} className="gap-1.5">
                    {deshabilitar ? <Ban className="size-4" /> : <CheckCircle className="size-4" />}
                    {deshabilitar ? "Deshabilitar" : "Habilitar"}
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmToggleModal({ open: false, user: null })}>
                    Cancelar
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal confirmar eliminar */}
      <Dialog open={confirmEliminarModal.open} onOpenChange={open => {
        setConfirmEliminarModal({ open, user: open ? confirmEliminarModal.user : null })
        if (!open) setTextoEliminar("")
      }}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          {confirmEliminarModal.user && (
            <>
              <DialogHeader className="pb-2 text-center">
                <DialogTitle className="text-lg font-bold">¿Eliminar Usuario?</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-1">
                {/* Datos del usuario */}
                <div className="text-sm">
                  <p className="font-semibold mb-1.5 flex items-center gap-1.5">📋 Usuario a eliminar:</p>
                  <ul className="space-y-0.5 pl-4 list-disc text-foreground">
                    <li><strong>Nombre:</strong> {confirmEliminarModal.user.first_name} {confirmEliminarModal.user.last_name}</li>
                    <li><strong>Email:</strong> {confirmEliminarModal.user.email}</li>
                    <li><strong>Rol:</strong> {ROLE_LABELS[confirmEliminarModal.user.role] ?? "—"}</li>
                  </ul>
                </div>

                {/* Advertencia */}
                <div className="rounded-lg p-3 text-sm bg-state-warn-soft border border-state-warn/30 text-state-warn-text flex gap-2">
                  <span className="mt-0.5 shrink-0">⚠️</span>
                  <div>
                    <p className="font-semibold mb-0.5">Advertencia:</p>
                    Esta acción eliminará permanentemente al usuario y no se puede deshacer. Si el usuario tiene prospectos o pólizas asociadas, no podrá ser eliminado.
                  </div>
                </div>

                {/* Input confirmación */}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">
                    Para confirmar, escribe: <span className="text-primary font-bold">ELIMINAR</span>
                  </p>
                  <Input
                    placeholder="Escribe ELIMINAR para confirmar"
                    value={textoEliminar}
                    onChange={e => setTextoEliminar(e.target.value)}
                    className="border-primary/40 focus-visible:ring-primary/40"
                  />
                </div>
              </div>

              <DialogFooter className="flex-col gap-2 pt-2 sm:flex-col">
                <Button
                  variant="destructive"
                  onClick={confirmarEliminar}
                  disabled={textoEliminar !== "ELIMINAR"}
                  className="w-full gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                  Eliminar Usuario
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-1.5"
                  onClick={() => {
                    setConfirmEliminarModal({ open: false, user: null })
                    setTextoEliminar("")
                  }}
                >
                  Cancelar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
      </TabsContent>
    </Tabs>
  )
}
