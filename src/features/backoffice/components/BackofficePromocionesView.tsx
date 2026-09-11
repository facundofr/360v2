import { useEffect, useMemo, useState } from "react"
import { useConfirm } from "@/components/common/confirm-dialog"
import axios from "axios"
import { toast } from "sonner"
import { Search, Plus, Edit, Trash2, ToggleLeft, ToggleRight, RefreshCw, Tag, CheckCircle2, XCircle, Percent } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Promocion {
  id?: number | null
  nombre: string
  descripcion?: string
  descuento_porcentaje?: number
  /** ENUM backend `descuento`|`incremento`, default `descuento` — el UPDATE siempre
   * sobreescribe la columna, así que hay que mandarla en cada guardado o una promoción
   * "incremento" se convierte silenciosamente en "descuento" al editarla. */
  tipo?: "descuento" | "incremento"
  activa?: boolean
  fecha_creacion?: string
}

const initialForm: Promocion = {
  id: null, nombre: "", descripcion: "", descuento_porcentaje: 0, tipo: "descuento", activa: true
}

const fmtFecha = (f?: string) => {
  if (!f) return "—"
  try { return new Date(f).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) }
  catch { return "—" }
}

export function BackofficePromocionesView() {
  const confirm = useConfirm()
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [soloActivas, setSoloActivas] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [savingToggle, setSavingToggle] = useState<number | null>(null)

  const getAuth = () => ({ Authorization: `Bearer ${getAuthToken()}` })

  const fetchPromociones = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API_URL}/backoffice/promociones`, { headers: getAuth() })
      setPromociones(data?.data ?? data ?? [])
    } catch { toast.error("Error al cargar promociones") }
    finally { setLoading(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchPromociones() }, [])

  const filtradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase()
    return promociones
      .filter(p => !soloActivas || p.activa)
      .filter(p => !term || p.nombre?.toLowerCase().includes(term) || p.descripcion?.toLowerCase().includes(term) || String(p.descuento_porcentaje ?? "").includes(term))
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
  }, [promociones, busqueda, soloActivas])

  const abrirNueva = () => { setFormData(initialForm); setError(""); setShowModal(true) }
  const abrirEditar = (p: Promocion) => {
    setFormData({ id: p.id, nombre: p.nombre, descripcion: p.descripcion ?? "", descuento_porcentaje: p.descuento_porcentaje ?? 0, tipo: p.tipo ?? "descuento", activa: p.activa ?? true })
    setError(""); setShowModal(true)
  }

  const validar = () => {
    if (!formData.nombre?.trim()) return "El nombre es obligatorio"
    if (!formData.descripcion?.trim()) return "La descripción es obligatoria"
    const d = Number(formData.descuento_porcentaje)
    if (isNaN(d) || d < 0 || d > 100) return "El descuento debe ser entre 0% y 100%"
    return ""
  }

  const guardar = async () => {
    const err = validar()
    if (err) { setError(err); return }
    setSaving(true)
    try {
      const payload = { nombre: formData.nombre?.trim(), descripcion: formData.descripcion?.trim(), descuento_porcentaje: Number(formData.descuento_porcentaje), tipo: formData.tipo ?? "descuento", activa: formData.activa }
      if (formData.id) {
        await axios.put(`${API_URL}/backoffice/promociones/${formData.id}`, payload, { headers: getAuth() })
        toast.success("Promoción actualizada")
      } else {
        await axios.post(`${API_URL}/backoffice/promociones`, payload, { headers: getAuth() })
        toast.success("Promoción creada")
      }
      setShowModal(false)
      fetchPromociones()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Error al guardar"
      toast.error(msg)
    } finally { setSaving(false) }
  }

  const eliminar = async (p: Promocion) => {
    const ok = await confirm({
      title: `¿Eliminar la promoción "${p.nombre}"?`,
      description: "Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      destructive: true,
    })
    if (!ok) return
    try {
      await axios.delete(`${API_URL}/backoffice/promociones/${p.id}`, { headers: getAuth() })
      toast.success("Promoción eliminada")
      fetchPromociones()
    } catch { toast.error("Error al eliminar") }
  }

  const toggleActiva = async (p: Promocion) => {
    setSavingToggle(p.id ?? null)
    try {
      await axios.put(`${API_URL}/backoffice/promociones/${p.id}`, { ...p, activa: !p.activa }, { headers: getAuth() })
      toast.success(`Promoción ${p.activa ? "desactivada" : "activada"}`)
      setPromociones(prev => prev.map(pr => pr.id === p.id ? { ...pr, activa: !p.activa } : pr))
    } catch { toast.error("Error al cambiar estado") }
    finally { setSavingToggle(null) }
  }

  const columns = useMemo<ColumnDef<Promocion>[]>(() => [
    { accessorKey: "nombre", header: "Nombre", cell: ({ row }) => <span className="font-medium text-sm">{row.original.nombre}</span> },
    {
      accessorKey: "descripcion",
      header: "Descripción",
      meta: { className: "hidden sm:table-cell text-sm text-muted-foreground max-w-[200px] truncate" },
      cell: ({ row }) => row.original.descripcion ?? "—",
    },
    {
      accessorKey: "descuento_porcentaje",
      header: "Descuento",
      meta: { className: "text-center", headerClassName: "text-center" },
      cell: ({ row }) => row.original.descuento_porcentaje !== undefined
        ? <Badge variant={row.original.tipo === "incremento" ? "risk" : "ok"}>{row.original.tipo === "incremento" ? "+" : "-"}{row.original.descuento_porcentaje}%</Badge>
        : "—",
    },
    {
      accessorKey: "tipo",
      header: "Tipo",
      cell: ({ row }) => <Badge variant="outline">{row.original.tipo === "incremento" ? "Incremento" : "Descuento"}</Badge>,
    },
    {
      accessorKey: "activa",
      header: "Estado",
      cell: ({ row }) => <Badge variant={row.original.activa ? "ok" : "secondary"}>{row.original.activa ? "Activa" : "Inactiva"}</Badge>,
    },
    {
      accessorKey: "fecha_creacion",
      header: "Creada",
      meta: { className: "hidden md:table-cell text-xs text-muted-foreground" },
      cell: ({ row }) => fmtFecha(row.original.fecha_creacion),
    },
    {
      id: "acciones",
      header: "Acciones",
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original
        return (
          <div className="flex gap-1">
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" className="size-8" aria-label="Editar promoción" onClick={() => abrirEditar(p)}><Edit className="size-3.5" aria-hidden="true" /></Button>
            </TooltipTrigger><TooltipContent>Editar</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon"
                variant="outline" className="size-8"
                aria-label={p.activa ? "Desactivar promoción" : "Activar promoción"}
                disabled={savingToggle === p.id}
                onClick={() => toggleActiva(p)}>
                {p.activa ? <ToggleRight className="size-3.5" aria-hidden="true" /> : <ToggleLeft className="size-3.5" aria-hidden="true" />}
              </Button>
            </TooltipTrigger><TooltipContent>{p.activa ? "Desactivar" : "Activar"}</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="destructive" className="size-8" aria-label="Eliminar promoción" onClick={() => eliminar(p)}><Trash2 className="size-3.5" aria-hidden="true" /></Button>
            </TooltipTrigger><TooltipContent>Eliminar</TooltipContent></Tooltip>
          </div>
        )
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [savingToggle])

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="rounded-full bg-muted p-4"><Tag className="size-8 text-muted-foreground" aria-hidden="true" /></div>
      <div>
        <p className="font-medium text-sm">Sin promociones</p>
        <p className="text-xs text-muted-foreground mt-1">{busqueda || soloActivas ? "No hay resultados para los filtros aplicados" : "Aún no hay promociones creadas"}</p>
      </div>
      {!busqueda && !soloActivas && <Button size="sm" onClick={abrirNueva}><Plus className="size-3.5 mr-1" aria-hidden="true" />Crear primera promoción</Button>}
    </div>
  )

  return (
    <TooltipProvider>
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Promociones</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Descuentos y campañas comerciales aplicables a cotizaciones</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="icon" className="size-8" aria-label="Actualizar promociones" onClick={fetchPromociones}><RefreshCw className="size-3.5" aria-hidden="true" /></Button>
          <Button size="sm" onClick={abrirNueva}><Plus className="size-3.5 mr-1.5" aria-hidden="true" />Nueva promoción</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-3 p-4">
              <div className="rounded-lg p-2.5 bg-muted"><Tag className="size-5 text-muted-foreground" aria-hidden="true" /></div>
              <div>
                <p className="text-2xl font-bold tabular-nums leading-none">{promociones.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-3 p-4">
              <div className="rounded-lg p-2.5 bg-state-ok-soft"><CheckCircle2 className="size-5 text-state-ok-text" aria-hidden="true" /></div>
              <div>
                <p className="text-2xl font-bold tabular-nums leading-none text-state-ok-text">{promociones.filter(p => p.activa).length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Activas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-3 p-4">
              <div className="rounded-lg p-2.5 bg-gray-50"><XCircle className="size-5 text-gray-500" aria-hidden="true" /></div>
              <div>
                <p className="text-2xl font-bold tabular-nums leading-none text-muted-foreground">{promociones.filter(p => !p.activa).length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Inactivas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
          <Input className="pl-9 h-9" placeholder="Buscar por nombre o descripción…" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="soloActivas" checked={soloActivas} onCheckedChange={v => setSoloActivas(!!v)} />
          <Label htmlFor="soloActivas" className="text-sm cursor-pointer select-none">Solo activas</Label>
        </div>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {loading ? <Skeleton className="h-48 w-full" /> : (
            <div className="p-4">
              <DataTable columns={columns} data={filtradas} emptyMessage={emptyState} hideColumnToggle />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Crear / Editar */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg lg:max-w-xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{formData.id ? <><Edit className="inline size-4 mr-2" />Editar promoción</> : <><Plus className="inline size-4 mr-2" />Nueva promoción</>}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            {error && <p className="text-sm text-state-risk-text bg-state-risk-soft border border-state-risk/30 rounded-md p-3">{error}</p>}
            <div>
              <Label className="text-sm mb-1.5 block">Nombre *</Label>
              <Input placeholder="Ej: Descuento verano" value={formData.nombre ?? ""} onChange={e => setFormData(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Descripción *</Label>
              <Textarea rows={3} placeholder="Descripción de la promoción..." value={formData.descripcion ?? ""} onChange={e => setFormData(f => ({ ...f, descripcion: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">Usa texto claro y directo para describir el beneficio.</p>
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Tipo de promoción</Label>
              <Select value={formData.tipo ?? "descuento"} onValueChange={v => setFormData(f => ({ ...f, tipo: v as "descuento" | "incremento" }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="descuento">Descuento (resta al precio)</SelectItem>
                  <SelectItem value="incremento">Incremento (suma al precio)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">{formData.tipo === "incremento" ? "Incremento (%)" : "Descuento (%)"}</Label>
              <div className="flex items-center gap-3">
                <Input type="number" min={0} max={100} step={1} value={formData.descuento_porcentaje ?? 0}
                  onChange={e => setFormData(f => ({ ...f, descuento_porcentaje: Number(e.target.value) }))} className="flex-1" />
                {(formData.descuento_porcentaje ?? 0) > 0 && (
                  <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 ${formData.tipo === "incremento" ? "border-state-risk/30 bg-state-risk-soft" : "border-state-ok/30 bg-state-ok-soft"}`}>
                    <Percent className={`size-4 ${formData.tipo === "incremento" ? "text-state-risk-text" : "text-state-ok-text"}`} />
                    <span className={`font-bold text-lg ${formData.tipo === "incremento" ? "text-state-risk-text" : "text-state-ok-text"}`}>{formData.tipo === "incremento" ? "+" : "-"}{formData.descuento_porcentaje}</span>
                    <span className={`text-xs ${formData.tipo === "incremento" ? "text-state-risk-text" : "text-state-ok-text"}`}>{formData.tipo === "incremento" ? "de incremento" : "de descuento"}</span>
                  </div>
                )}
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-2">
              <Checkbox id="activaCheck" checked={formData.activa ?? true} onCheckedChange={v => setFormData(f => ({ ...f, activa: !!v }))} />
              <Label htmlFor="activaCheck" className="text-sm cursor-pointer">Promoción activa (visible para vendedores)</Label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="destructive" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button onClick={guardar} disabled={saving}>{saving ? "Guardando..." : formData.id ? "Actualizar" : "Crear promoción"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  )
}
