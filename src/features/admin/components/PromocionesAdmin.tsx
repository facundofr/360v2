import { useState, useEffect, useCallback, useMemo } from "react"
import { useConfirm } from "@/components/common/confirm-dialog"
import axios from "axios"
import { toast } from "sonner"
import { Plus, RefreshCw, Search, Edit2, Trash2, ToggleLeft, ToggleRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Promocion {
  id: number
  nombre: string
  descripcion: string
  descuento_porcentaje: number
  activa: boolean
  created_at?: string
  updated_at?: string
}

const initialForm = { id: null as number | null, nombre: "", descripcion: "", descuento_porcentaje: 0, activa: true }

const formatFecha = (f?: string) => {
  if (!f) return "—"
  try { return new Date(f).toLocaleString("es-AR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) }
  catch { return f }
}

export default function PromocionesAdmin() {
  const confirm = useConfirm()
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [soloActivas, setSoloActivas] = useState(false)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  const authHeaders = { Authorization: `Bearer ${getAuthToken()}` }

  const fetchPromociones = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API_URL}/admin/promociones`, { headers: authHeaders })
      setPromociones(data ?? [])
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Error al cargar promociones")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPromociones() }, [fetchPromociones])

  const filtradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase()
    return promociones
      .filter(p => !soloActivas || p.activa)
      .filter(p => !term || p.nombre?.toLowerCase().includes(term) || p.descripcion?.toLowerCase().includes(term) || String(p.descuento_porcentaje).includes(term))
      .sort((a, b) => b.id - a.id)
  }, [promociones, busqueda, soloActivas])

  const abrirModal = (promo?: Partial<Promocion>) => {
    setError("")
    setForm({ id: promo?.id ?? null, nombre: promo?.nombre ?? "", descripcion: promo?.descripcion ?? "", descuento_porcentaje: promo?.descuento_porcentaje ?? 0, activa: promo?.activa ?? true })
    setModal(true)
  }

  const validar = () => {
    if (!form.nombre.trim()) return "El nombre es obligatorio"
    if (!form.descripcion.trim()) return "La descripción es obligatoria"
    const d = Number(form.descuento_porcentaje)
    if (isNaN(d) || d < 0 || d > 100) return "El descuento debe estar entre 0% y 100%"
    return ""
  }

  const guardar = async () => {
    const err = validar()
    if (err) { setError(err); return }
    setGuardando(true); setError("")
    try {
      const payload = { nombre: form.nombre.trim(), descripcion: form.descripcion.trim(), descuento_porcentaje: Number(form.descuento_porcentaje), activa: form.activa }
      if (form.id) {
        await axios.put(`${API_URL}/admin/promociones/${form.id}`, payload, { headers: authHeaders })
        toast.success("Promoción actualizada")
      } else {
        await axios.post(`${API_URL}/admin/promociones`, payload, { headers: authHeaders })
        toast.success("Promoción creada")
      }
      setModal(false)
      fetchPromociones()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Error al guardar")
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (promo: Promocion) => {
    const ok = await confirm({
      title: `¿Eliminar la promoción "${promo.nombre}"?`,
      description: "Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      destructive: true,
    })
    if (!ok) return
    try {
      await axios.delete(`${API_URL}/admin/promociones/${promo.id}`, { headers: authHeaders })
      toast.success("Promoción eliminada")
      fetchPromociones()
    } catch {
      toast.error("Error al eliminar promoción")
    }
  }

  const toggleActiva = async (promo: Promocion) => {
    try {
      await axios.put(`${API_URL}/admin/promociones/${promo.id}`, { ...promo, activa: !promo.activa }, { headers: authHeaders })
      fetchPromociones()
    } catch {
      toast.error("Error al cambiar estado")
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar promoción..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="soloActivas" checked={soloActivas} onCheckedChange={v => setSoloActivas(!!v)} />
          <label htmlFor="soloActivas" className="text-sm cursor-pointer">Solo activas</label>
        </div>
        <Button variant="outline" size="icon" onClick={fetchPromociones} disabled={loading}><RefreshCw className="size-4" /></Button>
        <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => abrirModal()}>
          <Plus className="size-4 mr-1" />Nueva
        </Button>
      </div>

      {/* Tabla */}
      {loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden sm:table-cell">Descripción</TableHead>
                <TableHead>Descuento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden md:table-cell">Última actualización</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-sm">{p.nombre}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground max-w-48 truncate">{p.descripcion}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">{p.descuento_porcentaje}%</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.activa ? "ok" : "secondary"}>
                      {p.activa ? "Activa" : "Inactiva"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{formatFecha(p.updated_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" className="size-8 bg-primary hover:bg-primary/90 text-white border-0" onClick={() => abrirModal(p)} title="Editar"><Edit2 className="size-3.5" /></Button>
                      <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => toggleActiva(p)} title={p.activa ? "Desactivar" : "Activar"}>
                        {p.activa ? <ToggleRight className="size-3.5" /> : <ToggleLeft className="size-3.5" />}
                      </Button>
                      <Button size="icon" variant="destructive" className="size-8" onClick={() => eliminar(p)} title="Eliminar"><Trash2 className="size-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtradas.length === 0 && <div className="text-center py-12 text-sm text-muted-foreground">Sin promociones</div>}
        </div>
      )}

      {/* Modal */}
      <Dialog open={modal} onOpenChange={open => { setModal(open); if (!open) setError("") }}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar promoción" : "Nueva promoción"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Descripción *</Label>
              <Textarea rows={2} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Descuento (%) *</Label>
              <Input type="number" min="0" max="100" step="0.01" value={form.descuento_porcentaje} onChange={e => setForm(f => ({ ...f, descuento_porcentaje: Number(e.target.value) }))} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="activaCheck" checked={form.activa} onCheckedChange={v => setForm(f => ({ ...f, activa: !!v }))} />
              <label htmlFor="activaCheck" className="text-sm cursor-pointer">Activa</label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
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
