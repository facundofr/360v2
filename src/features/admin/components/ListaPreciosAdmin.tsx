import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios"
import { toast } from "sonner"
import { RefreshCw, Search, Edit2, TrendingUp, TrendingDown, Upload, FileDown, Plus, Trash2, Eye } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { useConfirm } from "@/components/common/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "@/components/ui/data-table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"
import { nuevoPrecioSchema, type NuevoPrecioValues } from "@/features/admin/schemas"

interface PrecioItem {
  id: number
  anio: number
  /** Alias real del backend: `SELECT ... p.nombre AS plan` (`listaPreciosModel.js:10`). */
  plan?: string
  plan_id?: number
  /** Alias real: `c.nombre AS categoria_edad`. */
  categoria_edad?: string
  tipo_familia?: string
  precio: number
}

interface Plan { id: number; nombre: string }
interface Categoria { id: number; nombre: string }
interface TipoFamilia { id: number; nombre: string }

const YEAR_RANGE = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 2 + i)

const valoresVaciosNuevoPrecio: NuevoPrecioValues = { plan_id: "", categoria_id: "", tipo_familia_id: "", precio: "", anio: "" }

export default function ListaPreciosAdmin() {
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [precios, setPrecios] = useState<PrecioItem[]>([])
  const [tiposFamiliaCatalogo, setTiposFamiliaCatalogo] = useState<TipoFamilia[]>([])
  const [planes, setPlanes] = useState<Plan[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [filtroPlan, setFiltroPlan] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [filtroTipoFamilia, setFiltroTipoFamilia] = useState("")
  const [editModal, setEditModal] = useState(false)
  const [editItem, setEditItem] = useState<PrecioItem | null>(null)
  const [editPrecio, setEditPrecio] = useState("")
  const [porcentajeModal, setPorcentajeModal] = useState<"aumento" | "descuento" | null>(null)
  const [porcentaje, setPorcentaje] = useState("")
  const [guardando, setGuardando] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importarModal, setImportarModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importando, setImportando] = useState(false)
  const [nuevoModal, setNuevoModal] = useState(false)
  const nuevoForm = useForm<NuevoPrecioValues>({ resolver: zodResolver(nuevoPrecioSchema), defaultValues: valoresVaciosNuevoPrecio })
  const [detalle, setDetalle] = useState<PrecioItem | null>(null)

  const confirm = useConfirm()
  const authHeaders = { Authorization: `Bearer ${getAuthToken()}` }

  const fetchPrecios = useCallback(async () => {
    setLoading(true)
    try {
      const [preciosRes, planesRes, categoriasRes, tiposRes] = await Promise.all([
        axios.get(`${API_URL}/admin/lista-precios?anio=${anio}`, { headers: authHeaders }),
        axios.get(`${API_URL}/cotizaciones/planes`, { headers: authHeaders }),
        axios.get(`${API_URL}/cotizaciones/categorias`, { headers: authHeaders }),
        // Catálogo canónico de tipos de familia. Derivarlo de los precios
        // cargados sólo muestra los tipos que ya tienen precio ese año.
        axios.get(`${API_URL}/cotizaciones/tipos-familia`, { headers: authHeaders })
          .catch(() => ({ data: [] })),
      ])
      setPrecios(preciosRes.data?.data ?? preciosRes.data ?? [])
      setPlanes(planesRes.data?.data ?? planesRes.data ?? [])
      setCategorias(categoriasRes.data?.data ?? categoriasRes.data ?? [])
      // `GET /cotizaciones/tipos-familia` devuelve `{ id, nombre }`
      // (`opcionesCotizacionesController.js:26`). Guardamos el objeto entero:
      // el alta de precio necesita el `id` real, no la posición en la lista.
      const tipos = tiposRes.data?.data ?? tiposRes.data ?? []
      setTiposFamiliaCatalogo(
        Array.isArray(tipos)
          ? tipos
              .map((t: unknown, i: number) =>
                typeof t === "string"
                  ? { id: i + 1, nombre: t }
                  : { id: Number((t as TipoFamilia)?.id), nombre: String((t as TipoFamilia)?.nombre ?? "") }
              )
              .filter((t: TipoFamilia) => t.nombre && !isNaN(t.id))
          : []
      )
    } catch {
      toast.error("Error al cargar lista de precios")
    } finally {
      setLoading(false)
    }
  }, [anio])

  useEffect(() => { fetchPrecios() }, [fetchPrecios])

  // Preferimos el catálogo del backend; si no responde, caemos a los tipos
  // presentes en los precios cargados.
  const tiposFamilia = useMemo<TipoFamilia[]>(() => {
    if (tiposFamiliaCatalogo.length > 0) {
      return [...tiposFamiliaCatalogo].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    }
    // Fallback sin ids reales: sirve para filtrar, no para dar de alta.
    return Array.from(new Set(precios.map(p => p.tipo_familia).filter(Boolean)))
      .sort()
      .map((nombre, i) => ({ id: i + 1, nombre: nombre as string }))
  }, [tiposFamiliaCatalogo, precios])

  /** Sólo hay ids confiables si el catálogo vino del backend. */
  const puedeCrearPrecio = tiposFamiliaCatalogo.length > 0

  const filtrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase()
    return precios.filter(p => {
      if (filtroPlan && String(p.plan_id) !== filtroPlan && p.plan?.toLowerCase() !== filtroPlan.toLowerCase()) return false
      if (filtroCategoria && p.categoria_edad?.toLowerCase() !== filtroCategoria.toLowerCase()) return false
      if (filtroTipoFamilia && p.tipo_familia?.toLowerCase() !== filtroTipoFamilia.toLowerCase()) return false
      if (term && !String(p.precio).includes(term) && !p.plan?.toLowerCase().includes(term) && !p.categoria_edad?.toLowerCase().includes(term)) return false
      return true
    })
  }, [precios, busqueda, filtroPlan, filtroCategoria, filtroTipoFamilia])

  const abrirEditar = (item: PrecioItem) => { setEditItem(item); setEditPrecio(String(item.precio)); setEditModal(true) }

  /** Alta de un precio. `POST /admin/lista-precios` (`listaPreciosRoutes.js:11`). */
  const crearPrecio = async (values: NuevoPrecioValues) => {
    const precio = parseFloat(values.precio)
    setGuardando(true)
    try {
      await axios.post(
        `${API_URL}/admin/lista-precios`,
        {
          plan_id: values.plan_id,
          categoria_id: values.categoria_id,
          tipo_familia_id: values.tipo_familia_id,
          precio: precio.toFixed(2),
          anio: values.anio || anio,
        },
        { headers: authHeaders }
      )
      toast.success("Precio agregado correctamente")
      setNuevoModal(false)
      nuevoForm.reset(valoresVaciosNuevoPrecio)
      fetchPrecios()
    } catch (err) {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Error al agregar el precio"
      )
    } finally {
      setGuardando(false)
    }
  }

  /** Baja de un precio. `DELETE /admin/lista-precios/:id` (`listaPreciosRoutes.js:13`). */
  const eliminarPrecio = async (item: PrecioItem) => {
    const ok = await confirm({
      title: "¿Eliminar este precio?",
      description: `${item.plan ?? "Plan"} · ${item.categoria_edad ?? "—"} · ${item.tipo_familia ?? "—"} (${item.anio}). Esta acción no se puede deshacer.`,
      confirmText: "Sí, eliminar",
      destructive: true,
    })
    if (!ok) return

    try {
      await axios.delete(`${API_URL}/admin/lista-precios/${item.id}`, { headers: authHeaders })
      toast.success("Precio eliminado correctamente")
      fetchPrecios()
    } catch (err) {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Error al eliminar el precio"
      )
    }
  }

  const guardarEdicion = async () => {
    if (!editItem) return
    const precio = Number(editPrecio)
    if (isNaN(precio) || precio < 0) { toast.warning("Precio inválido"); return }
    setGuardando(true)
    try {
      await axios.put(`${API_URL}/admin/lista-precios/${editItem.id}`, { precio }, { headers: authHeaders })
      toast.success("Precio actualizado")
      setEditModal(false)
      fetchPrecios()
    } catch {
      toast.error("Error al actualizar precio")
    } finally {
      setGuardando(false)
    }
  }

  const aplicarPorcentaje = async (tipo: "aumento" | "descuento") => {
    const p = Number(porcentaje)
    if (isNaN(p) || p <= 0) { toast.warning("El porcentaje debe ser mayor a 0"); return }
    // Límites de producción: un aumento puede ser grande, un descuento del
    // 100% dejaría todos los precios en cero.
    if (tipo === "aumento" && p > 999.99) {
      toast.warning("El porcentaje de aumento no puede ser mayor a 999.99%")
      return
    }
    if (tipo === "descuento" && p >= 100) {
      toast.warning("El porcentaje de descuento no puede ser mayor o igual a 100%")
      return
    }

    setGuardando(true)
    try {
      // Rutas reales: PUT /aumentar/todos y PUT /disminuir/todos.
      const endpoint = tipo === "aumento" ? "aumentar/todos" : "disminuir/todos"
      await axios.put(`${API_URL}/admin/lista-precios/${endpoint}`, { porcentaje: p, anio }, { headers: authHeaders })
      toast.success(`${tipo === "aumento" ? "Aumento" : "Descuento"} del ${p}% aplicado`)
      setPorcentajeModal(null); setPorcentaje("")
      fetchPrecios()
    } catch {
      toast.error(`Error al aplicar ${tipo}`)
    } finally {
      setGuardando(false)
    }
  }

  // ─── Descargar template CSV (GET /admin/lista-precios/template) ───────────
  const descargarTemplate = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/lista-precios/template`, {
        headers: authHeaders,
        responseType: "blob",
      })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "template_lista_precios.csv"
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Error al descargar el template")
    }
  }

  // NOTA: se removió "Clonar año". Era una función sólo de v2 que llamaba a
  // `POST /admin/lista-precios/clonar`, endpoint que no existe en el backend
  // (siempre devolvía 404). Producción tampoco tiene esta función.
  // Para reponerla hay que implementar primero la ruta en el backend.

  const exportarCSV = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/lista-precios/exportar?anio=${anio}`, { headers: authHeaders, responseType: "blob" })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement("a")
      a.href = url; a.download = `lista-precios-${anio}.csv`; document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
      toast.success(`Lista de precios ${anio} exportada`)
    } catch {
      toast.error("Error al exportar CSV")
    }
  }

  const importarCSV = async () => {
    if (!importFile) { toast.warning("Seleccioná un archivo CSV"); return }
    setImportando(true)
    try {
      const formData = new FormData()
      formData.append("file", importFile)
      formData.append("anio", String(anio))
      await axios.post(`${API_URL}/admin/lista-precios/importar`, formData, {
        headers: { ...authHeaders, "Content-Type": "multipart/form-data" }
      })
      toast.success("Lista de precios importada correctamente")
      setImportarModal(false)
      setImportFile(null)
      fetchPrecios()
    } catch {
      toast.error("Error al importar CSV")
    } finally {
      setImportando(false)
    }
  }

  const formatCurrency = (v: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(v)

  const columns = useMemo<ColumnDef<PrecioItem>[]>(() => [
    {
      accessorKey: "plan",
      header: "Plan",
      meta: { className: "text-sm font-medium" },
      cell: ({ row }) => row.original.plan ?? "—",
    },
    {
      accessorKey: "categoria",
      header: "Categoría",
      meta: { className: "hidden sm:table-cell" },
      cell: ({ row }) => row.original.categoria_edad && <Badge variant="outline" className="text-xs">{row.original.categoria_edad}</Badge>,
    },
    {
      accessorKey: "tipo_familia",
      header: "Tipo familia",
      meta: { className: "hidden md:table-cell text-sm text-muted-foreground" },
      cell: ({ row }) => row.original.tipo_familia ?? "—",
    },
    {
      accessorKey: "precio",
      header: "Precio",
      meta: { className: "font-mono font-semibold tabular-nums" },
      cell: ({ row }) => formatCurrency(row.original.precio),
    },
    {
      id: "acciones",
      header: "Acciones",
      enableSorting: false,
      meta: { className: "w-32" },
      cell: ({ row }) => {
        const item = row.original
        return (
          <div className="flex gap-1">
            <Button size="icon" variant="outline" className="size-8" title="Ver detalle" onClick={() => setDetalle(item)}>
              <Eye className="size-3.5" />
            </Button>
            <Button size="icon" className="size-8" title="Editar precio" onClick={() => abrirEditar(item)}>
              <Edit2 className="size-3.5" />
            </Button>
            <Button size="icon" variant="outline" className="size-8 text-destructive" title="Eliminar precio" onClick={() => eliminarPrecio(item)}>
              <Trash2 className="size-3.5" />
            </Button>
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
        <Select value={String(anio)} onValueChange={v => setAnio(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{YEAR_RANGE.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <Button variant="outline" size="icon" onClick={fetchPrecios} disabled={loading}><RefreshCw className="size-4" /></Button>
        <Button
          size="sm"
          disabled={!puedeCrearPrecio}
          title={puedeCrearPrecio ? undefined : "No se pudo cargar el catálogo de tipos de familia"}
          onClick={() => { nuevoForm.reset({ ...valoresVaciosNuevoPrecio, anio: String(anio) }); setNuevoModal(true) }}
        >
          <Plus className="size-3.5 mr-1" />Nuevo precio
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setPorcentaje(""); setPorcentajeModal("aumento") }}>
          <TrendingUp className="size-3.5 mr-1" />Aumentar
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setPorcentaje(""); setPorcentajeModal("descuento") }}>
          <TrendingDown className="size-3.5 mr-1" />Descuento
        </Button>
        <Button variant="outline" size="sm" onClick={exportarCSV}>
          <FileDown className="size-3.5 mr-1" />Exportar CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setImportFile(null); setImportarModal(true) }}>
          <Upload className="size-3.5 mr-1" />Importar CSV
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <Select value={filtroPlan || "all"} onValueChange={v => setFiltroPlan(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todos los planes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los planes</SelectItem>
            {planes.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroCategoria || "all"} onValueChange={v => setFiltroCategoria(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categorias.map(c => <SelectItem key={c.id} value={c.nombre}>{c.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        {tiposFamilia.length > 0 && (
          <Select value={filtroTipoFamilia || "all"} onValueChange={v => setFiltroTipoFamilia(v === "all" ? "" : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Tipo familia" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {tiposFamilia.map(t => <SelectItem key={t.id} value={t.nombre}>{t.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <span className="text-xs text-muted-foreground self-center">{filtrados.length} registros</span>
      </div>

      {/* Tabla */}
      {loading ? <Skeleton className="h-64 w-full rounded-lg" /> : (
        <DataTable columns={columns} data={filtrados} emptyMessage="Sin registros" />
      )}

      {/* Modal nuevo precio (POST /admin/lista-precios) */}
      <Dialog open={nuevoModal} onOpenChange={setNuevoModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nuevo precio</DialogTitle></DialogHeader>
          <Form {...nuevoForm}>
            <form className="space-y-3" onSubmit={nuevoForm.handleSubmit(crearPrecio)}>
              <FormField control={nuevoForm.control} name="plan_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan *</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar plan" /></SelectTrigger>
                      <SelectContent>
                        {planes.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={nuevoForm.control} name="categoria_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría *</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                      <SelectContent>
                        {categorias.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={nuevoForm.control} name="tipo_familia_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de familia *</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                      <SelectContent>
                        {tiposFamilia.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={nuevoForm.control} name="precio" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio ($) *</FormLabel>
                    <FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={nuevoForm.control} name="anio" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Año *</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {YEAR_RANGE.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNuevoModal(false)} disabled={guardando}>Cancelar</Button>
                <Button type="submit" disabled={guardando}>{guardando ? "Guardando..." : "Agregar"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal detalle de precio */}
      <Dialog open={!!detalle} onOpenChange={open => { if (!open) setDetalle(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Detalle del precio</DialogTitle></DialogHeader>
          {detalle && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {([
                ["ID", String(detalle.id)],
                ["Plan", detalle.plan ?? "—"],
                ["Categoría", detalle.categoria_edad ?? "—"],
                ["Tipo de familia", detalle.tipo_familia ?? "—"],
                ["Año", String(detalle.anio)],
                ["Precio", formatCurrency(detalle.precio)],
              ] as const).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          <DialogFooter>
            <Button onClick={() => setDetalle(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal editar precio */}
      <Dialog open={editModal} onOpenChange={setEditModal}>
          <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader><DialogTitle>Editar precio</DialogTitle></DialogHeader>
          {editItem && (
            <div className="space-y-3">
              <div className="rounded-lg bg-paper-sunk p-3 text-sm">
                <p><span className="text-muted-foreground">Plan:</span> {editItem.plan}</p>
                {editItem.categoria_edad && <p><span className="text-muted-foreground">Categoría:</span> {editItem.categoria_edad}</p>}
                {editItem.tipo_familia && <p><span className="text-muted-foreground">Tipo familia:</span> {editItem.tipo_familia}</p>}
              </div>
              <div className="space-y-1">
                <Label>Precio ($) *</Label>
                <Input type="number" min="0" step="0.01" value={editPrecio} onChange={e => setEditPrecio(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="destructive" onClick={() => setEditModal(false)}>Cancelar</Button>
            <Button onClick={guardarEdicion} disabled={guardando}>{guardando ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal porcentaje */}
      <Dialog open={!!porcentajeModal} onOpenChange={open => { if (!open) setPorcentajeModal(null) }}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{porcentajeModal === "aumento" ? "Aplicar aumento" : "Aplicar descuento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Se aplicará a <strong>todos los precios del año {anio}</strong>.</p>
            <div className="space-y-1">
              <Label>Porcentaje (%)</Label>
              <Input type="number" min="0.01" max="100" step="0.01" placeholder="Ej: 10" value={porcentaje} onChange={e => setPorcentaje(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => setPorcentajeModal(null)}>Cancelar</Button>
            <Button onClick={() => porcentajeModal && aplicarPorcentaje(porcentajeModal)} disabled={guardando || !porcentaje}>
              {guardando ? "Aplicando..." : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Modal importar CSV */}
      <Dialog open={importarModal} onOpenChange={open => { setImportarModal(open); if (!open) setImportFile(null) }}>
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="size-4" />Importar CSV</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">El archivo CSV debe tener las columnas: <code>plan_id, categoria, tipo_familia, precio</code>. Se importará al año <strong>{anio}</strong>.</p>
            <div className="space-y-1">
              <Label>Archivo CSV</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-primary file:text-primary-foreground cursor-pointer"
                onChange={e => setImportFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {importFile && <p className="text-xs text-muted-foreground">{importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</p>}
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={descargarTemplate}>
              <FileDown className="size-3 mr-1" />Descargar template CSV
            </Button>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => setImportarModal(false)}>Cancelar</Button>
            <Button onClick={importarCSV} disabled={importando || !importFile}>{importando ? "Importando..." : "Importar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
