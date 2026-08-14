import { useState, useEffect, useCallback } from "react"
import axios from "axios"
import { toast } from "sonner"
import { useConfirm } from "@/components/common/confirm-dialog"
import { Plus, RefreshCw, Edit2, Trash2, RotateCcw, Tag, Users, BarChart2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Categoria {
  id: number
  nombre: string
  descripcion?: string
  capacidad_maxima?: number
  prioridad?: number
  activa: boolean | number
  total_vendedores?: number
  vendedores_activos?: number
}

interface EstadisticasCategorias {
  total_categorias?: number
  categorias_activas?: number
  vendedores_asignados?: number
  vendedores_sin_categoria?: number
  prospectos_distribuidos?: number
  promedio_prospectos_por_vendedor?: number
}

interface CargaVendedor {
  vendedor_id: number
  nombre: string
  categoria_nombre?: string
  total_prospectos?: number
  capacidad_maxima?: number
}

const emptyForm = {
  nombre: "",
  descripcion: "",
  capacidad_maxima: 50,
  prioridad: 1,
  activa: true,
}

const getHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` })

export default function GestionCategorias() {
  const confirm = useConfirm()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cargaVendedores, setCargaVendedores] = useState<CargaVendedor[]>([])
  const [estadisticas, setEstadisticas] = useState<EstadisticasCategorias | null>(null)
  const [vendedores, setVendedores] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [catRes, cargaRes, statsRes, vendRes] = await Promise.all([
        axios.get(`${API_URL}/admin/categorias`, { headers: getHeaders() }),
        axios.get(`${API_URL}/admin/categorias/carga-vendedores`, { headers: getHeaders() }).catch(() => ({ data: [] })),
        // Estadísticas agregadas por categoría (paridad con prod).
        axios.get(`${API_URL}/admin/categorias/estadisticas`, { headers: getHeaders() }).catch(() => ({ data: null })),
        axios.get(`${API_URL}/supervisor/vendedores`, { headers: getHeaders() }).catch(() => ({ data: [] })),
      ])
      setCategorias(catRes.data?.data ?? catRes.data ?? [])
      setCargaVendedores(cargaRes.data?.data ?? cargaRes.data ?? [])
      setEstadisticas(statsRes.data?.data ?? statsRes.data ?? null)
      setVendedores(vendRes.data?.data ?? vendRes.data ?? [])
    } catch {
      toast.error("Error al cargar categorías")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const abrirCrear = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError("")
    setModal(true)
  }

  const abrirEditar = (c: Categoria) => {
    setEditingId(c.id)
    setForm({
      nombre: c.nombre,
      descripcion: c.descripcion ?? "",
      capacidad_maxima: c.capacidad_maxima ?? 50,
      prioridad: c.prioridad ?? 1,
      activa: c.activa === true || c.activa === 1,
    })
    setError("")
    setModal(true)
  }

  const guardar = async () => {
    if (!form.nombre.trim()) { setError("El nombre es obligatorio"); return }
    setGuardando(true); setError("")
    try {
      if (editingId) {
        await axios.put(`${API_URL}/admin/categorias/${editingId}`, form, { headers: getHeaders() })
        toast.success("Categoría actualizada")
      } else {
        await axios.post(`${API_URL}/admin/categorias`, form, { headers: getHeaders() })
        toast.success("Categoría creada")
      }
      setModal(false)
      fetchData()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Error al guardar")
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (c: Categoria) => {
    const ok = await confirm({
      title: `¿Eliminar la categoría "${c.nombre}"?`,
      description: "Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      destructive: true,
    })
    if (!ok) return
    try {
      await axios.delete(`${API_URL}/admin/categorias/${c.id}`, { headers: getHeaders() })
      toast.success("Categoría eliminada")
      fetchData()
    } catch {
      toast.error("Error al eliminar la categoría")
    }
  }

  const resetRoundRobin = async (c: Categoria) => {
    const ok = await confirm({
      title: `¿Resetear el round-robin de "${c.nombre}"?`,
      description: "Esto reiniciará el orden de asignación de prospectos a vendedores.",
      confirmText: "Resetear",
    })
    if (!ok) return
    try {
      await axios.post(`${API_URL}/admin/categorias/${c.id}/reset-round-robin`, {}, { headers: getHeaders() })
      toast.success("Round-robin reseteado")
      fetchData()
    } catch {
      toast.error("Error al resetear round-robin")
    }
  }

  const setF = <K extends keyof typeof emptyForm>(k: K, v: typeof emptyForm[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const totalActivas = categorias.filter(c => c.activa === true || c.activa === 1).length

  return (
    <div className="space-y-4">
      {/* KPIs — se prefieren las estadísticas del backend cuando están */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card><CardContent className="p-3 text-center">
          <Tag className="size-4 mx-auto mb-1 text-primary" />
          <p className="text-2xl font-bold text-foreground">{estadisticas?.total_categorias ?? categorias.length}</p>
          <p className="text-xs text-muted-foreground">Total categorías</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <BarChart2 className="size-4 mx-auto mb-1 text-state-ok-text" />
          <p className="text-2xl font-bold text-foreground">{estadisticas?.categorias_activas ?? totalActivas}</p>
          <p className="text-xs text-muted-foreground">Activas</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <Users className="size-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-2xl font-bold text-foreground">{estadisticas?.vendedores_asignados ?? cargaVendedores.length}</p>
          <p className="text-xs text-muted-foreground">Vendedores asignados</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <Users className="size-4 mx-auto mb-1 text-state-warn-text" />
          <p className="text-2xl font-bold text-foreground">
            {estadisticas?.vendedores_sin_categoria ?? Math.max(0, vendedores.length - cargaVendedores.length)}
          </p>
          <p className="text-xs text-muted-foreground">Sin categoría</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <BarChart2 className="size-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-2xl font-bold text-foreground">{estadisticas?.prospectos_distribuidos ?? "—"}</p>
          <p className="text-xs text-muted-foreground">Prospectos distribuidos</p>
        </CardContent></Card>
      </div>

      {/* Toolbar */}
      <div className="flex gap-2 items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Categorías de asignación</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}><RefreshCw className="size-4" /></Button>
          <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={abrirCrear}>
            <Plus className="size-4 mr-1" />Nueva categoría
          </Button>
        </div>
      </div>

      {/* Tabla categorías */}
      {loading ? <Skeleton className="h-48 w-full rounded-xl" /> : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden sm:table-cell">Descripción</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead className="hidden md:table-cell">Capacidad máx.</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-36">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categorias.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-sm">{c.nombre}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{c.descripcion || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{c.prioridad ?? 1}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{c.capacidad_maxima ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={(c.activa === true || c.activa === 1) ? "ok" : "secondary"} className="text-xs">
                      {(c.activa === true || c.activa === 1) ? "Activa" : "Inactiva"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" className="size-8 bg-primary hover:bg-primary/90 text-white border-0" onClick={() => abrirEditar(c)} title="Editar"><Edit2 className="size-3.5" /></Button>
                      <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => resetRoundRobin(c)} title="Reset round-robin">
                        <RotateCcw className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="destructive" className="size-8" onClick={() => eliminar(c)} title="Eliminar">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {categorias.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Sin categorías</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Carga de vendedores por categoría */}
      {cargaVendedores.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Carga de vendedores</h3>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Prospectos activos</TableHead>
                  <TableHead className="hidden sm:table-cell">Cap. máxima</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargaVendedores.map(v => (
                  <TableRow key={v.vendedor_id}>
                    <TableCell className="text-sm font-medium">{v.nombre}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{v.categoria_nombre ?? "Sin categoría"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{v.total_prospectos ?? 0}</span>
                        {v.capacidad_maxima && (
                          <div className="flex-1 bg-muted rounded-full h-1.5 min-w-12">
                            <div
                              className="bg-primary h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, ((v.total_prospectos ?? 0) / v.capacidad_maxima) * 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{v.capacidad_maxima ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      <Dialog open={modal} onOpenChange={open => { setModal(open); if (!open) setError("") }}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={e => setF("nombre", e.target.value)} placeholder="Ej: Junior, Senior, Premium..." />
            </div>
            <div className="space-y-1">
              <Label>Descripción</Label>
              <Textarea rows={2} value={form.descripcion} onChange={e => setF("descripcion", e.target.value)} placeholder="Descripción opcional..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Prioridad</Label>
                <Input type="number" min="1" max="10" value={form.prioridad} onChange={e => setF("prioridad", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Capacidad máxima</Label>
                <Input type="number" min="1" value={form.capacidad_maxima} onChange={e => setF("capacidad_maxima", Number(e.target.value))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="activaCheck" checked={form.activa} onCheckedChange={v => setF("activa", !!v)} />
              <label htmlFor="activaCheck" className="text-sm cursor-pointer">Categoría activa</label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando} className="bg-primary hover:bg-primary/90">
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
