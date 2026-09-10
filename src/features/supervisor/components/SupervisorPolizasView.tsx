import { useEffect, useState, useCallback, useMemo } from "react"
import axios from "axios"
import { toast } from "sonner"
import {
  Search, Filter, RefreshCw, FileText,
  ChevronLeft, ChevronRight,
  History, MessageCircle, AlertCircle, CheckCircle2, FolderOpen, Download, Eye,
  Percent, LayoutGrid, List, ExternalLink, Loader2, FilePlus, Upload, Pencil
} from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { SubirDocumentosLibresModal } from "@/features/vendedor/components/SubirDocumentosLibresModal"
import { EditarPolizaModal } from "@/features/vendedor/components/EditarPolizaModal"
import DocumentPreviewModal from "@/components/modals/DocumentPreviewModal"
import { BotonEnviarFirma } from "@/components/buttons/BotonEnviarFirma"
import { BotonEliminarPoliza } from "@/components/buttons/BotonEliminarPoliza"
import { BadgeEstadoFirma } from "@/components/badges/BadgeEstadoFirma"
import { CargarPolizaFirmadaModal } from "@/components/modals/CargarPolizaFirmadaModal"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/common/StatCard"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/ui/data-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { API_URL } from "@/lib/config"
import PolizaDetalleSupervisor from "@/components/supervisor/PolizaDetalleSupervisor"
import { getAuthToken } from "@/lib/auth"

interface Poliza {
  id: number
  prospecto_nombre?: string
  prospecto_apellido?: string
  prospecto_telefono?: string
  plan_nombre?: string
  anio_plan?: string | number
  vendedor?: { nombre?: string; apellido?: string; email?: string }
  vendedor_nombre?: string
  vendedor_email?: string
  estado?: string
  created_at?: string
  numero_poliza?: string
  numero_poliza_oficial?: string
  total_final?: number
  pdf_hash?: string
  /** Estado del circuito de firma electrónica (VaFirma). Lo lee `BadgeEstadoFirma`. */
  estado_firma?: "pending" | "signed" | "rejected" | "expired" | null
}

/** Mes con pólizas cargadas, devuelto por `/supervisor/polizas/estadisticas/meses`. */
interface MesDisponible {
  anio?: number
  mes?: number
  /** Etiqueta lista para mostrar, si el backend la manda. */
  label?: string
  periodo?: string
  total?: number
}

interface Estadisticas {
  resumen?: {
    total_polizas?: number
    polizas_en_proceso?: number
    polizas_finalizadas?: number
    polizas_firmadas?: number
  }
  metricas_calculadas?: {
    finalization_rate?: string
  }
}

interface FiltroOpciones {
  vendedores: { id: number; first_name: string; last_name: string }[]
  planes: string[]
}

const ESTADOS_POLIZA = [
  { value: "asesor", label: "Asesor" },
  { value: "supervisor", label: "Supervisor" },
  { value: "back_office", label: "Back Office" },
  { value: "venta_cerrada", label: "Venta Cerrada" },
]

function getBadgePolizaEstado(estado?: string) {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    asesor:       { variant: "secondary",    label: "Asesor" },
    supervisor:   { variant: "outline",      label: "Supervisor" },
    back_office:  { variant: "default",      label: "Back Office" },
    venta_cerrada:{ variant: "default",      label: "Venta Cerrada" },
  }
  const item = map[estado ?? ""] ?? { variant: "secondary" as const, label: estado ?? "—" }
  return <Badge variant={item.variant} className="text-xs">{item.label}</Badge>
}

export function SupervisorPolizasView() {
  const [polizas, setPolizas] = useState<Poliza[]>([])
  const [loading, setLoading] = useState(false)
  const [estadisticas, setEstadisticas] = useState<Estadisticas>({})
  const [opcionesFiltro, setOpcionesFiltro] = useState<FiltroOpciones>({ vendedores: [], planes: [] })
  const [filtros, setFiltros] = useState({
    estado: "todos", vendedor_id: "todos", plan: "todos",
    desde: "", hasta: "", buscar: "", orden: "mas_nuevos", mes: "todos"
  })
  const [mesesDisponibles, setMesesDisponibles] = useState<MesDisponible[]>([])
  const [docsLibresModal, setDocsLibresModal] = useState(false)
  const [polizaDocsLibres, setPolizaDocsLibres] = useState<Poliza | null>(null)
  const [cargarFirmada, setCargarFirmada] = useState<{ open: boolean; poliza: Poliza | null }>({ open: false, poliza: null })
  const [previewDoc, setPreviewDoc] = useState<{
    open: boolean; url: string; mime: string; nombre: string
  } | null>(null)
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(0)
  const [totalPolizas, setTotalPolizas] = useState(0)
  const perPage = 20
  const [tipoVista, setTipoVista] = useState<"tabla" | "tarjetas">("tabla")

  // Modal cambio estado
  const [cambioEstadoModal, setCambioEstadoModal] = useState(false)
  const [polizaSeleccionada, setPolizaSeleccionada] = useState<Poliza | null>(null)
  const [nuevoEstado, setNuevoEstado] = useState("")
  const [motivoCambio, setMotivoCambio] = useState("")
  const [savingEstado, setSavingEstado] = useState(false)

  // Modal historial
  const [historialModal, setHistorialModal] = useState(false)
  const [historialEstados, setHistorialEstados] = useState<Record<string, unknown>[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)

  // Modal WhatsApp
  const [whatsappModal, setWhatsappModal] = useState(false)
  const [mensajesWA, setMensajesWA] = useState<Record<string, unknown>[]>([])
  const [loadingWA, setLoadingWA] = useState(false)

  // Modal documentos
  const [documentosModal, setDocumentosModal] = useState(false)
  const [documentos, setDocumentos] = useState<Record<string, unknown>>({})
  const [loadingDocumentos, setLoadingDocumentos] = useState(false)

  // Modal detalle póliza
  const [detalleModal, setDetalleModal] = useState(false)
  const [detallePolizaId, setDetallePolizaId] = useState<number | null>(null)
  const [editarPolizaId, setEditarPolizaId] = useState<number | null>(null)

  // Spinner por botón de fila
  const [loadingBtn, setLoadingBtn] = useState<Record<string, boolean>>({})
  const setBtnLoad = (id: number, action: string, val: boolean) =>
    setLoadingBtn(prev => ({ ...prev, [`${id}-${action}`]: val }))
  const isBtnLoad = (id: number, action: string) => !!loadingBtn[`${id}-${action}`]

  const getAuth = () => ({ Authorization: `Bearer ${getAuthToken()}` })

  const fetchPolizas = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pagina), limit: String(perPage), ...filtros })
      const { data } = await axios.get(`${API_URL}/supervisor/polizas?${params}`, { headers: getAuth() })
      setPolizas(data.data ?? data ?? [])
      if (data.pagination) {
        setTotalPaginas(data.pagination.total_pages ?? 0)
        setTotalPolizas(data.pagination.total ?? 0)
      }
    } catch { toast.error("Error al cargar pólizas") }
    finally { setLoading(false) }
  }, [pagina, filtros])

  useEffect(() => { fetchPolizas() }, [fetchPolizas])

  useEffect(() => {
    const fetchExtras = async () => {
      try {
        const [statsRes, filtrosRes, mesesRes] = await Promise.allSettled([
          axios.get(`${API_URL}/supervisor/polizas/estadisticas`, { headers: getAuth() }),
          axios.get(`${API_URL}/supervisor/polizas/filtros`, { headers: getAuth() }),
          // Meses con pólizas cargadas, para el filtro por período.
          axios.get(`${API_URL}/supervisor/polizas/estadisticas/meses`, { headers: getAuth() }),
        ])
        if (statsRes.status === "fulfilled") setEstadisticas(statsRes.value.data.data ?? {})
        if (filtrosRes.status === "fulfilled") {
          const d = filtrosRes.value.data.data ?? {}
          setOpcionesFiltro({ vendedores: d.vendedores ?? [], planes: d.planes ?? [] })
        }
        if (mesesRes.status === "fulfilled") {
          setMesesDisponibles(mesesRes.value.data?.data ?? mesesRes.value.data ?? [])
        }
      } catch { toast.error("Error al cargar datos adicionales") }
    }
    fetchExtras()
  }, [])

  const cambiarFiltro = (campo: string, valor: string) => {
    setFiltros(f => ({ ...f, [campo]: valor }))
    setPagina(1)
  }

  const limpiarFiltros = () => {
    setFiltros({ estado: "todos", vendedor_id: "todos", plan: "todos", desde: "", hasta: "", buscar: "", orden: "mas_nuevos", mes: "todos" })
    setPagina(1)
  }

  const abrirCambioEstado = (pol: Poliza) => {
    setPolizaSeleccionada(pol)
    setNuevoEstado(pol.estado ?? "")
    setMotivoCambio("")
    setCambioEstadoModal(true)
  }

  const guardarEstado = async () => {
    if (!polizaSeleccionada) return
    if (!nuevoEstado || !motivoCambio.trim()) {
      toast.error("Debe seleccionar un estado y proporcionar un motivo")
      return
    }
    setSavingEstado(true)
    try {
      await axios.patch(
        `${API_URL}/supervisor/polizas/${polizaSeleccionada.id}/estado`,
        { estado: nuevoEstado, motivo_cambio_estado: motivoCambio },
        { headers: getAuth() }
      )
      toast.success("Estado actualizado")
      setCambioEstadoModal(false)
      fetchPolizas()
    } catch { toast.error("Error al actualizar estado") }
    finally { setSavingEstado(false) }
  }

  const abrirHistorial = async (pol: Poliza) => {
    setBtnLoad(pol.id, "historial", true)
    setPolizaSeleccionada(pol)
    setHistorialModal(true)
    setLoadingHistorial(true)
    setHistorialEstados([])
    try {
      const { data } = await axios.get(`${API_URL}/supervisor/polizas/${pol.id}/historial`, { headers: getAuth() })
      setHistorialEstados(data.data ?? data ?? [])
    } catch { toast.error("Error al cargar historial") }
    finally { setLoadingHistorial(false); setBtnLoad(pol.id, "historial", false) }
  }

  const abrirWhatsapp = async (pol: Poliza) => {
    setBtnLoad(pol.id, "whatsapp", true)
    setPolizaSeleccionada(pol)
    setWhatsappModal(true)
    setLoadingWA(true)
    setMensajesWA([])
    try {
      const telefono = pol.prospecto_telefono
      if (!telefono) { toast.error("Sin teléfono asociado"); setLoadingWA(false); setBtnLoad(pol.id, "whatsapp", false); return }
      const { data } = await axios.get(
        `${API_URL}/supervisor/chat/conversaciones/prospecto/${telefono}`,
        { headers: getAuth() }
      )
      const convs: Record<string, unknown>[] = data?.data?.conversaciones ?? data?.data ?? []
      if (convs.length === 0) { setMensajesWA([]); return }
      const respuestas = await Promise.all(
        convs.map((c: Record<string, unknown>) =>
          axios.get(`${API_URL}/supervisor/chat/conversaciones/${c.id}/mensajes`, { headers: getAuth() })
        )
      )
      const todos = respuestas.flatMap(r => r.data?.data ?? [])
      setMensajesWA(todos)
    } catch { toast.error("Error al cargar WhatsApp") }
    finally { setLoadingWA(false); setBtnLoad(pol.id, "whatsapp", false) }
  }

  const abrirDocumentos = async (pol: Poliza) => {
    setBtnLoad(pol.id, "documentos", true)
    setPolizaSeleccionada(pol)
    setDocumentosModal(true)
    setLoadingDocumentos(true)
    setDocumentos({})
    try {
      const { data } = await axios.get(
        `${API_URL}/supervisor/polizas/${pol.id}/documentos`,
        { headers: getAuth() }
      )
      setDocumentos(data.documentos ?? data.data ?? {})
    } catch { toast.error("Error al cargar documentos") }
    finally { setLoadingDocumentos(false); setBtnLoad(pol.id, "documentos", false) }
  }

  const descargarDocumento = async (docId: number, nombre: string) => {
    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/supervisor/polizas/documentos/${docId}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) { toast.error("Error al descargar"); return }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a"); a.href = url; a.download = nombre; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error("Error al descargar documento") }
  }

  // Endpoint autenticado: se baja como blob (`window.open` daría 401) y se
  // muestra en un modal in-app, igual que `PolizasSupervisor.jsx`.
  const previewDocumento = async (docId: number, nombre?: string) => {
    try {
      const { data, headers } = await axios.get(
        `${API_URL}/supervisor/polizas/documentos/${docId}/preview`,
        { headers: getAuth(), responseType: "blob" }
      )
      const mime = String(headers["content-type"] ?? "") || "application/octet-stream"
      setPreviewDoc({
        open: true,
        url: URL.createObjectURL(new Blob([data], { type: mime })),
        mime,
        nombre: nombre ?? `documento-${docId}`,
      })
    } catch {
      toast.error("No se pudo abrir el documento")
    }
  }

  const descargarPDF = (pol: Poliza) => {
    if (pol.pdf_hash) {
      window.open(`${API_URL}/polizas/pdf/${pol.pdf_hash}`, "_blank")
    } else {
      toast.error("Esta póliza no tiene PDF disponible")
    }
  }

  const fmtFecha = (f?: string) => {
    if (!f) return "—"
    return new Date(f).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  const fmtPeso = (n?: number) => n
    ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n)
    : "—"

  const fmtNum = (n?: number) => Number(n ?? 0).toLocaleString("es-AR")

  const resumen = estadisticas.resumen ?? {}
  const metricas = estadisticas.metricas_calculadas ?? {}

  // Documentos como array plano
  const docsArray = Object.entries(documentos).flatMap(([, items]) =>
    Array.isArray(items) ? items : [items]
  ) as Record<string, unknown>[]

  const columnsPolizas = useMemo<ColumnDef<Poliza>[]>(() => [
    {
      id: "poliza",
      header: "Póliza",
      accessorFn: (pol) => pol.numero_poliza_oficial ?? pol.numero_poliza ?? pol.id,
      cell: ({ row }) => {
        const pol = row.original
        return (
          <div>
            <p className="font-medium text-sm">{pol.numero_poliza_oficial ?? pol.numero_poliza ?? pol.id}</p>
            {pol.numero_poliza_oficial && pol.numero_poliza && (
              <p className="text-xs text-muted-foreground">Sist: {pol.numero_poliza}</p>
            )}
          </div>
        )
      },
    },
    {
      id: "cliente",
      header: "Cliente",
      accessorFn: (pol) => `${pol.prospecto_nombre ?? ""} ${pol.prospecto_apellido ?? ""}`,
      cell: ({ row }) => {
        const pol = row.original
        return (
          <>
            <p className="font-medium text-sm">{pol.prospecto_nombre} {pol.prospecto_apellido}</p>
            {pol.prospecto_telefono && (
              <p className="text-xs text-muted-foreground">{pol.prospecto_telefono}</p>
            )}
          </>
        )
      },
    },
    {
      accessorKey: "plan_nombre",
      header: "Plan",
      meta: { className: "hidden md:table-cell" },
      cell: ({ row }) => {
        const pol = row.original
        return (
          <>
            <p className="text-sm">{pol.plan_nombre ?? "—"}</p>
            {pol.anio_plan && <p className="text-xs text-muted-foreground">Año {pol.anio_plan}</p>}
          </>
        )
      },
    },
    {
      id: "vendedor",
      header: "Vendedor",
      meta: { className: "hidden lg:table-cell" },
      accessorFn: (pol) => pol.vendedor?.nombre ?? pol.vendedor_nombre ?? "",
      cell: ({ row }) => {
        const pol = row.original
        return (
          <>
            <p className="text-sm">{pol.vendedor?.nombre ?? pol.vendedor_nombre ?? "—"}</p>
            {pol.vendedor?.email && <p className="text-xs text-muted-foreground">{pol.vendedor.email}</p>}
          </>
        )
      },
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          {getBadgePolizaEstado(row.original.estado)}
          <BadgeEstadoFirma poliza={row.original} />
        </div>
      ),
    },
    {
      accessorKey: "total_final",
      header: "Total",
      meta: { className: "hidden sm:table-cell text-sm" },
      cell: ({ row }) => fmtPeso(row.original.total_final),
    },
    {
      accessorKey: "created_at",
      header: "Fecha",
      meta: { className: "hidden sm:table-cell text-xs text-muted-foreground" },
      cell: ({ row }) => fmtFecha(row.original.created_at),
    },
    {
      id: "acciones",
      header: "Acciones",
      enableSorting: false,
      meta: { className: "w-36" },
      cell: ({ row }) => {
        const pol = row.original
        return (
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent"
                  onClick={() => abrirCambioEstado(pol)}>
                  <AlertCircle className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cambiar estado</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" className="size-8 bg-muted hover:bg-muted/80 text-foreground border"
                  disabled={isBtnLoad(pol.id, "documentos")}
                  onClick={() => abrirDocumentos(pol)}>
                  {isBtnLoad(pol.id, "documentos") ? <Loader2 className="size-3.5 animate-spin" /> : <FolderOpen className="size-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Documentos</TooltipContent>
            </Tooltip>
            {/* Subida de documentos sueltos, como PolizasSupervisor.jsx */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent"
                  onClick={() => { setPolizaDocsLibres(pol); setDocsLibresModal(true) }}>
                  <FilePlus className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Subir documentos</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent"
                  disabled={isBtnLoad(pol.id, "historial")}
                  onClick={() => abrirHistorial(pol)}>
                  {isBtnLoad(pol.id, "historial") ? <Loader2 className="size-3.5 animate-spin" /> : <History className="size-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Historial</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" className="size-8 bg-green-500 hover:bg-green-600 text-white border-0"
                  disabled={isBtnLoad(pol.id, "whatsapp")}
                  onClick={() => abrirWhatsapp(pol)}>
                  {isBtnLoad(pol.id, "whatsapp") ? <Loader2 className="size-3.5 animate-spin" /> : <MessageCircle className="size-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>WhatsApp</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent"
                  onClick={() => { setDetallePolizaId(pol.id); setDetalleModal(true) }}>
                  <Eye className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ver detalle</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent"
                  onClick={() => setEditarPolizaId(pol.id)}>
                  <Pencil className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar póliza</TooltipContent>
            </Tooltip>
            {pol.pdf_hash && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" className="size-8 bg-primary hover:bg-primary/90 text-white border-0"
                    onClick={() => descargarPDF(pol)}>
                    <ExternalLink className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ver PDF</TooltipContent>
              </Tooltip>
            )}
            {/* Firma electrónica: enviar a firmar y cargar la póliza ya firmada */}
            <BotonEnviarFirma poliza={pol} userRole="supervisor" onExito={fetchPolizas} />
            {pol.estado_firma === "signed" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent"
                    onClick={() => setCargarFirmada({ open: true, poliza: pol })}>
                    <Upload className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cargar póliza firmada</TooltipContent>
              </Tooltip>
            )}
            <BotonEliminarPoliza
              poliza={pol}
              onEliminada={fetchPolizas}
              size="icon"
              showLabel={false}
              endpointBase={`${API_URL}/supervisor/polizas`}
            />
          </div>
        )
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [loadingBtn, fetchPolizas])

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Pólizas</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Gestión de pólizas de tus vendedores</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border overflow-hidden">
              <Button
                variant={tipoVista === "tabla" ? "default" : "ghost"}
                size="sm" className="h-8 rounded-none text-xs gap-1.5 px-3"
                onClick={() => setTipoVista("tabla")}
              >
                <List className="size-3.5" />Tabla
              </Button>
              <Button
                variant={tipoVista === "tarjetas" ? "default" : "ghost"}
                size="sm" className="h-8 rounded-none text-xs gap-1.5 px-3 border-l"
                onClick={() => setTipoVista("tarjetas")}
              >
                <LayoutGrid className="size-3.5" />Tarjetas
              </Button>
            </div>
            <Button variant="ghost" size="icon" className="size-8" onClick={fetchPolizas}>
              <RefreshCw className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total pólizas",   value: fmtNum(resumen.total_polizas),        icon: FileText,     tone: "neutral" as const },
            { label: "En proceso",      value: fmtNum(resumen.polizas_en_proceso),   icon: AlertCircle,  tone: "warn" as const },
            { label: "Finalizadas",     value: fmtNum(resumen.polizas_finalizadas),  icon: CheckCircle2, tone: "ok" as const },
            { label: "Tasa cierre",     value: metricas.finalization_rate ?? "—",    icon: Percent,      tone: "neutral" as const },
          ].map(s => (
            <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} tone={s.tone} />
          ))}
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">Filtros</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">{fmtNum(totalPolizas)} pólizas</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={limpiarFiltros}>Limpiar</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
              <div className="lg:col-span-2 space-y-1.5">
                <Label className="text-sm font-medium">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input className="pl-9 h-9" placeholder="Nombre, DNI, póliza..."
                    value={filtros.buscar} onChange={e => cambiarFiltro("buscar", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Estado</Label>
                <Select value={filtros.estado} onValueChange={v => cambiarFiltro("estado", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {ESTADOS_POLIZA.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Vendedor</Label>
                <Select value={filtros.vendedor_id} onValueChange={v => cambiarFiltro("vendedor_id", v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {opcionesFiltro.vendedores.map(v => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.first_name} {v.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {opcionesFiltro.planes.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Plan</Label>
                  <Select value={filtros.plan} onValueChange={v => cambiarFiltro("plan", v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {opcionesFiltro.planes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {mesesDisponibles.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Mes</Label>
                  <Select value={filtros.mes} onValueChange={v => cambiarFiltro("mes", v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los meses</SelectItem>
                      {mesesDisponibles.map((m, i) => {
                        const valor = m.periodo ?? (m.anio != null && m.mes != null ? `${m.anio}-${String(m.mes).padStart(2, "0")}` : String(i))
                        const etiqueta = m.label ?? valor
                        return (
                          <SelectItem key={valor} value={valor}>
                            {etiqueta}{m.total != null ? ` (${m.total})` : ""}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Desde</Label>
                <Input type="date" className="h-9" value={filtros.desde} onChange={e => cambiarFiltro("desde", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Hasta</Label>
                <Input type="date" className="h-9" value={filtros.hasta} onChange={e => cambiarFiltro("hasta", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Ordenar por</Label>
                <Select value={filtros.orden} onValueChange={v => cambiarFiltro("orden", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mas_nuevos">Más nuevos primero</SelectItem>
                    <SelectItem value="mas_antiguos">Más antiguos primero</SelectItem>
                    <SelectItem value="alfabetico">A-Z por cliente</SelectItem>
                    <SelectItem value="alfabetico_desc">Z-A por cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vista Tabla */}
        {tipoVista === "tabla" && (
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <div className="p-4">
                  <DataTable
                    columns={columnsPolizas}
                    data={polizas}
                    pageSize={perPage}
                    emptyMessage={
                      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <FileText className="size-8 mb-2 opacity-30" />
                        <p className="text-sm">No se encontraron pólizas</p>
                      </div>
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Vista Tarjetas */}
        {tipoVista === "tarjetas" && (
          <>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
              </div>
            ) : polizas.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="size-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No se encontraron pólizas</p>
              </div>
            ) : (
              <div className="reg reg--sup-pol border-t-2 border-rule-heavy">
                <div className="reg-row reg-head" role="presentation">
                  <span>Titular</span>
                  <span>Plan</span>
                  <span className="text-right">Total</span>
                  <span>Vendedor</span>
                  <span>Fecha</span>
                  <span>Estado</span>
                  <span />
                </div>

                {polizas.map(pol => (
                  <div key={pol.id} className="reg-row reg-entry">
                    {/* 1 · titular y número — el eje */}
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold">
                        {pol.prospecto_apellido}<span className="font-normal text-muted-foreground">, {pol.prospecto_nombre}</span>
                      </span>
                      <span className="block truncate text-[11.5px] tabular-nums text-muted-foreground">
                        {pol.numero_poliza_oficial ?? pol.numero_poliza}
                      </span>
                    </span>

                    {/* 2 · plan */}
                    <span className="truncate text-[12.5px] text-muted-foreground">{pol.plan_nombre ?? "—"}</span>

                    {/* 3 · total */}
                    <span className="text-right text-[13px] font-semibold tabular-nums">{fmtPeso(pol.total_final)}</span>

                    {/* 4 · vendedor */}
                    <span className="truncate text-[12.5px] text-muted-foreground">
                      {pol.vendedor?.nombre ?? pol.vendedor_nombre ?? "—"}
                    </span>

                    {/* 5 · fecha */}
                    <span className="truncate text-[12px] tabular-nums text-muted-foreground">{fmtFecha(pol.created_at)}</span>

                    {/* 6 · estado y firma */}
                    <span className="flex min-w-0 flex-wrap items-center gap-1">
                      {getBadgePolizaEstado(pol.estado)}
                      <BadgeEstadoFirma poliza={pol} />
                    </span>

                    {/* 7 · acciones */}
                    <span className="reg-actions">
                      <Button size="icon" variant="ghost" className="size-7" title="Cambiar estado"
                        onClick={() => abrirCambioEstado(pol)}>
                        <AlertCircle className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7" title="Documentos"
                        disabled={isBtnLoad(pol.id, "documentos")}
                        onClick={() => abrirDocumentos(pol)}>
                        {isBtnLoad(pol.id, "documentos") ? <Loader2 className="size-3.5 animate-spin" /> : <FolderOpen className="size-3.5" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7" title="Historial"
                        disabled={isBtnLoad(pol.id, "historial")}
                        onClick={() => abrirHistorial(pol)}>
                        {isBtnLoad(pol.id, "historial") ? <Loader2 className="size-3.5 animate-spin" /> : <History className="size-3.5" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7" title="Editar póliza"
                        onClick={() => setEditarPolizaId(pol.id)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      {pol.pdf_hash && (
                        <Button size="icon" variant="ghost" className="size-7" title="Descargar PDF"
                          onClick={() => descargarPDF(pol)}>
                          <ExternalLink className="size-3.5" />
                        </Button>
                      )}
                      <BotonEnviarFirma poliza={pol} userRole="supervisor" onExito={fetchPolizas} />
                      {pol.estado_firma === "signed" && (
                        <Button size="icon" variant="ghost" className="size-7" title="Cargar póliza firmada"
                          onClick={() => setCargarFirmada({ open: true, poliza: pol })}>
                          <Upload className="size-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="size-7" title="Subir documentos"
                        onClick={() => { setPolizaDocsLibres(pol); setDocsLibresModal(true) }}>
                        <FilePlus className="size-3.5" />
                      </Button>
                      <BotonEliminarPoliza
                        poliza={pol}
                        onEliminada={fetchPolizas}
                        size="icon"
                        showLabel={false}
                        endpointBase={`${API_URL}/supervisor/polizas`}
                      />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página {pagina} de {totalPaginas} · {fmtNum(totalPolizas)} pólizas
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={pagina >= totalPaginas} onClick={() => setPagina(p => p + 1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Cambio Estado */}
      <Dialog open={cambioEstadoModal} onOpenChange={setCambioEstadoModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="size-4" />Cambiar Estado
            </DialogTitle>
          </DialogHeader>
          {polizaSeleccionada && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <p><span className="text-muted-foreground">Póliza:</span> {polizaSeleccionada.numero_poliza_oficial ?? polizaSeleccionada.numero_poliza}</p>
                <p><span className="text-muted-foreground">Cliente:</span> {polizaSeleccionada.prospecto_nombre} {polizaSeleccionada.prospecto_apellido}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Nuevo estado</Label>
                <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar estado" /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS_POLIZA.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Motivo *</Label>
                <Textarea
                  rows={3}
                  value={motivoCambio}
                  onChange={e => setMotivoCambio(e.target.value)}
                  placeholder="Describe el motivo del cambio..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCambioEstadoModal(false)}>Cancelar</Button>
            <Button onClick={guardarEstado} disabled={savingEstado || !nuevoEstado || !motivoCambio.trim()}>
              {savingEstado ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Historial */}
      <Dialog open={historialModal} onOpenChange={setHistorialModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-4" />Historial de Estado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {loadingHistorial ? (
              <div className="space-y-2 py-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : historialEstados.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin historial registrado</p>
            ) : historialEstados.map((h, i) => (
              <div key={i} className="border rounded-lg p-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  {getBadgePolizaEstado(h.estado as string)}
                  <span className="text-xs text-muted-foreground">{fmtFecha(h.created_at as string)}</span>
                </div>
                {!!h.motivo && <p className="text-muted-foreground text-xs">{h.motivo as string}</p>}
                {!!h.usuario_nombre && <p className="text-xs">Por: {h.usuario_nombre as string}</p>}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistorialModal(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal WhatsApp */}
      <Dialog open={whatsappModal} onOpenChange={setWhatsappModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="size-4" />Conversaciones WhatsApp
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {loadingWA ? (
              <div className="space-y-2 py-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : mensajesWA.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin mensajes registrados</p>
            ) : mensajesWA.map((m, i) => (
              <div key={i} className={`flex ${m.tipo === "saliente" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  m.tipo === "saliente" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  <p>{m.contenido as string}</p>
                  <p className="text-xs opacity-70 mt-0.5">{fmtFecha(m.fecha_envio as string)}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhatsappModal(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Documentos */}
      <Dialog open={documentosModal} onOpenChange={setDocumentosModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="size-4" />Documentos
              {polizaSeleccionada && (
                <span className="text-muted-foreground font-normal text-sm">
                  — {polizaSeleccionada.numero_poliza_oficial ?? polizaSeleccionada.numero_poliza}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {loadingDocumentos ? (
              <div className="space-y-2 py-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : docsArray.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin documentos cargados</p>
            ) : docsArray.map((doc, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium capitalize">{(doc.tipo_documento as string)?.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">{doc.nombre_archivo as string}</p>
                </div>
              <div className="flex gap-1">
                  <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent"
                    onClick={() => previewDocumento(doc.id as number)}>
                    <Eye className="size-3.5" />
                  </Button>
                  <Button size="icon" className="size-8 bg-primary hover:bg-primary/90 text-white border-0"
                    onClick={() => descargarDocumento(doc.id as number, doc.nombre_archivo as string)}>
                    <Download className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocumentosModal(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalle Póliza */}
      <Dialog open={detalleModal} onOpenChange={(open) => { if (!open) { setDetalleModal(false); setDetallePolizaId(null) } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="size-4" />Detalle de Póliza
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-2">
            {detallePolizaId !== null && (
              <PolizaDetalleSupervisor polizaId={detallePolizaId} />
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDetalleModal(false); setDetallePolizaId(null) }}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar póliza — mismo modal multi-paso del vendedor, en contexto supervisor */}
      <EditarPolizaModal
        polizaId={editarPolizaId}
        open={editarPolizaId !== null}
        onClose={() => setEditarPolizaId(null)}
        onActualizada={fetchPolizas}
        apiContext="supervisor"
      />

      {previewDoc && (
        <DocumentPreviewModal
          open={previewDoc.open}
          onOpenChange={(o) => {
            if (!o) { URL.revokeObjectURL(previewDoc.url); setPreviewDoc(null) }
          }}
          previewUrl={previewDoc.url}
          previewMime={previewDoc.mime}
          documentName={previewDoc.nombre}
        />
      )}

      {polizaDocsLibres && (
        <SubirDocumentosLibresModal
          open={docsLibresModal}
          onOpenChange={setDocsLibresModal}
          poliza={polizaDocsLibres}
          apiContext="supervisor"
          onDocumentosActualizados={fetchPolizas}
        />
      )}

      {cargarFirmada.poliza && (
        <CargarPolizaFirmadaModal
          open={cargarFirmada.open}
          onOpenChange={open => { if (!open) setCargarFirmada({ open: false, poliza: null }) }}
          polizaId={cargarFirmada.poliza.id}
          numeroPoliza={cargarFirmada.poliza.numero_poliza_oficial ?? cargarFirmada.poliza.numero_poliza}
          onSuccess={fetchPolizas}
        />
      )}
    </TooltipProvider>
  )
}
