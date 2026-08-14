import { useState, useEffect, useCallback, useMemo } from "react"
import { useConfirm } from "@/components/common/confirm-dialog"
import axios from "axios"
import { toast } from "sonner"
import { Plus, RefreshCw, Search, Edit2, Trash2, Eye, ToggleLeft, ToggleRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Prestador {
  id: number
  nombre: string
  especialidad?: string
  telefono?: string
  email?: string
  direccion?: string
  localidad?: string
  provincia?: string
  codigo_postal?: string
  matricula?: string
  tipo_prestador: string
  estado: boolean
  observaciones?: string
}

const TIPOS = ["medico", "clinica", "laboratorio", "farmacia", "otro"]

const emptyForm: Omit<Prestador, "id"> = {
  nombre: "", especialidad: "", telefono: "", email: "", direccion: "",
  localidad: "", provincia: "", codigo_postal: "", matricula: "",
  tipo_prestador: "medico", estado: true, observaciones: ""
}

export default function PrestadoresAdmin() {
  const confirm = useConfirm()
  const [prestadores, setPrestadores] = useState<Prestador[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [filtroTipo, setFiltroTipo] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("")
  const [filtroLocalidad, setFiltroLocalidad] = useState("")
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<Omit<Prestador, "id"> & { id?: number }>(emptyForm)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const [detalleModal, setDetalleModal] = useState<Prestador | null>(null)

  const authHeaders = { Authorization: `Bearer ${getAuthToken()}` }

  const fetchPrestadores = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API_URL}/admin/prestadores`, { headers: authHeaders })
      setPrestadores(data?.data ?? data ?? [])
    } catch { toast.error("Error al cargar prestadores") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchPrestadores() }, [fetchPrestadores])

  const localidades = useMemo(() => Array.from(new Set(prestadores.map(p => p.localidad).filter(Boolean))).sort(), [prestadores])

  const filtrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase()
    return prestadores.filter(p => {
      if (filtroTipo && p.tipo_prestador !== filtroTipo) return false
      if (filtroEstado === "activo" && !p.estado) return false
      if (filtroEstado === "inactivo" && p.estado) return false
      if (filtroLocalidad && p.localidad !== filtroLocalidad) return false
      if (term && !p.nombre?.toLowerCase().includes(term) && !p.especialidad?.toLowerCase().includes(term) && !p.matricula?.toLowerCase().includes(term)) return false
      return true
    })
  }, [prestadores, busqueda, filtroTipo, filtroEstado, filtroLocalidad])

  const abrirCrear = () => { setError(""); setForm(emptyForm); setModal(true) }
  const abrirEditar = (p: Prestador) => { setError(""); setForm({ ...p }); setModal(true) }

  const validar = () => {
    if (!form.nombre.trim()) return "El nombre es obligatorio"
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Email inválido"
    return ""
  }

  const guardar = async () => {
    const err = validar()
    if (err) { setError(err); return }
    setGuardando(true); setError("")
    try {
      const payload = { ...form }
      if (form.id) {
        await axios.put(`${API_URL}/admin/prestadores/${form.id}`, payload, { headers: authHeaders })
        toast.success("Prestador actualizado")
      } else {
        await axios.post(`${API_URL}/admin/prestadores`, payload, { headers: authHeaders })
        toast.success("Prestador creado")
      }
      setModal(false)
      fetchPrestadores()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Error al guardar")
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (p: Prestador) => {
    const ok = await confirm({
      title: `¿Eliminar "${p.nombre}"?`,
      description: "Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      destructive: true,
    })
    if (!ok) return
    try {
      await axios.delete(`${API_URL}/admin/prestadores/${p.id}`, { headers: authHeaders })
      toast.success("Prestador eliminado")
      fetchPrestadores()
    } catch { toast.error("Error al eliminar") }
  }

  const toggleEstado = async (p: Prestador) => {
    try {
      await axios.put(`${API_URL}/admin/prestadores/${p.id}/estado`, { estado: !p.estado }, { headers: authHeaders })
      toast.success(`Prestador ${!p.estado ? "activado" : "desactivado"}`)
      fetchPrestadores()
    } catch { toast.error("Error al cambiar estado") }
  }

  const setF = (k: keyof typeof emptyForm, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nombre, especialidad..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <Button variant="outline" size="icon" onClick={fetchPrestadores} disabled={loading}><RefreshCw className="size-4" /></Button>
        <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={abrirCrear}>
          <Plus className="size-4 mr-1" />Nuevo
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <Select value={filtroTipo || "all"} onValueChange={v => setFiltroTipo(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {TIPOS.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroEstado || "all"} onValueChange={v => setFiltroEstado(v === "all" ? "" : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="activo">Activo</SelectItem>
            <SelectItem value="inactivo">Inactivo</SelectItem>
          </SelectContent>
        </Select>
        {localidades.length > 0 && (
          <Select value={filtroLocalidad || "all"} onValueChange={v => setFiltroLocalidad(v === "all" ? "" : v)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Localidad" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las localidades</SelectItem>
              {localidades.map(l => <SelectItem key={l} value={l!}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <span className="text-xs text-muted-foreground self-center">{filtrados.length} registros</span>
      </div>

      {/* Tabla */}
      {loading ? <Skeleton className="h-64 w-full rounded-xl" /> : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden sm:table-cell">Especialidad</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Localidad</TableHead>
                <TableHead className="hidden md:table-cell">Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-20">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm font-medium">{p.nombre}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{p.especialidad ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">{p.tipo_prestador}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{p.localidad ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{p.telefono ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={p.estado ? "ok" : "secondary"} className="text-xs">
                      {p.estado ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => setDetalleModal(p)} title="Ver detalle"><Eye className="size-3.5" /></Button>
                      <Button size="icon" className="size-8 bg-primary hover:bg-primary/90 text-white border-0" onClick={() => abrirEditar(p)} title="Editar"><Edit2 className="size-3.5" /></Button>
                      <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => toggleEstado(p)} title={p.estado ? "Desactivar" : "Activar"}>
                        {p.estado ? <ToggleRight className="size-3.5" /> : <ToggleLeft className="size-3.5" />}
                      </Button>
                      <Button size="icon" variant="destructive" className="size-8" onClick={() => eliminar(p)} title="Eliminar"><Trash2 className="size-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtrados.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Sin prestadores</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal */}
      {/* Modal detalle prestador */}
      <Dialog open={!!detalleModal} onOpenChange={open => { if (!open) setDetalleModal(null) }}>
        <DialogContent className="sm:max-w-lg" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="size-4" /> {detalleModal?.nombre}</DialogTitle>
          </DialogHeader>
          {detalleModal && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Tipo", detalleModal.tipo_prestador],
                ["Especialidad", detalleModal.especialidad],
                ["Matrícula", detalleModal.matricula],
                ["Teléfono", detalleModal.telefono],
                ["Email", detalleModal.email],
                ["Localidad", detalleModal.localidad],
                ["Provincia", detalleModal.provincia],
                ["Código postal", detalleModal.codigo_postal],
                ["Dirección", detalleModal.direccion],
                ["Estado", detalleModal.estado ? "Activo" : "Inactivo"],
              ].map(([label, value]) => value ? (
                <div key={label as string} className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-medium capitalize">{value as string}</p>
                </div>
              ) : null)}
              {detalleModal.observaciones && (
                <div className="col-span-2 space-y-0.5">
                  <p className="text-xs text-muted-foreground">Observaciones</p>
                  <p className="text-sm">{detalleModal.observaciones}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="destructive" onClick={() => setDetalleModal(null)}>Cerrar</Button>
            <Button onClick={() => { if (detalleModal) { abrirEditar(detalleModal); setDetalleModal(null) } }} className="bg-primary hover:bg-primary/90">Editar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modal} onOpenChange={open => { setModal(open); if (!open) setError("") }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar prestador" : "Nuevo prestador"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={e => setF("nombre", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Tipo de prestador</Label>
              <Select value={form.tipo_prestador} onValueChange={v => setF("tipo_prestador", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Especialidad</Label>
              <Input value={form.especialidad} onChange={e => setF("especialidad", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={e => setF("telefono", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setF("email", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Matrícula</Label>
              <Input value={form.matricula} onChange={e => setF("matricula", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Provincia</Label>
              <Input value={form.provincia} onChange={e => setF("provincia", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Localidad</Label>
              <Input value={form.localidad} onChange={e => setF("localidad", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Código postal</Label>
              <Input value={form.codigo_postal} onChange={e => setF("codigo_postal", e.target.value)} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Dirección</Label>
              <Input value={form.direccion} onChange={e => setF("direccion", e.target.value)} />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label>Observaciones</Label>
              <Textarea rows={2} value={form.observaciones} onChange={e => setF("observaciones", e.target.value)} />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <Checkbox id="estadoCheck" checked={form.estado} onCheckedChange={v => setF("estado", !!v)} />
              <label htmlFor="estadoCheck" className="text-sm cursor-pointer">Activo</label>
            </div>
            {error && <p className="sm:col-span-2 text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando} className="bg-primary hover:bg-primary/90">{guardando ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
