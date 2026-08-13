import { useState, useEffect, useCallback } from "react"
import { useConfirm } from "@/components/common/confirm-dialog"
import axios from "axios"
import { toast } from "sonner"
import { Plus, RefreshCw, Edit2, Trash2, Percent } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface CategoriaMonotributo {
  id: number
  letra: string
  aporte_presuntivo: number
}

const emptyForm = { id: null as number | null, letra: "", aporte_presuntivo: "" }

export default function MonotributoAdmin() {
  const confirm = useConfirm()
  const [categorias, setCategorias] = useState<CategoriaMonotributo[]>([])
  const [loading, setLoading] = useState(true)
  const [formModal, setFormModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [porcentajeModal, setPorcentajeModal] = useState(false)
  const [porcentaje, setPorcentaje] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  const authHeaders = { Authorization: `Bearer ${getAuthToken()}` }

  const fetchCategorias = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API_URL}/monotributo`, { headers: authHeaders })
      setCategorias(data ?? [])
    } catch {
      toast.error("Error al cargar categorías de monotributo")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCategorias() }, [fetchCategorias])

  const abrirCrear = () => { setError(""); setForm(emptyForm); setFormModal(true) }
  const abrirEditar = (c: CategoriaMonotributo) => { setError(""); setForm({ id: c.id, letra: c.letra, aporte_presuntivo: String(c.aporte_presuntivo) }); setFormModal(true) }

  const guardar = async () => {
    if (!form.letra.trim()) { setError("La letra es obligatoria"); return }
    const aporte = Number(form.aporte_presuntivo)
    if (isNaN(aporte) || aporte <= 0) { setError("El aporte presuntivo debe ser mayor a 0"); return }
    setGuardando(true); setError("")
    try {
      const payload = { letra: form.letra.trim().toUpperCase(), aporte_presuntivo: aporte }
      if (form.id) {
        await axios.put(`${API_URL}/monotributo/${form.id}`, payload, { headers: authHeaders })
        toast.success("Categoría actualizada")
      } else {
        await axios.post(`${API_URL}/monotributo`, payload, { headers: authHeaders })
        toast.success("Categoría creada")
      }
      setFormModal(false)
      fetchCategorias()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Error al guardar")
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (cat: CategoriaMonotributo) => {
    const ok = await confirm({
      title: `¿Eliminar la categoría "${cat.letra}"?`,
      description: "Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      destructive: true,
    })
    if (!ok) return
    try {
      await axios.delete(`${API_URL}/monotributo/${cat.id}`, { headers: authHeaders })
      toast.success("Categoría eliminada")
      fetchCategorias()
    } catch {
      toast.error("Error al eliminar categoría")
    }
  }

  const aplicarAumento = async () => {
    const p = Number(porcentaje)
    if (isNaN(p) || p <= 0 || p > 1000) { toast.warning("Ingresa un porcentaje válido (1-1000)"); return }
    setGuardando(true)
    try {
      await axios.post(`${API_URL}/monotributo/aumentar`, { porcentaje: p }, { headers: authHeaders })
      toast.success(`Aumento del ${p}% aplicado`)
      setPorcentajeModal(false); setPorcentaje("")
      fetchCategorias()
    } catch {
      toast.error("Error al aplicar aumento")
    } finally {
      setGuardando(false)
    }
  }

  const formatCurrency = (v: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(v)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground flex-1">Categorías de monotributo</span>
        <Button variant="outline" size="sm" onClick={() => { setError(""); setPorcentaje(""); setPorcentajeModal(true) }}>
          <Percent className="size-3.5 mr-1" />Aplicar aumento
        </Button>
        <Button variant="outline" size="icon" onClick={fetchCategorias} disabled={loading}><RefreshCw className="size-4" /></Button>
        <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={abrirCrear}>
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
                <TableHead className="w-24">Letra</TableHead>
                <TableHead>Aporte presuntivo</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categorias.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-10">Sin categorías</TableCell></TableRow>
              ) : (
                categorias.map(cat => (
                  <TableRow key={cat.id}>
                    <TableCell>
                      <span className="inline-flex items-center justify-center size-9 rounded-full bg-primary/10 font-bold text-primary">
                        {cat.letra}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono font-semibold">{formatCurrency(cat.aporte_presuntivo)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" className="size-8 bg-primary hover:bg-primary/90 text-white border-0" onClick={() => abrirEditar(cat)} title="Editar"><Edit2 className="size-3.5" /></Button>
                        <Button size="icon" className="size-8 bg-red-500 hover:bg-red-600 text-white border-0" onClick={() => eliminar(cat)} title="Eliminar"><Trash2 className="size-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal crear/editar */}
      <Dialog open={formModal} onOpenChange={open => { setFormModal(open); if (!open) setError("") }}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Letra *</Label>
              <Input
                maxLength={2}
                placeholder="A, B, C, ..."
                value={form.letra}
                onChange={e => setForm(f => ({ ...f, letra: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Aporte presuntivo ($) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.aporte_presuntivo}
                onChange={e => setForm(f => ({ ...f, aporte_presuntivo: e.target.value }))}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => setFormModal(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando} className="bg-primary hover:bg-primary/90">{guardando ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal aumento porcentual */}
      <Dialog open={porcentajeModal} onOpenChange={setPorcentajeModal}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Aplicar aumento porcentual</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Se aplicará el incremento a <strong>todas las categorías</strong>.</p>
            <div className="space-y-1">
              <Label>Porcentaje de aumento (%)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Ej: 10"
                value={porcentaje}
                onChange={e => setPorcentaje(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => setPorcentajeModal(false)}>Cancelar</Button>
            <Button onClick={aplicarAumento} disabled={guardando || !porcentaje} className="bg-primary hover:bg-primary/90">{guardando ? "Aplicando..." : "Aplicar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
