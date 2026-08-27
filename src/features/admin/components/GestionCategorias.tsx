import { useState, useEffect, useCallback, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios"
import { toast } from "sonner"
import { useConfirm } from "@/components/common/confirm-dialog"
import { Plus, RefreshCw, Edit2, Trash2, RotateCcw, Tag, Users, BarChart2 } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "@/components/ui/data-table"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Card, CardContent } from "@/components/ui/card"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"
import { categoriaSchema, type CategoriaValues } from "@/features/admin/schemas"

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

/** GET /admin/categorias/estadisticas devuelve un ARRAY con una fila por
 * categoría (`distribucionRoundRobinModel.js` getEstadisticasDistribucion) —
 * nunca un objeto agregado con total_categorias/prospectos_distribuidos. */
interface EstadisticaCategoria {
  categoria_id: number
  categoria_nombre?: string
  capacidad_maxima?: number
  total_vendedores?: number
  vendedores_activos?: number
  total_prospectos?: number
  promedio_prospectos_por_vendedor?: number
}

/** Campos reales de `getCargaVendedores` — antes usaba `nombre`/`total_prospectos`
 * inventados; el backend devuelve `first_name`/`last_name`/`current_load`. */
interface CargaVendedor {
  id: number
  first_name?: string
  last_name?: string
  categoria_nombre?: string
  current_load?: number
  porcentaje_carga?: number
  capacidad_maxima?: number
}

const valoresVacios: CategoriaValues = {
  nombre: "",
  descripcion: "",
  capacidad_maxima: "50",
  prioridad: "1",
  activa: true,
}

const getHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` })

export default function GestionCategorias() {
  const confirm = useConfirm()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cargaVendedores, setCargaVendedores] = useState<CargaVendedor[]>([])
  const [estadisticasPorCategoria, setEstadisticasPorCategoria] = useState<EstadisticaCategoria[]>([])
  const [vendedores, setVendedores] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const form = useForm<CategoriaValues>({ resolver: zodResolver(categoriaSchema), defaultValues: valoresVacios })

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
      setEstadisticasPorCategoria(Array.isArray(statsRes.data) ? statsRes.data : [])
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
    form.reset(valoresVacios)
    setError("")
    setModal(true)
  }

  const abrirEditar = (c: Categoria) => {
    setEditingId(c.id)
    form.reset({
      nombre: c.nombre,
      descripcion: c.descripcion ?? "",
      capacidad_maxima: String(c.capacidad_maxima ?? 50),
      prioridad: String(c.prioridad ?? 1),
      activa: c.activa === true || c.activa === 1,
    })
    setError("")
    setModal(true)
  }

  const guardar = async (values: CategoriaValues) => {
    setGuardando(true); setError("")
    try {
      const payload = {
        ...values,
        nombre: values.nombre.trim(),
        capacidad_maxima: Number(values.capacidad_maxima),
        prioridad: Number(values.prioridad),
      }
      if (editingId) {
        await axios.put(`${API_URL}/admin/categorias/${editingId}`, payload, { headers: getHeaders() })
        toast.success("Categoría actualizada")
      } else {
        await axios.post(`${API_URL}/admin/categorias`, payload, { headers: getHeaders() })
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

  const totalActivas = categorias.filter(c => c.activa === true || c.activa === 1).length

  const columnasCategorias = useMemo<ColumnDef<Categoria>[]>(() => [
    { accessorKey: "nombre", header: "Nombre", cell: ({ row }) => <span className="font-medium text-sm">{row.original.nombre}</span> },
    {
      accessorKey: "descripcion",
      header: "Descripción",
      meta: { className: "hidden sm:table-cell text-sm text-muted-foreground" },
      cell: ({ row }) => row.original.descripcion || "—",
    },
    {
      accessorKey: "prioridad",
      header: "Prioridad",
      cell: ({ row }) => <Badge variant="outline" className="text-xs">{row.original.prioridad ?? 1}</Badge>,
    },
    {
      accessorKey: "capacidad_maxima",
      header: "Capacidad máx.",
      meta: { className: "hidden md:table-cell text-sm text-muted-foreground" },
      cell: ({ row }) => row.original.capacidad_maxima ?? "—",
    },
    {
      accessorKey: "activa",
      header: "Estado",
      cell: ({ row }) => {
        const activa = row.original.activa === true || row.original.activa === 1
        return <Badge variant={activa ? "ok" : "secondary"} className="text-xs">{activa ? "Activa" : "Inactiva"}</Badge>
      },
    },
    {
      id: "acciones",
      header: "Acciones",
      enableSorting: false,
      meta: { className: "w-36" },
      cell: ({ row }) => {
        const c = row.original
        return (
          <div className="flex gap-1">
            <Button size="icon" className="size-8 bg-primary hover:bg-primary/90 text-white border-0" onClick={() => abrirEditar(c)} title="Editar"><Edit2 className="size-3.5" /></Button>
            <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => resetRoundRobin(c)} title="Reset round-robin">
              <RotateCcw className="size-3.5" />
            </Button>
            <Button size="icon" variant="destructive" className="size-8" onClick={() => eliminar(c)} title="Eliminar">
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  const columnasCarga = useMemo<ColumnDef<CargaVendedor>[]>(() => [
    {
      id: "vendedor",
      header: "Vendedor",
      meta: { className: "text-sm font-medium" },
      accessorFn: v => `${v.first_name ?? ""} ${v.last_name ?? ""}`.trim(),
    },
    {
      accessorKey: "categoria_nombre",
      header: "Categoría",
      cell: ({ row }) => <Badge variant="outline" className="text-xs">{row.original.categoria_nombre ?? "Sin categoría"}</Badge>,
    },
    {
      accessorKey: "current_load",
      header: "Prospectos activos",
      cell: ({ row }) => {
        const v = row.original
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">{v.current_load ?? 0}</span>
            {v.capacidad_maxima && (
              <div className="flex-1 bg-muted rounded-full h-1.5 min-w-12">
                <div
                  className="bg-primary h-1.5 rounded-full"
                  style={{ width: `${Math.min(100, v.porcentaje_carga ?? 0)}%` }}
                />
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "capacidad_maxima",
      header: "Cap. máxima",
      meta: { className: "hidden sm:table-cell text-sm text-muted-foreground" },
      cell: ({ row }) => row.original.capacidad_maxima ?? "—",
    },
  ], [])

  return (
    <div className="space-y-4">
      {/* KPIs — total_categorias/vendedores_asignados/etc. no existen como
          agregado en el backend (/admin/categorias/estadisticas devuelve un
          array por categoría), así que se calculan acá a partir de los datos
          ya cargados; "Prospectos distribuidos" sí sale de ese array. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card><CardContent className="p-3 text-center">
          <Tag className="size-4 mx-auto mb-1 text-primary" />
          <p className="text-2xl font-bold text-foreground">{categorias.length}</p>
          <p className="text-xs text-muted-foreground">Total categorías</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <BarChart2 className="size-4 mx-auto mb-1 text-state-ok-text" />
          <p className="text-2xl font-bold text-foreground">{totalActivas}</p>
          <p className="text-xs text-muted-foreground">Activas</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <Users className="size-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-2xl font-bold text-foreground">{cargaVendedores.length}</p>
          <p className="text-xs text-muted-foreground">Vendedores asignados</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <Users className="size-4 mx-auto mb-1 text-state-warn-text" />
          <p className="text-2xl font-bold text-foreground">
            {Math.max(0, vendedores.length - cargaVendedores.length)}
          </p>
          <p className="text-xs text-muted-foreground">Sin categoría</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <BarChart2 className="size-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-2xl font-bold text-foreground">
            {estadisticasPorCategoria.reduce((sum, c) => sum + (c.total_prospectos ?? 0), 0)}
          </p>
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
        <DataTable columns={columnasCategorias} data={categorias} emptyMessage="Sin categorías" />
      )}

      {/* Carga de vendedores por categoría */}
      {cargaVendedores.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Carga de vendedores</h3>
          <DataTable columns={columnasCarga} data={cargaVendedores} />
        </div>
      )}

      {/* Modal crear/editar */}
      <Dialog open={modal} onOpenChange={open => { setModal(open); if (!open) setError("") }}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-3" onSubmit={form.handleSubmit(guardar)}>
              <FormField control={form.control} name="nombre" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre *</FormLabel>
                  <FormControl><Input placeholder="Ej: Junior, Senior, Premium..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="descripcion" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl><Textarea rows={2} placeholder="Descripción opcional..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="prioridad" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridad</FormLabel>
                    <FormControl><Input type="number" min="1" max="10" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="capacidad_maxima" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacidad máxima</FormLabel>
                    <FormControl><Input type="number" min="1" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="activa" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="cursor-pointer">Categoría activa</FormLabel>
                </FormItem>
              )} />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button type="button" variant="destructive" onClick={() => setModal(false)}>Cancelar</Button>
                <Button type="submit" disabled={guardando} className="bg-primary hover:bg-primary/90">
                  {guardando ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
