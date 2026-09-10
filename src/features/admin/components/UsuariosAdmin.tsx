import { useState, useEffect, useCallback, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios"
import { toast } from "sonner"
import {
  Users, UserCheck, UserX, UserPlus, RefreshCw, Search,
  Edit2, Trash2, Eye, ShieldOff, ShieldCheck,
  Mail, Phone, User, Lock, Shield, Ban, CheckCircle,
  LayoutGrid, List, Wifi, Info, Calendar, BarChart2
,
  Check, X, ClipboardList, AlertTriangle
} from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "@/components/ui/data-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { API_URL } from "@/lib/config"
import ActiveUsersMonitor from "./ActiveUsersMonitor"
import { getAuthToken } from "@/lib/auth"
import { usuarioSchema, type UsuarioValues } from "@/features/admin/schemas"

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
  /** 0|1 desde MySQL — sin `typeCast` configurado, mysql2 NO lo devuelve como boolean. */
  is_enabled?: number
  created_at?: string
  updated_at?: string
  last_login?: string
  /** 0|1 desde MySQL, mismo motivo que `is_enabled`. */
  verified?: number
}

const ROLE_LABELS: Record<number, string> = { 1: "Vendedor", 2: "Supervisor", 3: "Administrador", 4: "Backoffice" }

const valoresVacios: UsuarioValues = {
  first_name: "", last_name: "", email: "", phone_number: "", role: "1", password: "", esNuevo: true,
}

export default function UsuariosAdmin() {
  const [users, setUsers] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [filtroRol, setFiltroRol] = useState("todos")
  const [filtroEstado, setFiltroEstado] = useState("todos")
  const [modal, setModal] = useState<{ open: boolean; user: Usuario | null }>({ open: false, user: null })
  const form = useForm<UsuarioValues>({ resolver: zodResolver(usuarioSchema), defaultValues: valoresVacios })
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
    if (filtroEstado === "activo" && u.is_enabled === 0) return false
    if (filtroEstado === "inactivo" && u.is_enabled !== 0) return false
    return true
  })

  const abrirCrear = () => {
    form.reset(valoresVacios)
    setModal({ open: true, user: null })
  }

  const abrirEditar = (u: Usuario) => {
    form.reset({ first_name: u.first_name, last_name: u.last_name, email: u.email, phone_number: u.phone_number ?? "", role: String(u.role), password: "", esNuevo: false })
    setModal({ open: true, user: u })
  }

  const guardar = async (values: UsuarioValues) => {
    setGuardando(true)
    try {
      if (modal.user) {
        const data = {
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email,
          phone_number: values.phone_number,
          role: values.role,
        }
        await axios.put(`${API_URL}/admin/update-user/${modal.user.id}`, data, { headers: authHeaders })
        toast.success("Usuario actualizado")
      } else {
        const data = {
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email,
          phone_number: values.phone_number,
          role: values.role,
          password: values.password,
        }
        await axios.post(`${API_URL}/admin/create-user`, data, { headers: authHeaders })
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
    const endpoint = u.is_enabled !== 0 ? "disable-user" : "enable-user"
    const accion = u.is_enabled !== 0 ? "deshabilitado" : "habilitado"
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

  const columns = useMemo<ColumnDef<Usuario>[]>(() => [
    {
      id: "nombre",
      header: "Nombre",
      accessorFn: (u) => `${u.first_name} ${u.last_name}`,
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.first_name} {row.original.last_name}</span>,
    },
    { accessorKey: "email", header: "Email", meta: { className: "text-sm text-muted-foreground" } },
    {
      accessorKey: "phone_number",
      header: "Teléfono",
      meta: { className: "hidden sm:table-cell text-sm text-muted-foreground" },
      cell: ({ row }) => row.original.phone_number ?? "—",
    },
    {
      id: "rol",
      header: "Rol",
      accessorFn: (u) => ROLE_LABELS[u.role] ?? String(u.role),
      cell: ({ row }) => <Badge variant="outline">{ROLE_LABELS[row.original.role] ?? "?"}</Badge>,
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (u) => u.is_enabled !== 0 ? "Activo" : "Inactivo",
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
      meta: { className: "w-40" },
      cell: ({ row }) => {
        const u = row.original
        return (
          <div className="flex gap-1">
            <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => setDetalleModal({ open: true, user: u })} title="Ver detalle">
              <Eye className="size-3.5" />
            </Button>
            <Button size="icon" className="size-8 bg-primary hover:bg-primary/90 text-white border-0" onClick={() => abrirEditar(u)} title="Editar">
              <Edit2 className="size-3.5" />
            </Button>
            <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => toggleEstado(u)} title={u.is_enabled !== 0 ? "Deshabilitar" : "Habilitar"}>
              {u.is_enabled !== 0 ? <ShieldOff className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
            </Button>
            {/* Reenviar verificación: sólo si el email sigue sin verificar. */}
            {u.verified === 0 && (
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
        )
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [reenviando])

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
          <Badge variant="ok" size="sm" className="ml-1 px-1">Tiempo real</Badge>
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
          <p className="text-2xl font-bold text-foreground">{users.filter(u => u.is_enabled !== 0).length}</p>
          <p className="text-xs text-muted-foreground">Activos</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <UserX className="size-4 mx-auto mb-1 text-state-risk-text" />
          <p className="text-2xl font-bold text-foreground">{users.filter(u => u.is_enabled === 0).length}</p>
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
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : viewMode === "lista" ? (
        <DataTable columns={columns} data={usuariosFiltrados} emptyMessage="Sin resultados" />
      ) : (
        /* Registro de usuarios: una fila por persona, no una tarjeta por persona. */
        <div className="reg reg--user border-t-2 border-rule-heavy">
          <div className="reg-row reg-head" role="presentation">
            <span>Usuario</span>
            <span>Rol</span>
            <span>Teléfono</span>
            <span>Último acceso</span>
            <span>Estado</span>
            <span />
          </div>

          {usuariosFiltrados.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">Sin resultados</p>
          )}

          {usuariosFiltrados.map(u => (
            <div key={u.id} className="reg-row reg-entry">
              {/* 1 · usuario — el eje */}
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-stamp bg-primary/10 text-[11px] font-bold text-primary dark:bg-primary/25 dark:text-purple-300"
                >
                  {u.first_name.charAt(0).toUpperCase()}{u.last_name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">{u.first_name} {u.last_name}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">{u.email}</span>
                </span>
              </span>

              {/* 2 · rol */}
              <span className="min-w-0">
                <Badge variant="outline" size="sm" className="pointer-events-none">
                  <Shield aria-hidden="true" />{ROLE_LABELS[u.role] ?? "?"}
                </Badge>
              </span>

              {/* 3 · teléfono */}
              <span className="truncate text-[12.5px] tabular-nums text-muted-foreground">
                {u.phone_number || "—"}
              </span>

              {/* 4 · último acceso */}
              <span className="truncate text-[12px] tabular-nums text-muted-foreground">
                {u.last_login ? new Date(u.last_login).toLocaleDateString("es-AR") : "—"}
              </span>

              {/* 5 · estado */}
              <span className="min-w-0">
                <Badge variant={u.is_enabled !== 0 ? "ok" : "secondary"} size="sm" className="pointer-events-none">
                  {u.is_enabled !== 0 ? "Activo" : "Inactivo"}
                </Badge>
              </span>

              {/* 6 · acciones */}
              <span className="reg-actions">
                <Button size="icon" variant="ghost" className="size-7" title="Ver detalle" onClick={() => setDetalleModal({ open: true, user: u })}>
                  <Eye className="size-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="size-7" title="Editar" onClick={() => abrirEditar(u)}>
                  <Edit2 className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  title={u.is_enabled !== 0 ? "Deshabilitar" : "Habilitar"}
                  onClick={() => toggleEstado(u)}
                >
                  {u.is_enabled !== 0 ? <ShieldOff className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
                </Button>
                <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive" title="Eliminar" onClick={() => eliminar(u)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </span>
            </div>
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

          <Form {...form}>
            <form onSubmit={form.handleSubmit(guardar)}>
              <div className="space-y-5 py-2">
                {/* Nombre + Apellido */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="first_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                        <User className="size-3.5 text-muted-foreground" />NOMBRE
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Ingrese el nombre" className="h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="last_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                        <User className="size-3.5 text-muted-foreground" />APELLIDO
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Ingrese el apellido" className="h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Email */}
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                      <Mail className="size-3.5 text-muted-foreground" />CORREO ELECTRÓNICO
                    </FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="usuario@ejemplo.com" className="h-11" {...field} />
                    </FormControl>
                    <FormDescription>Se enviará un email de verificación a esta dirección.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Teléfono */}
                <FormField control={form.control} name="phone_number" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                      <Phone className="size-3.5 text-muted-foreground" />TELÉFONO
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: +1234567890" className="h-11" {...field} />
                    </FormControl>
                    <FormDescription>Formato: números, espacios, paréntesis, guiones y signo +</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Rol */}
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                      <Shield className="size-3.5 text-muted-foreground" />ROL
                    </FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription>Define los permisos y accesos del usuario en el sistema.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Contraseña */}
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                      <Lock className="size-3.5 text-muted-foreground" />
                      {modal.user ? "NUEVA CONTRASEÑA" : "CONTRASEÑA TEMPORAL"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={modal.user ? "Dejar vacío para no cambiar" : "Ingrese una contraseña segura temporal"}
                        className="h-11"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {modal.user
                        ? "Solo complete este campo si desea cambiar la contraseña actual."
                        : "El usuario deberá cambiar esta contraseña en su primer inicio de sesión."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <DialogFooter className="pt-2 border-t gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setModal({ open: false, user: null })}
                  className="gap-1.5"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={guardando}
                  className="bg-primary hover:bg-primary/90 gap-1.5"
                >
                  <UserPlus className="size-4" />
                  {guardando ? "Guardando..." : modal.user ? "Guardar cambios" : "Crear Usuario"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
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
                      <Badge variant={u.is_enabled !== 0 ? "ok" : "risk"} className="mt-0.5 text-xs font-bold uppercase">
                        {u.is_enabled !== 0 ? "Habilitado" : "Deshabilitado"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Email</p>
                      <p className="font-medium">{u.email}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Email verificado</p>
                      {u.verified !== undefined ? (
                        <Badge variant={u.verified ? "ok" : "risk"} className="mt-0.5">
                          {u.verified ? <><Check className="mr-1 inline size-3 align-[-1px]" aria-hidden="true" />Verificado</> : <><X className="mr-1 inline size-3 align-[-1px]" aria-hidden="true" />No verificado</>}
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
                    <div className="rounded-lg bg-muted/40 border p-3 space-y-2">
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
                    <div className="rounded-lg bg-muted/40 border p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{diasSistema ?? "—"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Días en el sistema</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 border p-3 flex flex-col items-center justify-center gap-1">
                      <CheckCircle className={`size-6 ${u.verified !== 0 ? "text-state-ok-text" : "text-muted-foreground"}`} />
                      <p className="text-xs text-muted-foreground text-center">Email verificado</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 border p-3 flex flex-col items-center justify-center gap-1">
                      <span className={`inline-block size-3 rounded-full ${u.is_enabled !== 0 ? "bg-state-ok" : "bg-state-risk"}`} />
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
            const deshabilitar = confirmToggleModal.user.is_enabled !== 0
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
                  <p className="mb-1.5 flex items-center gap-1.5 font-semibold"><ClipboardList className="size-3.5 shrink-0" aria-hidden="true" />Usuario a eliminar:</p>
                  <ul className="space-y-0.5 pl-4 list-disc text-foreground">
                    <li><strong>Nombre:</strong> {confirmEliminarModal.user.first_name} {confirmEliminarModal.user.last_name}</li>
                    <li><strong>Email:</strong> {confirmEliminarModal.user.email}</li>
                    <li><strong>Rol:</strong> {ROLE_LABELS[confirmEliminarModal.user.role] ?? "—"}</li>
                  </ul>
                </div>

                {/* Advertencia */}
                <div className="rounded-lg p-3 text-sm bg-state-warn-soft border border-state-warn/30 text-state-warn-text flex gap-2">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
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
