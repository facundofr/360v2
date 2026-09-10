import { useState, useEffect, useCallback, useMemo } from "react"
import { useConfirm } from "@/components/common/confirm-dialog"
import axios from "axios"
import { toast } from "sonner"
import {
  Search, RefreshCw, Eye, Filter, ArrowLeftRight, ChevronLeft, ChevronRight,
  FileText, DollarSign, Phone, Mail, LayoutGrid, LayoutList, MessageCircle,
  User, MoreVertical, Recycle, Edit, MessagesSquare
} from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { ConversacionWhatsappModal } from "@/components/common/ConversacionWhatsappModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "@/components/ui/data-table"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { getBadgeEstado, estadosConfig } from "@/utils/estadosHelper"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Prospecto {
  id: number
  nombre: string
  apellido: string
  telefono?: string
  email?: string
  estado?: string
  vendedor_nombre?: string
  vendedor_apellido?: string
  vendedor_id?: number
  supervisor_nombre?: string
  edad?: number
  created_at?: string
  localidad?: string
  provincia?: string
  fecha_nacimiento?: string
  notas?: string
  es_reciclado?: boolean | number
  fecha_asignacion?: string
  fecha_estado?: string
  fecha_registro?: string
  asignacion_fecha?: string
}

interface Cotizacion {
  id: number
  plan_nombre?: string
  plan_id?: number
  tipo_afiliacion_nombre?: string
  total_bruto?: number | string
  total_descuento_aporte?: number | string
  total_descuento_promocion?: number | string
  total_final?: number | string
  total_descuento?: number | string
  anio?: number
  fecha?: string
  created_at?: string
  detalles?: CotizacionDetalle[]
}

interface CotizacionDetalle {
  id?: number
  persona?: string
  vinculo?: string
  edad?: number
  tipo_afiliacion?: string
  precio_base?: number | string
  descuento_aporte?: number | string
  promocion_aplicada?: string
  descuento_promocion?: number | string
  precio_final?: number | string
}

interface HistorialItem {
  id?: number
  accion?: string
  descripcion?: string
  fecha?: string
  created_at?: string
  usuario_nombre?: string
  usuario?: string
}

interface Vendedor {
  id: number
  first_name: string
  last_name: string
}

// Antes tenía 15 valores inventados sin tilde (p.ej. "Calificado Cotizacion")
// que no coinciden con ningún estado real de `prospectos.estado` — el filtro y
// el cambio de estado nunca hacían match. Única fuente de verdad: estadosHelper,
// más "prueba interna" que el backend acepta (`adminController.js` estadosValidos)
// pero no tiene estilo propio en estadosConfig.
const ESTADOS = [...Object.keys(estadosConfig), "prueba interna"]

const ITEMS_POR_PAGINA = 20

const formatFecha = (fecha?: string | null) => {
  if (!fecha) return "-"
  const mDateTime = fecha.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (mDateTime) return `${mDateTime[3]}/${mDateTime[2]}/${mDateTime[1]} ${mDateTime[4]}:${mDateTime[5]}`
  const mDate = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (mDate) return `${mDate[3]}/${mDate[2]}/${mDate[1]}`
  return fecha
}

const formatCurrency = (val?: number | string) => {
  if (val == null) return "$0"
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(val))
}

export default function ProspectosAdmin() {
  const confirm = useConfirm()
  const [prospectos, setProspectos] = useState<Prospecto[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("todos")
  const [filtroVendedor, setFiltroVendedor] = useState("todos")
  const [pagina, setPagina] = useState(1)
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [vista, setVista] = useState<"tabla" | "cards">("tabla")

  // Modal detalle
  const [detalleModal, setDetalleModal] = useState<{ open: boolean; prospecto: Prospecto | null }>({ open: false, prospecto: null })

  // Modal historial
  const [historialModal, setHistorialModal] = useState<{ open: boolean; prospecto: Prospecto | null }>({ open: false, prospecto: null })
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)

  // Modal cotizaciones
  const [cotizacionesModal, setCotizacionesModal] = useState<{ open: boolean; prospecto: Prospecto | null }>({ open: false, prospecto: null })
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [loadingCotizaciones, setLoadingCotizaciones] = useState(false)
  const [showDetallesCotizacion, setShowDetallesCotizacion] = useState<Record<number, boolean>>({})
  const [recalculandoCotizacion, setRecalculandoCotizacion] = useState<number | null>(null)

  // Modal reasignar
  const [reasignarModal, setReasignarModal] = useState<{ open: boolean; prospecto: Prospecto | null }>({ open: false, prospecto: null })
  const [conversacionModal, setConversacionModal] = useState<{ open: boolean; prospecto: Prospecto | null }>({ open: false, prospecto: null })
  const [nuevoVendedorId, setNuevoVendedorId] = useState("")

  // Modal cambio de estado
  const [estadoModal, setEstadoModal] = useState<{ open: boolean; prospecto: Prospecto | null }>({ open: false, prospecto: null })
  const [nuevoEstado, setNuevoEstado] = useState("")
  const [notasEstado, setNotasEstado] = useState("")

  const getHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` })

  const toggleDetallesCotizacion = (index: number) => {
    setShowDetallesCotizacion(prev => ({ ...prev, [index]: !prev[index] }))
  }

  const handleRecalcularCotizacion = async (cot: Cotizacion) => {
    const ok = await confirm({
      title: "¿Recalcular esta cotización?",
      description: "Se actualizarán los precios con los valores actuales del sistema. Los integrantes y las promociones vigentes se mantienen.",
      confirmText: "Recalcular",
    })
    if (!ok) return
    setRecalculandoCotizacion(cot.id)
    try {
      const { data } = await axios.post(`${API_URL}/cotizaciones/${cot.id}/recalcular`, {}, { headers: getHeaders() })
      if (data.success) {
        toast.success('Cotizacion actualizada correctamente')
        if (cotizacionesModal.prospecto) await abrirCotizaciones(cotizacionesModal.prospecto)
      } else {
        toast.error(data.message ?? 'No se pudo recalcular la cotizacion')
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err.response?.data?.message ?? 'Error al recalcular la cotizacion')
    } finally {
      setRecalculandoCotizacion(null)
    }
  }

  const fetchProspectos = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API_URL}/admin/prospectos/all`, { headers: getHeaders() })
      setProspectos(data?.data ?? data ?? [])
    } catch {
      toast.error("Error al cargar prospectos")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchVendedores = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/admin/vendedores`, { headers: getHeaders() })
      setVendedores(data?.data ?? data ?? [])
    } catch {
      console.error("Error al cargar vendedores")
    }
  }, [])

  useEffect(() => {
    fetchProspectos()
    fetchVendedores()
    const interval = setInterval(fetchProspectos, 30000)
    return () => clearInterval(interval)
  }, [fetchProspectos, fetchVendedores])

  const filtrados = prospectos.filter(p => {
    const vendedorNombre = [p.vendedor_nombre, p.vendedor_apellido].filter(Boolean).join(" ")
    const texto = `${p.nombre} ${p.apellido} ${p.telefono ?? ""} ${p.email ?? ""} ${vendedorNombre}`.toLowerCase()
    if (busqueda && !texto.includes(busqueda.toLowerCase())) return false
    if (filtroEstado !== "todos" && p.estado !== filtroEstado) return false
    if (filtroVendedor !== "todos" && String(p.vendedor_id) !== filtroVendedor) return false
    return true
  })

  const totalPaginas = Math.ceil(filtrados.length / ITEMS_POR_PAGINA) || 1
  const paginaActual = filtrados.slice((pagina - 1) * ITEMS_POR_PAGINA, pagina * ITEMS_POR_PAGINA)

  const abrirDetalle = (p: Prospecto) => setDetalleModal({ open: true, prospecto: p })

  const abrirHistorial = async (p: Prospecto) => {
    setHistorialModal({ open: true, prospecto: p })
    setLoadingHistorial(true)
    try {
      const { data } = await axios.get(`${API_URL}/admin/prospectos/${p.id}/historial`, { headers: getHeaders() })
      setHistorial(data?.data ?? data ?? [])
    } catch {
      setHistorial([])
    } finally {
      setLoadingHistorial(false)
    }
  }

  const abrirCotizaciones = async (p: Prospecto) => {
    setCotizacionesModal({ open: true, prospecto: p })
    setLoadingCotizaciones(true)
    setCotizaciones([])
    try {
      const { data } = await axios.get(`${API_URL}/admin/prospectos/${p.id}/cotizaciones`, { headers: getHeaders() })
      const raw: Cotizacion[] = Array.isArray(data) ? data : (data?.data ?? [])
      if (raw.length > 0 && raw[0].plan_nombre) {
        setCotizaciones(raw)
      } else {
        const mapa: Record<number, Cotizacion> = {}
        for (const row of raw) {
          const pid = row.plan_id ?? row.id
          if (!pid) continue
          if (!mapa[pid]) {
            mapa[pid] = { id: row.id, plan_nombre: row.plan_nombre, total_bruto: row.total_bruto, total_descuento_aporte: row.total_descuento_aporte, total_descuento_promocion: row.total_descuento_promocion, total_final: row.total_final, anio: row.anio, detalles: [] }
          }
          mapa[pid].detalles?.push(row as unknown as CotizacionDetalle)
        }
        setCotizaciones(Object.values(mapa))
      }
    } catch {
      setCotizaciones([])
    } finally {
      setLoadingCotizaciones(false)
    }
  }

  const abrirWhatsApp = (p: Prospecto) => {
    if (!p.telefono) { toast.error("Sin numero de Telefono"); return }
    const numero = p.telefono.replace(/\D/g, "")
    window.open(`https://wa.me/${numero}`, "_blank")
  }

  const reasignar = async () => {
    if (!reasignarModal.prospecto || !nuevoVendedorId) return
    try {
      await axios.put(`${API_URL}/admin/prospectos/${reasignarModal.prospecto.id}/reasignar`, { nuevo_vendedor_id: Number(nuevoVendedorId) }, { headers: getHeaders() })
      toast.success("Prospecto reasignado")
      setReasignarModal({ open: false, prospecto: null })
      fetchProspectos()
    } catch {
      toast.error("Error al reasignar")
    }
  }

  const cambiarEstado = async () => {
    if (!estadoModal.prospecto || !nuevoEstado) return
    try {
      await axios.patch(`${API_URL}/admin/prospectos/${estadoModal.prospecto.id}/estado`, { estado: nuevoEstado, notas: notasEstado.trim() || undefined }, { headers: getHeaders() })
      toast.success("Estado actualizado")
      setEstadoModal({ open: false, prospecto: null })
      setNotasEstado("")
      fetchProspectos()
    } catch {
      toast.error("Error al cambiar estado")
    }
  }

  const getVendedorLabel = (p: Prospecto) => {
    if (p.vendedor_nombre && p.vendedor_apellido) return `${p.vendedor_nombre} ${p.vendedor_apellido}`
    return p.vendedor_nombre ?? "Sin asignar"
  }

  const getFechaDisplay = (p: Prospecto) =>
    p.fecha_asignacion ?? p.fecha_estado ?? p.asignacion_fecha ?? p.fecha_registro ?? p.created_at

  const AccionesBotones = ({ p }: { p: Prospecto }) => (
    <div className="flex gap-1 flex-wrap">
      <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => abrirDetalle(p)} title="Ver detalle">
        <Eye className="size-3.5" />
      </Button>
      <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => abrirHistorial(p)} title="Historial">
        <FileText className="size-3.5" />
      </Button>
      <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => abrirCotizaciones(p)} title="Cotizaciones">
        <DollarSign className="size-3.5" />
      </Button>
      {/* Ver la conversación registrada en el sistema (no abre wa.me) */}
      <Button
        size="icon"
        className="size-8 bg-muted text-foreground border hover:bg-accent"
        onClick={() => setConversacionModal({ open: true, prospecto: p })}
        title="Ver conversación de WhatsApp"
      >
        <MessagesSquare className="size-3.5" />
      </Button>
      <Button size="icon" className="size-8 bg-green-500 hover:bg-green-600 text-white border-0" onClick={() => abrirWhatsApp(p)} title="Abrir WhatsApp">
        <MessageCircle className="size-3.5" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" className="size-8 bg-muted hover:bg-muted/80 text-foreground border">
            <MoreVertical className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => { setEstadoModal({ open: true, prospecto: p }); setNuevoEstado(p.estado ?? ""); setNotasEstado("") }}>
            <Edit className="size-3 mr-2" /> Cambiar estado
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setReasignarModal({ open: true, prospecto: p }); setNuevoVendedorId("") }}>
            <ArrowLeftRight className="size-3 mr-2" /> Reasignar vendedor
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  const columns = useMemo<ColumnDef<Prospecto>[]>(() => [
    {
      id: "prospecto",
      header: "Prospecto",
      meta: { className: "min-w-[150px]" },
      accessorFn: (p) => `${p.nombre} ${p.apellido}`,
      cell: ({ row }) => (
        <>
          <div className="font-semibold text-sm leading-tight">{row.original.nombre} {row.original.apellido}</div>
          <div className="text-xs text-muted-foreground">ID: {row.original.id}</div>
        </>
      ),
    },
    {
      id: "vendedor",
      header: "Vendedor",
      meta: { className: "min-w-[130px]" },
      accessorFn: (p) => getVendedorLabel(p),
      cell: ({ row }) => {
        const label = getVendedorLabel(row.original)
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold max-w-[120px] truncate ${row.original.vendedor_id ? "bg-state-ok-soft text-state-ok-text" : "bg-state-warn-soft text-state-warn-text"}`}>
            {label.length > 14 ? label.slice(0, 14) + "..." : label}
          </span>
        )
      },
    },
    {
      id: "contacto",
      header: "Contacto",
      enableSorting: false,
      meta: { className: "min-w-[160px]" },
      cell: ({ row }) => (
        <div className="space-y-0.5 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Phone className="size-3 shrink-0" />
            <span className="truncate max-w-[110px]">{row.original.telefono ?? "-"}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Mail className="size-3 shrink-0" />
            <span className="truncate max-w-[110px]">{row.original.email ?? "-"}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "estado",
      header: "Estado",
      meta: { className: "min-w-[110px]" },
      cell: ({ row }) => getBadgeEstado(row.original.estado ?? ""),
    },
    {
      accessorKey: "edad",
      header: "Edad",
      meta: { className: "w-16 text-center", headerClassName: "text-center" },
      cell: ({ row }) => <span className="text-xs bg-muted rounded px-1.5 py-0.5">{row.original.edad ?? "-"}</span>,
    },
    {
      accessorKey: "es_reciclado",
      header: "Reciclado",
      meta: { className: "w-24 text-center", headerClassName: "text-center" },
      cell: ({ row }) => (
        row.original.es_reciclado ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
            <Recycle className="size-3" /> Refrito
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )
      ),
    },
    {
      id: "fecha",
      header: "Fecha",
      meta: { className: "min-w-[140px] text-xs text-muted-foreground whitespace-nowrap" },
      accessorFn: (p) => getFechaDisplay(p),
      cell: ({ row }) => formatFecha(getFechaDisplay(row.original)),
    },
    {
      id: "acciones",
      header: "Acciones",
      enableSorting: false,
      meta: { className: "min-w-[190px]" },
      cell: ({ row }) => <AccionesBotones p={row.original} />,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  return (
    <div className="space-y-4">
      {/* Barra de filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar prospecto, vendedor..." value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1) }} />
        </div>
        <Select value={filtroEstado} onValueChange={v => { setFiltroEstado(v); setPagina(1) }}>
          <SelectTrigger className="w-44"><Filter className="size-3 mr-1" /><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroVendedor} onValueChange={v => { setFiltroVendedor(v); setPagina(1) }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Vendedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los vendedores</SelectItem>
            {vendedores.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.first_name} {v.last_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchProspectos} title="Actualizar"><RefreshCw className="size-4" /></Button>
        <div className="flex border rounded-md overflow-hidden">
          <Button variant={vista === "tabla" ? "default" : "ghost"} size="icon" className="size-9 rounded-none" onClick={() => setVista("tabla")} title="Vista tabla"><LayoutList className="size-4" /></Button>
          <Button variant={vista === "cards" ? "default" : "ghost"} size="icon" className="size-9 rounded-none" onClick={() => setVista("cards")} title="Vista cards"><LayoutGrid className="size-4" /></Button>
        </div>
        <span className="text-xs text-muted-foreground">{filtrados.length} prospectos</span>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : (
        <>
          {/* ---- VISTA TABLA ---- */}
          {vista === "tabla" && (
            <DataTable columns={columns} data={filtrados} emptyMessage="Sin resultados" />
          )}

          {/* ---- VISTA CARDS ---- */}
          {vista === "cards" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {paginaActual.map(p => (
                <div key={p.id} className="rounded-lg border bg-card p-4 space-y-3 hover:bg-paper-sunk transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{p.nombre} {p.apellido}</p>
                      <p className="text-xs text-muted-foreground">ID: {p.id}</p>
                    </div>
                    {p.es_reciclado && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium shrink-0">
                        <Recycle className="size-3" /> Refrito
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Phone className="size-3 shrink-0" />
                      <span className="truncate">{p.telefono ?? "-"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mail className="size-3 shrink-0" />
                      <span className="truncate">{p.email ?? "-"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="size-3 shrink-0" />
                      <span className="truncate">{getVendedorLabel(p)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {getBadgeEstado(p.estado ?? "")}
                    {p.edad != null && (
                      <span className="text-xs bg-muted rounded px-1.5 py-0.5">{p.edad} anos</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatFecha(getFechaDisplay(p))}</p>
                  <AccionesBotones p={p} />
                </div>
              ))}
              {paginaActual.length === 0 && (
                <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Sin resultados</div>
              )}
            </div>
          )}

          {/* Paginacion — sólo para la vista de tarjetas: la tabla pagina con DataTable */}
          {vista === "cards" && totalPaginas > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Mostrando {(pagina - 1) * ITEMS_POR_PAGINA + 1}-{Math.min(pagina * ITEMS_POR_PAGINA, filtrados.length)} de {filtrados.length}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="size-8" disabled={pagina === 1} onClick={() => setPagina(1)} title="Primera">
                  <ChevronLeft className="size-3" /><ChevronLeft className="size-3 -ml-2" />
                </Button>
                <Button variant="outline" size="icon" className="size-8" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}><ChevronLeft className="size-4" /></Button>
                <span className="text-xs px-2">{pagina} / {totalPaginas}</span>
                <Button variant="outline" size="icon" className="size-8" disabled={pagina === totalPaginas} onClick={() => setPagina(p => p + 1)}><ChevronRight className="size-4" /></Button>
                <Button variant="outline" size="icon" className="size-8" disabled={pagina === totalPaginas} onClick={() => setPagina(totalPaginas)} title="Ášltima">
                  <ChevronRight className="size-3" /><ChevronRight className="size-3 -ml-2" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== Modal Detalle ===== */}
      <Dialog open={detalleModal.open} onOpenChange={open => setDetalleModal({ open, prospecto: open ? detalleModal.prospecto : null })}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <User className="size-4" />
              Detalles del Prospecto
            </DialogTitle>
          </DialogHeader>
          {detalleModal.prospecto && (
            <div className="space-y-3">
              {/* Fila 1: Personal + Contacto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Información Personal */}
                <div className="rounded-lg border overflow-hidden">
                  <div className="p-4 space-y-2">
                    <p className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
                      <User className="size-3.5" /> Informacion Personal
                    </p>
                    <div className="space-y-1.5 text-sm">
                      <p><span className="font-bold">Nombre:</span> {detalleModal.prospecto.nombre}</p>
                      <p><span className="font-bold">Apellido:</span> {detalleModal.prospecto.apellido}</p>
                      <p><span className="font-bold">Edad:</span> {detalleModal.prospecto.edad != null ? `${detalleModal.prospecto.edad} anos` : "No disponible"}</p>
                      <p><span className="font-bold">Fecha de Nacimiento:</span> {detalleModal.prospecto.fecha_nacimiento ?? "No disponible"}</p>
                    </div>
                  </div>
                </div>
                {/* Información de Contacto */}
                <div className="rounded-lg border overflow-hidden">
                  <div className="p-4 space-y-2">
                    <p className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="size-3.5" /> Informacion de Contacto
                    </p>
                    <div className="space-y-1.5 text-sm">
                      <p><span className="font-bold">Telefono:</span> {detalleModal.prospecto.telefono ?? "No disponible"}</p>
                      <p><span className="font-bold">Email:</span> {detalleModal.prospecto.email ?? "No disponible"}</p>
                      <p><span className="font-bold">Provincia:</span> {detalleModal.prospecto.provincia ?? "No disponible"}</p>
                      <p><span className="font-bold">Localidad:</span> {detalleModal.prospecto.localidad ?? "No disponible"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fila 2: Estado y Vendedor + Notas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Estado y Vendedor */}
                <div className="rounded-lg border overflow-hidden">
                  <div className="p-4 space-y-2">
                    <p className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
                      <User className="size-3.5" /> Estado y Vendedor
                    </p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">Estado:</span>
                        {getBadgeEstado(detalleModal.prospecto.estado ?? "")}
                      </div>
                      <p><span className="font-bold">Vendedor:</span> {getVendedorLabel(detalleModal.prospecto)}</p>
                      <p>
                        <span className="font-bold">
                          {detalleModal.prospecto.fecha_asignacion ? "Fecha de Asignacion:" : detalleModal.prospecto.fecha_estado ? "Fecha de Estado:" : "Fecha de Registro:"}
                        </span>{" "}
                        {formatFecha(getFechaDisplay(detalleModal.prospecto))}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Notas */}
                <div className="rounded-lg border overflow-hidden">
                  <div className="p-4 space-y-2">
                    <p className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground">
                      <MessageCircle className="size-3.5" /> Notas
                    </p>
                    <p className="text-sm">{detalleModal.prospecto.notas ?? "Sin notas registradas"}</p>
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-2 flex-wrap pt-1">
                <Button size="sm" variant="outline" onClick={() => { setEstadoModal({ open: true, prospecto: detalleModal.prospecto }); setNuevoEstado(detalleModal.prospecto?.estado ?? ""); setNotasEstado(""); setDetalleModal(s => ({ ...s, open: false })) }}>
                  <Edit className="size-3 mr-1" /> Cambiar estado
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setReasignarModal({ open: true, prospecto: detalleModal.prospecto }); setNuevoVendedorId(""); setDetalleModal(s => ({ ...s, open: false })) }}>
                  <ArrowLeftRight className="size-3 mr-1" /> Reasignar
                </Button>
                <Button size="sm" variant="outline" onClick={() => { abrirHistorial(detalleModal.prospecto!); setDetalleModal(s => ({ ...s, open: false })) }}>
                  <FileText className="size-3 mr-1" /> Historial
                </Button>
                <Button size="sm" variant="outline" onClick={() => { abrirCotizaciones(detalleModal.prospecto!); setDetalleModal(s => ({ ...s, open: false })) }}>
                  <DollarSign className="size-3 mr-1" /> Cotizaciones
                </Button>
                <div className="flex-1" />
                <Button size="sm" variant="destructive" onClick={() => setDetalleModal({ open: false, prospecto: null })}>
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Modal Historial ===== */}
      <Dialog open={historialModal.open} onOpenChange={open => setHistorialModal({ open, prospecto: open ? historialModal.prospecto : null })}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4" />
              Historial - {historialModal.prospecto?.nombre} {historialModal.prospecto?.apellido}
            </DialogTitle>
          </DialogHeader>
          {loadingHistorial ? (
            <Skeleton className="h-40 w-full" />
          ) : historial.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin historial registrado</p>
          ) : (
            <div className="space-y-2">
              {historial.map((h, i) => (
                <div key={h.id ?? i} className="text-xs bg-paper-sunk rounded-lg p-3 space-y-1">
                  <p className="font-semibold text-sm">{h.accion ?? h.descripcion ?? "Accion"}</p>
                  {h.descripcion && h.accion && <p className="text-muted-foreground">{h.descripcion}</p>}
                  <p className="text-muted-foreground">
                    {h.usuario_nombre ?? h.usuario ?? ""}
                    {(h.usuario_nombre || h.usuario) ? " - " : ""}
                    {formatFecha(h.fecha ?? h.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Modal Cotizaciones ===== */}
      <Dialog open={cotizacionesModal.open} onOpenChange={open => setCotizacionesModal({ open, prospecto: open ? cotizacionesModal.prospecto : null })}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="size-4" />
              Cotizaciones - {cotizacionesModal.prospecto?.nombre} {cotizacionesModal.prospecto?.apellido}
            </DialogTitle>
          </DialogHeader>
          {loadingCotizaciones ? (
            <Skeleton className="h-40 w-full" />
          ) : cotizaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin cotizaciones disponibles</p>
          ) : (
            <div className="space-y-4">
              {cotizaciones.map((cot, i) => {
                const descuento = (Number(cot.total_descuento_aporte ?? 0) + Number(cot.total_descuento_promocion ?? 0))
                const personas = cot.detalles?.length ?? 0
                const fecha = formatFecha(cot.fecha ?? cot.created_at)
                return (
                  <div key={cot.id ?? i} className="rounded-lg border overflow-hidden">
                    {/* Header */}
                    <div className="flex items-start justify-between px-4 pt-4 pb-3">
                      <div>
                        <p className="font-bold text-sm">{cot.plan_nombre ?? "Plan"}</p>
                        {cot.anio && <p className="text-xs text-muted-foreground">Ano: {cot.anio}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">{formatCurrency(cot.total_final)}</p>
                        <p className="text-xs text-muted-foreground">Total Final</p>
                      </div>
                    </div>
                    <div className="border-t" />
                    {/* Datos */}
                    <div className="grid grid-cols-4 gap-2 px-4 py-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Precio de Lista</p>
                        <p className="font-medium">{formatCurrency(cot.total_bruto)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Descuento</p>
                        <p className="font-medium">{formatCurrency(descuento)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Personas</p>
                        <p className="font-medium">{personas}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Fecha</p>
                        <p className="font-medium">{fecha}</p>
                      </div>
                    </div>
                    {/* Botones */}
                    <div className="flex gap-2 px-4 pb-4">
                      <Button size="sm" onClick={() => toggleDetallesCotizacion(i)}>
                        <Eye className="size-3 mr-1" /> Ver Detalles
                      </Button>
                      <Button size="sm" variant="outline" disabled={recalculandoCotizacion === cot.id} onClick={() => handleRecalcularCotizacion(cot)}>
                        <ArrowLeftRight className="size-3 mr-1" /> {recalculandoCotizacion === cot.id ? 'Actualizando...' : 'Actualizar Precios'}
                      </Button>
                    </div>
                    {/* Detalles / Integrantes */}
                    {showDetallesCotizacion[i] && cot.detalles && cot.detalles.length > 0 && (
                      <div className="border-t px-4 py-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Integrantes</p>
                        <div className="space-y-1">
                          {cot.detalles.map((d, di) => (
                            <div key={d.id ?? di} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{d.persona ?? d.vinculo ?? `Integrante ${di + 1}`}{d.edad ? ` (${d.edad} anos)` : ""}</span>
                              <span className="font-medium">{formatCurrency(d.precio_final)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Modal Reasignar ===== */}
      <Dialog open={reasignarModal.open} onOpenChange={open => setReasignarModal({ open, prospecto: open ? reasignarModal.prospecto : null })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reasignar prospecto</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Reasignando: <strong>{reasignarModal.prospecto?.nombre} {reasignarModal.prospecto?.apellido}</strong>
          </p>
          <div className="space-y-1">
            <Label>Nuevo vendedor</Label>
            <Select value={nuevoVendedorId} onValueChange={setNuevoVendedorId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {vendedores.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.first_name} {v.last_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasignarModal({ open: false, prospecto: null })}>Cancelar</Button>
            <Button onClick={reasignar} disabled={!nuevoVendedorId} className="bg-primary hover:bg-primary/90 text-primary-foreground">Reasignar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Modal Cambiar Estado ===== */}
      <Dialog open={estadoModal.open} onOpenChange={open => { setEstadoModal({ open, prospecto: open ? estadoModal.prospecto : null }); if (!open) setNotasEstado("") }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar estado</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Prospecto: <strong>{estadoModal.prospecto?.nombre} {estadoModal.prospecto?.apellido}</strong>
          </p>
          <div className="space-y-1">
            <Label>Nuevo estado</Label>
            <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Notas (opcional)</Label>
            <Textarea rows={3} placeholder="Motivo del cambio..." value={notasEstado} onChange={e => setNotasEstado(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEstadoModal({ open: false, prospecto: null })}>Cancelar</Button>
            <Button onClick={cambiarEstado} disabled={!nuevoEstado} className="bg-primary hover:bg-primary/90 text-primary-foreground">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conversación de WhatsApp del prospecto */}
      <ConversacionWhatsappModal
        open={conversacionModal.open}
        onOpenChange={(o) => setConversacionModal(m => ({ ...m, open: o }))}
        rol="admin"
        prospectoId={conversacionModal.prospecto?.id}
        telefono={conversacionModal.prospecto?.telefono}
        titulo={
          conversacionModal.prospecto
            ? `WhatsApp · ${conversacionModal.prospecto.nombre} ${conversacionModal.prospecto.apellido}`
            : undefined
        }
      />
    </div>
  )
}
