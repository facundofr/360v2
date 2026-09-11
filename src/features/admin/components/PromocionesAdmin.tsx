import { useState, useEffect, useCallback, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useConfirm } from "@/components/common/confirm-dialog"
import axios from "axios"
import { toast } from "sonner"
import { Plus, RefreshCw, Search, Edit2, Trash2, ToggleLeft, ToggleRight } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "@/components/ui/data-table"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"
import { promocionSchema, type PromocionValues } from "@/features/admin/schemas"

interface Promocion {
  id: number
  nombre: string
  descripcion: string
  descuento_porcentaje: number
  activa: boolean
  created_at?: string
  updated_at?: string
}

const valoresVacios: PromocionValues = { nombre: "", descripcion: "", descuento_porcentaje: "0", activa: true }

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
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const form = useForm<PromocionValues>({ resolver: zodResolver(promocionSchema), defaultValues: valoresVacios })

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
    setEditandoId(promo?.id ?? null)
    form.reset({
      nombre: promo?.nombre ?? "",
      descripcion: promo?.descripcion ?? "",
      descuento_porcentaje: String(promo?.descuento_porcentaje ?? 0),
      activa: promo?.activa ?? true,
    })
    setModal(true)
  }

  const guardar = async (values: PromocionValues) => {
    setGuardando(true); setError("")
    try {
      const payload = {
        ...values,
        nombre: values.nombre.trim(),
        descripcion: values.descripcion.trim(),
        descuento_porcentaje: Number(values.descuento_porcentaje),
      }
      if (editandoId) {
        await axios.put(`${API_URL}/admin/promociones/${editandoId}`, payload, { headers: authHeaders })
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

  const columns = useMemo<ColumnDef<Promocion>[]>(() => [
    { accessorKey: "nombre", header: "Nombre", cell: ({ row }) => <span className="font-medium text-sm">{row.original.nombre}</span> },
    {
      accessorKey: "descripcion",
      header: "Descripción",
      meta: { className: "hidden sm:table-cell text-sm text-muted-foreground max-w-48 truncate" },
    },
    {
      accessorKey: "descuento_porcentaje",
      header: "Descuento",
      cell: ({ row }) => <Badge variant="outline" className="font-mono">{row.original.descuento_porcentaje}%</Badge>,
    },
    {
      accessorKey: "activa",
      header: "Estado",
      cell: ({ row }) => (
        <Badge variant={row.original.activa ? "ok" : "secondary"}>
          {row.original.activa ? "Activa" : "Inactiva"}
        </Badge>
      ),
    },
    {
      accessorKey: "updated_at",
      header: "Última actualización",
      meta: { className: "hidden md:table-cell text-xs text-muted-foreground" },
      cell: ({ row }) => formatFecha(row.original.updated_at),
    },
    {
      id: "acciones",
      header: "Acciones",
      enableSorting: false,
      meta: { className: "w-24" },
      cell: ({ row }) => {
        const p = row.original
        return (
          <div className="flex gap-1">
            <Button size="icon" className="size-8" onClick={() => abrirModal(p)} title="Editar"><Edit2 className="size-3.5" /></Button>
            <Button size="icon" variant="outline" className="size-8" onClick={() => toggleActiva(p)} title={p.activa ? "Desactivar" : "Activar"}>
              {p.activa ? <ToggleRight className="size-3.5" /> : <ToggleLeft className="size-3.5" />}
            </Button>
            <Button size="icon" variant="destructive" className="size-8" onClick={() => eliminar(p)} title="Eliminar"><Trash2 className="size-3.5" /></Button>
          </div>
        )
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

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
        <Button size="sm" onClick={() => abrirModal()}>
          <Plus className="size-4 mr-1" />Nueva
        </Button>
      </div>

      {/* Tabla */}
      {loading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : (
        <DataTable columns={columns} data={filtradas} emptyMessage="Sin promociones" />
      )}

      {/* Modal */}
      <Dialog open={modal} onOpenChange={open => { setModal(open); if (!open) setError("") }}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar promoción" : "Nueva promoción"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-3" onSubmit={form.handleSubmit(guardar)}>
              <FormField control={form.control} name="nombre" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="descripcion" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción *</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="descuento_porcentaje" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descuento (%) *</FormLabel>
                  <FormControl><Input type="number" min="0" max="100" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="activa" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="cursor-pointer">Activa</FormLabel>
                </FormItem>
              )} />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="button" variant="destructive" onClick={() => setModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={guardando}>{guardando ? "Guardando..." : "Guardar"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
