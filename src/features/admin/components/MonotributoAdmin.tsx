import { useState, useEffect, useCallback, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useConfirm } from "@/components/common/confirm-dialog"
import axios from "axios"
import { toast } from "sonner"
import { Plus, RefreshCw, Edit2, Trash2, Percent } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "@/components/ui/data-table"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"
import { monotributoSchema, type MonotributoValues } from "@/features/admin/schemas"

interface CategoriaMonotributo {
  id: number
  letra: string
  aporte_presuntivo: number
}

const valoresVacios: MonotributoValues = { letra: "", aporte_presuntivo: "" }

export default function MonotributoAdmin() {
  const confirm = useConfirm()
  const [categorias, setCategorias] = useState<CategoriaMonotributo[]>([])
  const [loading, setLoading] = useState(true)
  const [formModal, setFormModal] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [porcentajeModal, setPorcentajeModal] = useState(false)
  const [porcentaje, setPorcentaje] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const form = useForm<MonotributoValues>({ resolver: zodResolver(monotributoSchema), defaultValues: valoresVacios })

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

  const abrirCrear = () => { setError(""); setEditandoId(null); form.reset(valoresVacios); setFormModal(true) }
  const abrirEditar = (c: CategoriaMonotributo) => { setError(""); setEditandoId(c.id); form.reset({ letra: c.letra, aporte_presuntivo: String(c.aporte_presuntivo) }); setFormModal(true) }

  const guardar = async (values: MonotributoValues) => {
    setGuardando(true); setError("")
    try {
      const payload = { letra: values.letra.trim().toUpperCase(), aporte_presuntivo: Number(values.aporte_presuntivo) }
      if (editandoId) {
        await axios.put(`${API_URL}/monotributo/${editandoId}`, payload, { headers: authHeaders })
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

  const formatCurrency = (v: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

  const columns = useMemo<ColumnDef<CategoriaMonotributo>[]>(() => [
    {
      accessorKey: "letra",
      header: "Letra",
      meta: { className: "w-24" },
      cell: ({ row }) => (
        <span className="inline-flex items-center justify-center size-9 rounded-full bg-primary/10 font-bold text-primary">
          {row.original.letra}
        </span>
      ),
    },
    {
      accessorKey: "aporte_presuntivo",
      header: "Aporte presuntivo",
      meta: { className: "font-mono font-semibold" },
      cell: ({ row }) => formatCurrency(row.original.aporte_presuntivo),
    },
    {
      id: "acciones",
      header: "Acciones",
      enableSorting: false,
      meta: { className: "w-24" },
      cell: ({ row }) => {
        const cat = row.original
        return (
          <div className="flex gap-1">
            <Button size="icon" className="size-8" onClick={() => abrirEditar(cat)} title="Editar"><Edit2 className="size-3.5" /></Button>
            <Button size="icon" variant="destructive" className="size-8" onClick={() => eliminar(cat)} title="Eliminar"><Trash2 className="size-3.5" /></Button>
          </div>
        )
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground flex-1">Categorías de monotributo</span>
        <Button variant="outline" size="sm" onClick={() => { setError(""); setPorcentaje(""); setPorcentajeModal(true) }}>
          <Percent className="size-3.5 mr-1" />Aplicar aumento
        </Button>
        <Button variant="outline" size="icon" onClick={fetchCategorias} disabled={loading}><RefreshCw className="size-4" /></Button>
        <Button size="sm" onClick={abrirCrear}>
          <Plus className="size-4 mr-1" />Nueva
        </Button>
      </div>

      {/* Tabla */}
      {loading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : (
        <DataTable columns={columns} data={categorias} emptyMessage="Sin categorías" />
      )}

      {/* Modal crear/editar */}
      <Dialog open={formModal} onOpenChange={open => { setFormModal(open); if (!open) setError("") }}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-3" onSubmit={form.handleSubmit(guardar)}>
              <FormField control={form.control} name="letra" render={({ field }) => (
                <FormItem>
                  <FormLabel>Letra *</FormLabel>
                  <FormControl>
                    <Input
                      maxLength={2}
                      placeholder="A, B, C, ..."
                      {...field}
                      onChange={e => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="aporte_presuntivo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Aporte presuntivo ($) *</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="0.01" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="button" variant="destructive" onClick={() => setFormModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={guardando}>{guardando ? "Guardando..." : "Guardar"}</Button>
              </DialogFooter>
            </form>
          </Form>
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
            <Button onClick={aplicarAumento} disabled={guardando || !porcentaje}>{guardando ? "Aplicando..." : "Aplicar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
