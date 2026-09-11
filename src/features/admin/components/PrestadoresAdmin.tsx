import { useState, useEffect, useCallback, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useConfirm } from "@/components/common/confirm-dialog"
import axios from "axios"
import { toast } from "sonner"
import { Plus, RefreshCw, Search, Edit2, Trash2, Eye, ToggleLeft, ToggleRight } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "@/components/ui/data-table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"
import { prestadorSchema, type PrestadorValues } from "@/features/admin/schemas"

/** Campos reales de `getPlanesAsignados` (`prestadorModel.js:149`): `pp.*` más
 * `plan_nombre` aliado — no existe `plan.nombre` anidado. */
interface PlanAsignado {
  id: number
  plan_id: number
  plan_nombre: string
  tipo_cobertura?: string
  porcentaje_cobertura?: number
  copago?: number
}

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
/** Sólo para mostrar — el backend valida estos 5 valores sin tilde
 * (`prestadorModel.js` tiposValidos), no cambiar los `value` del Select. */
const LABEL_TIPO: Record<string, string> = {
  medico: "Médico", clinica: "Clínica", laboratorio: "Laboratorio", farmacia: "Farmacia", otro: "Otro",
}

const valoresVacios: PrestadorValues = {
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
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const form = useForm<PrestadorValues>({ resolver: zodResolver(prestadorSchema), defaultValues: valoresVacios })
  const [detalleModal, setDetalleModal] = useState<Prestador | null>(null)
  const [planesAsignados, setPlanesAsignados] = useState<PlanAsignado[]>([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  const authHeaders = { Authorization: `Bearer ${getAuthToken()}` }

  /**
   * Abre el detalle y pide el prestador completo.
   * El listado (`getAll`) no trae `planes_asignados`; sólo los agrega
   * `GET /admin/prestadores/:id` (`prestadorController.js:22`).
   */
  const abrirDetalle = async (p: Prestador) => {
    setDetalleModal(p)
    setPlanesAsignados([])
    setCargandoDetalle(true)
    try {
      const { data } = await axios.get(`${API_URL}/admin/prestadores/${p.id}`, { headers: authHeaders })
      const completo = (data?.data ?? data) as Prestador & { planes_asignados?: PlanAsignado[] }
      setDetalleModal(prev => (prev?.id === p.id ? { ...prev, ...completo } : prev))
      setPlanesAsignados(completo?.planes_asignados ?? [])
    } catch {
      // El detalle ya muestra lo que vino del listado; sólo se pierden los planes.
      toast.error("No se pudieron cargar los planes asignados")
    } finally {
      setCargandoDetalle(false)
    }
  }

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

  const abrirCrear = () => { setError(""); setEditandoId(null); form.reset(valoresVacios); setModal(true) }
  const abrirEditar = (p: Prestador) => {
    setError("")
    setEditandoId(p.id)
    form.reset({
      nombre: p.nombre,
      especialidad: p.especialidad ?? "",
      telefono: p.telefono ?? "",
      email: p.email ?? "",
      direccion: p.direccion ?? "",
      localidad: p.localidad ?? "",
      provincia: p.provincia ?? "",
      codigo_postal: p.codigo_postal ?? "",
      matricula: p.matricula ?? "",
      tipo_prestador: p.tipo_prestador,
      estado: p.estado,
      observaciones: p.observaciones ?? "",
    })
    setModal(true)
  }

  const guardar = async (values: PrestadorValues) => {
    setGuardando(true); setError("")
    try {
      const payload = { ...values, nombre: values.nombre.trim() }
      if (editandoId) {
        await axios.put(`${API_URL}/admin/prestadores/${editandoId}`, payload, { headers: authHeaders })
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

  const columns = useMemo<ColumnDef<Prestador>[]>(() => [
    { accessorKey: "nombre", header: "Nombre", cell: ({ row }) => <span className="text-sm font-medium">{row.original.nombre}</span> },
    {
      accessorKey: "especialidad",
      header: "Especialidad",
      meta: { className: "hidden sm:table-cell text-sm text-muted-foreground" },
      cell: ({ row }) => row.original.especialidad ?? "—",
    },
    {
      accessorKey: "tipo_prestador",
      header: "Tipo",
      cell: ({ row }) => <Badge variant="outline" className="text-xs">{LABEL_TIPO[row.original.tipo_prestador] ?? row.original.tipo_prestador}</Badge>,
    },
    {
      accessorKey: "localidad",
      header: "Localidad",
      meta: { className: "hidden md:table-cell text-sm text-muted-foreground" },
      cell: ({ row }) => row.original.localidad ?? "—",
    },
    {
      accessorKey: "telefono",
      header: "Teléfono",
      meta: { className: "hidden md:table-cell text-sm text-muted-foreground" },
      cell: ({ row }) => row.original.telefono ?? "—",
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => (
        <Badge variant={row.original.estado ? "ok" : "secondary"} className="text-xs">
          {row.original.estado ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      id: "acciones",
      header: "Acciones",
      enableSorting: false,
      meta: { className: "w-20" },
      cell: ({ row }) => {
        const p = row.original
        return (
          <div className="flex gap-1">
            <Button size="icon" variant="outline" className="size-8" onClick={() => abrirDetalle(p)} title="Ver detalle"><Eye className="size-3.5" /></Button>
            <Button size="icon" className="size-8" onClick={() => abrirEditar(p)} title="Editar"><Edit2 className="size-3.5" /></Button>
            <Button size="icon" variant="outline" className="size-8" onClick={() => toggleEstado(p)} title={p.estado ? "Desactivar" : "Activar"}>
              {p.estado ? <ToggleRight className="size-3.5" /> : <ToggleLeft className="size-3.5" />}
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
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nombre, especialidad..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <Button variant="outline" size="icon" onClick={fetchPrestadores} disabled={loading}><RefreshCw className="size-4" /></Button>
        <Button size="sm" onClick={abrirCrear}>
          <Plus className="size-4 mr-1" />Nuevo
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <Select value={filtroTipo || "all"} onValueChange={v => setFiltroTipo(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {TIPOS.map(t => <SelectItem key={t} value={t}>{LABEL_TIPO[t] ?? t}</SelectItem>)}
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
      {loading ? <Skeleton className="h-64 w-full rounded-lg" /> : (
        <DataTable columns={columns} data={filtrados} emptyMessage="Sin prestadores" />
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
                ["Tipo", LABEL_TIPO[detalleModal.tipo_prestador] ?? detalleModal.tipo_prestador],
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

              {/* Planes asignados: sólo vienen de `GET /admin/prestadores/:id`
                  (`prestadorController.js:22`), no del listado. */}
              <div className="col-span-2 space-y-1">
                <p className="text-xs text-muted-foreground">Planes asignados</p>
                {cargandoDetalle ? (
                  <Skeleton className="h-5 w-40" />
                ) : planesAsignados.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin planes asignados</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {planesAsignados.map(plan => (
                      <Badge key={plan.id} variant="secondary" className="text-xs" title={`${plan.tipo_cobertura ?? "completa"} · ${plan.porcentaje_cobertura ?? 100}% cobertura${plan.copago ? ` · copago $${plan.copago}` : ""}`}>
                        {plan.plan_nombre}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="destructive" onClick={() => setDetalleModal(null)}>Cerrar</Button>
            <Button onClick={() => { if (detalleModal) { abrirEditar(detalleModal); setDetalleModal(null) } }}>Editar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modal} onOpenChange={open => { setModal(open); if (!open) setError("") }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar prestador" : "Nuevo prestador"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(guardar)}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField control={form.control} name="nombre" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="tipo_prestador" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de prestador</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{LABEL_TIPO[t] ?? t}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="especialidad" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Especialidad</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="telefono" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="matricula" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Matrícula</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="provincia" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provincia</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="localidad" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Localidad</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="codigo_postal" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código postal</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="direccion" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Dirección</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="observaciones" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Observaciones</FormLabel>
                    <FormControl><Textarea rows={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="estado" render={({ field }) => (
                  <FormItem className="sm:col-span-2 flex items-center gap-2 space-y-0">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="cursor-pointer">Activo</FormLabel>
                  </FormItem>
                )} />
                {error && <p className="sm:col-span-2 text-sm text-destructive">{error}</p>}
              </div>
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
