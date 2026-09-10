import { useEffect, useState, useCallback, useMemo } from "react"
import { useConfirm } from "@/components/common/confirm-dialog"
import axios from "axios"
import { toast } from "sonner"
import {
  Search, Filter, RefreshCw, FileText,
  DollarSign, ChevronLeft, ChevronRight,
  History, Edit, MessageCircle, AlertCircle, CheckCircle2, XCircle, FolderOpen, Download, Trash2, Eye,
  TrendingUp, Percent, Save, X, Upload, ArrowLeftRight, LayoutGrid, List, FilePlus,
  UserCog, Stethoscope
} from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/common/StatCard"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/ui/data-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { getBadgeEstado } from "@/utils/estadosHelper"
import { API_URL } from "@/lib/config"
import { BotonEnviarFirma } from "@/components/buttons/BotonEnviarFirma"
import { BadgeEstadoFirma } from "@/components/badges/BadgeEstadoFirma"
import { BotonesEliminarFirma } from "@/components/buttons/BotonesEliminarFirma"
import { CargarPolizaFirmadaModal } from "@/components/modals/CargarPolizaFirmadaModal"
import { BotonEliminarPoliza } from "@/components/buttons/BotonEliminarPoliza"
import { SubirDocumentosLibresModal } from "@/features/vendedor/components/SubirDocumentosLibresModal"
import { getAuthToken } from "@/lib/auth"

interface Poliza {
  id: number
  prospecto_nombre?: string
  prospecto_apellido?: string
  plan_nombre?: string
  anio_plan?: string | number
  supervisor_nombre?: string
  supervisor_email?: string
  vendedor_nombre?: string
  vendedor_email?: string
  estado?: string
  created_at?: string
  prospecto_id?: number
  numero_contacto?: string
  numero_poliza?: string
  numero_poliza_oficial?: string
  prospecto_email?: string
  prospecto_telefono?: string
  total_final?: number
  estado_firma?: "pending" | "signed" | "rejected" | "expired" | null
  /** 0|1 — flag de IMC elevado (`polizasBackOfficeController.js:281`). */
  requiere_auditoria_medica?: number
  fecha_envio_firma?: string
  fecha_firma?: string
  referencia_vafirma?: string
  pdf_hash?: string
  pdf_url?: string
}

interface Estadisticas {
  resumen?: {
    total_polizas?: number
    polizas_en_proceso?: number
    polizas_activas?: number
    polizas_finalizadas?: number
    polizas_firmadas?: number
  }
  metricas_calculadas?: {
    facturacion_total_formateada?: string
    finalization_rate?: string
    ticket_promedio_formateado?: string
  }
}

interface FiltroOpciones {
  vendedores: { id: number; first_name: string; last_name: string; supervisor_nombre?: string }[]
  supervisores: { id: number; first_name: string; last_name: string; vendedores_count?: number }[]
  planes: string[]
  estados: { estado: string }[]
}

// Únicos 5 valores que acepta el backend (`polizasBackOfficeController.js:843-845`,
// `cambiarEstado`) — antes esta lista tenía valores inventados que el backend
// rechazaba con 400 en cualquier cambio de estado.
const ESTADOS_POLIZA = [
  { value: "asesor", label: "Asesor" },
  { value: "supervisor", label: "Supervisor" },
  { value: "back_office", label: "Back Office" },
  { value: "venta_cerrada", label: "Venta Cerrada" },
  { value: "venta_rechazada", label: "Venta Rechazada" },
] as const

// ── Tipo para datos de edición de póliza ────────────────────────────────
type PolizaEdicion = Record<string, unknown> & {
  id?: number
  datos_personales?: Record<string, unknown>
  informacion_afiliado?: Record<string, unknown>
  informacion_facturacion?: Record<string, unknown>
  solicitud_afiliacion?: Record<string, unknown>
  datos_comerciales?: Record<string, unknown>
  integrantes?: Record<string, unknown>[]
  observaciones?: string
  declaracion_salud?: Record<string, unknown>
  cobertura_anterior?: Record<string, unknown>
  datos_adicionales?: Record<string, unknown>
  terminos_aceptados?: boolean
  referencias?: Record<string, unknown>[]
}

export function BackofficePolizasView() {
  const confirm = useConfirm()
  const [polizas, setPolizas] = useState<Poliza[]>([])
  const [loading, setLoading] = useState(false)
  const [estadisticas, setEstadisticas] = useState<Estadisticas>({})
  const [opcionesFiltro, setOpcionesFiltro] = useState<FiltroOpciones>({ vendedores: [], supervisores: [], planes: [], estados: [] })
  const [loadingFiltros, setLoadingFiltros] = useState(true)
  const [filtros, setFiltros] = useState({ estado: "todos", vendedor_id: "todos", supervisor_id: "todos", plan: "todos", desde: "", hasta: "", buscar: "", orden: "mas_nuevos" })
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(0)
  const [totalPolizas, setTotalPolizas] = useState(0)
  const perPage = 20

  // Modales
  const [cambioEstadoModal, setCambioEstadoModal] = useState(false)
  const [historialModal, setHistorialModal] = useState(false)
  const [whatsappModal, setWhatsappModal] = useState(false)
  const [documentosModal, setDocumentosModal] = useState(false)
  const [editarModal, setEditarModal] = useState(false)
  const [polizaSeleccionada, setPolizaSeleccionada] = useState<Poliza | null>(null)
  const [nuevoEstado, setNuevoEstado] = useState("")
  const [motivoCambio, setMotivoCambio] = useState("")
  const [savingEstado, setSavingEstado] = useState(false)
  const [historialEstados, setHistorialEstados] = useState<Record<string, unknown>[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [mensajesWA, setMensajesWA] = useState<Record<string, unknown>[]>([])
  const [loadingWA, setLoadingWA] = useState(false)
  const [documentos, setDocumentos] = useState<Record<string, unknown>>({})
  const [loadingDocumentos, setLoadingDocumentos] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewModal, setPreviewModal] = useState(false)
  // Estados para editar póliza
  const [polizaEdicion, setPolizaEdicion] = useState<PolizaEdicion | null>(null)
  const [loadingEdicion, setLoadingEdicion] = useState(false)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [motivoEdicion, setMotivoEdicion] = useState("")
  const [exportando, setExportando] = useState(false)
  const [docsLibresModal, setDocsLibresModal] = useState(false)
  const [polizaDocsLibres, setPolizaDocsLibres] = useState<Poliza | null>(null)
  const [cargarFirmadaModal, setCargarFirmadaModal] = useState(false)
  const [polizaCargarFirmada, setPolizaCargarFirmada] = useState<Poliza | null>(null)
  const [tipoVista, setTipoVista] = useState<"tabla" | "tarjetas">("tabla")

  const getAuth = () => ({ Authorization: `Bearer ${getAuthToken()}` })

  const fetchPolizas = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pagina), limit: String(perPage), ...filtros })
      const { data } = await axios.get(`${API_URL}/backoffice/polizas?${params}`, { headers: getAuth() })
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
        const [statsRes, filtrosRes] = await Promise.allSettled([
          axios.get(`${API_URL}/backoffice/polizas/estadisticas`, { headers: getAuth() }),
          axios.get(`${API_URL}/backoffice/polizas/filtros`, { headers: getAuth() })
        ])
        if (statsRes.status === "fulfilled") {
          setEstadisticas(statsRes.value.data.data ?? {})
        }
        if (filtrosRes.status === "fulfilled") {
          const d = filtrosRes.value.data.data ?? {}
          setOpcionesFiltro({
            vendedores: d.vendedores ?? [],
            supervisores: d.supervisores ?? [],
            planes: d.planes ?? [],
            estados: d.estados ?? [],
          })
        } else {
          toast.error("Error al cargar opciones de filtro")
        }
      } catch { toast.error("Error al inicializar filtros") }
      finally { setLoadingFiltros(false) }
    }
    fetchExtras()
  }, [])

  const cambiarFiltro = (campo: string, valor: string) => {
    setFiltros(f => ({ ...f, [campo]: valor }))
    setPagina(1)
  }

  const limpiarFiltros = () => {
    setFiltros({ estado: "todos", vendedor_id: "todos", supervisor_id: "todos", plan: "todos", desde: "", hasta: "", buscar: "", orden: "mas_nuevos" })
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
    setSavingEstado(true)
    try {
      await axios.patch(`${API_URL}/backoffice/polizas/${polizaSeleccionada.id}/estado`, { estado: nuevoEstado, motivo_cambio_estado: motivoCambio }, { headers: getAuth() })
      toast.success("Estado actualizado")
      setCambioEstadoModal(false)
      fetchPolizas()
    } catch { toast.error("Error al actualizar estado") }
    finally { setSavingEstado(false) }
  }

  const abrirHistorial = async (pol: Poliza) => {
    setPolizaSeleccionada(pol)
    setHistorialModal(true)
    setLoadingHistorial(true)
    setHistorialEstados([])
    try {
      const { data } = await axios.get(`${API_URL}/backoffice/polizas/${pol.id}/historial`, { headers: getAuth() })
      setHistorialEstados(data.data ?? data ?? [])
    } catch { /* silencioso */ }
    finally { setLoadingHistorial(false) }
  }

  const abrirWhatsapp = async (pol: Poliza) => {
    setPolizaSeleccionada(pol)
    setWhatsappModal(true)
    setLoadingWA(true)
    setMensajesWA([])
    try {
      // Preferimos buscar por prospecto_id (ruta que usa producción): el
      // teléfono puede faltar o venir con otro formato y no matchear.
      let convs: Record<string, unknown>[] = []
      if (pol.prospecto_id) {
        try {
          const { data } = await axios.get(
            `${API_URL}/backoffice/polizas/prospectos/${pol.prospecto_id}/conversaciones`,
            { headers: getAuth() }
          )
          convs = data?.data ?? data ?? []
        } catch { /* caemos a la búsqueda por teléfono */ }
      }

      if (convs.length === 0) {
        if (!pol.numero_contacto) { toast.error("Sin teléfono"); setLoadingWA(false); return }
        const { data } = await axios.get(`${API_URL}/backoffice/prospectos/whatsapp/telefono/${encodeURIComponent(pol.numero_contacto)}`, { headers: getAuth() })
        convs = data?.data ?? []
      }
      const respuestas = await Promise.all(convs.map((c: Record<string, unknown>) =>
        axios.get(`${API_URL}/backoffice/prospectos/whatsapp/conversaciones/${c.id}/mensajes`, { headers: getAuth() })
      ))
      const todos = respuestas.flatMap(r => r.data?.data ?? [])
      setMensajesWA(todos.sort((a: Record<string, unknown>, b: Record<string, unknown>) => new Date(a.fecha_envio as string).getTime() - new Date(b.fecha_envio as string).getTime()))
    } catch { toast.error("Error al cargar WhatsApp") }
    finally { setLoadingWA(false) }
  }

  const abrirDocumentos = async (pol: Poliza) => {
    setPolizaSeleccionada(pol)
    setDocumentosModal(true)
    setLoadingDocumentos(true)
    setDocumentos({})
    try {
      const { data } = await axios.get(`${API_URL}/backoffice/polizas/${pol.id}/documentos`, { headers: getAuth() })
      setDocumentos(data.documentos ?? data.data ?? {})
    } catch { toast.error("Error al cargar documentos") }
    finally { setLoadingDocumentos(false) }
  }

  const descargarDocumento = async (docId: number, nombre: string) => {
    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/backoffice/polizas/documentos/${docId}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) { toast.error("Error al descargar"); return }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = nombre; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error("Error al descargar documento") }
  }

  const previewDocumento = async (docId: number) => {
    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/backoffice/polizas/documentos/${docId}/preview`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) { toast.error("Error al previsualizar"); return }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(url)
      setPreviewModal(true)
    } catch { toast.error("Error al previsualizar documento") }
  }

  const eliminarDocumento = async (docId: number) => {
    const ok = await confirm({
      title: "¿Eliminar este documento?",
      description: "Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      destructive: true,
    })
    if (!ok) return
    try {
      await axios.delete(`${API_URL}/backoffice/polizas/documentos/${docId}`, { headers: getAuth() })
      toast.success("Documento eliminado")
      if (polizaSeleccionada) abrirDocumentos(polizaSeleccionada)
    } catch { toast.error("Error al eliminar documento") }
  }

  const descargarPDF = (pol: Poliza) => {
    const url = pol.pdf_hash
      ? `${API_URL}/polizas/pdf/${pol.pdf_hash}`
      : pol.pdf_url
    if (url) {
      window.open(url, "_blank")
    } else {
      toast.error("Esta póliza no tiene PDF disponible")
    }
  }

  const fmtFecha = (f?: string) => {
    if (!f) return "—"
    return new Date(f).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  const fmtNum = (n?: number) => Number(n ?? 0).toLocaleString("es-AR")
  const fmtPeso = (n?: number) => n ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n) : "—"

  // ── Editar póliza ──────────────────────────────────────────────────────
  const abrirEditar = async (pol: Poliza) => {
    setPolizaSeleccionada(pol)
    setEditarModal(true)
    setLoadingEdicion(true)
    setPolizaEdicion(null)
    setMotivoEdicion("")
    try {
      const { data } = await axios.get(`${API_URL}/backoffice/polizas/${pol.id}/editar`, { headers: getAuth() })
      setPolizaEdicion(data.data ?? data ?? null)
    } catch { toast.error("Error al cargar póliza para edición"); setEditarModal(false) }
    finally { setLoadingEdicion(false) }
  }

  const setCampoEdicion = (seccion: string, campo: string, valor: unknown, index?: number) => {
    setPolizaEdicion(prev => {
      if (!prev) return prev
      const next = { ...prev }
      if (seccion === "observaciones") { next.observaciones = valor as string; return next }
      if (seccion === "terminos_aceptados") { next.terminos_aceptados = valor as boolean; return next }
      if (index !== null && index !== undefined && Array.isArray(next[seccion])) {
        const arr = [...(next[seccion] as Record<string, unknown>[])]
        arr[index] = { ...(arr[index] ?? {}), [campo]: valor }
        next[seccion as keyof PolizaEdicion] = arr as never
      } else {
        next[seccion as keyof PolizaEdicion] = { ...(next[seccion as keyof PolizaEdicion] as Record<string, unknown> ?? {}), [campo]: valor } as never
      }
      return next
    })
  }

  const guardarEdicion = async () => {
    if (!polizaEdicion || !motivoEdicion.trim()) { toast.error("Ingresá un motivo para la edición"); return }
    setGuardandoEdicion(true)
    try {
      await axios.put(`${API_URL}/backoffice/polizas/${polizaEdicion.id}/actualizar`, {
        datos_personales: polizaEdicion.datos_personales,
        integrantes: polizaEdicion.integrantes,
        referencias: polizaEdicion.referencias,
        declaracion_salud: polizaEdicion.declaracion_salud,
        cobertura_anterior: polizaEdicion.cobertura_anterior,
        datos_adicionales: polizaEdicion.datos_adicionales,
        observaciones: polizaEdicion.observaciones,
        terminos_aceptados: polizaEdicion.terminos_aceptados,
        informacion_afiliado: polizaEdicion.informacion_afiliado ?? {},
        informacion_facturacion: polizaEdicion.informacion_facturacion ?? {},
        solicitud_afiliacion: polizaEdicion.solicitud_afiliacion ?? {},
        datos_comerciales: polizaEdicion.datos_comerciales ?? {},
        motivo: motivoEdicion,
      }, { headers: getAuth() })
      toast.success("Póliza actualizada correctamente")
      setEditarModal(false)
      fetchPolizas()
    } catch { toast.error("Error al actualizar póliza") }
    finally { setGuardandoEdicion(false) }
  }

  // ── Exportar CSV ───────────────────────────────────────────────────────
  // El backend NO expone `/backoffice/polizas/exportar` (sólo existe
  // `/export/prospectos`). Se genera el CSV en el cliente a partir de las
  // pólizas ya filtradas en memoria, así el botón funciona sin backend nuevo.
  const exportarCSV = async () => {
    setExportando(true)
    try {
      if (polizas.length === 0) { toast.error("No hay pólizas para exportar"); return }

      const columnas: [string, (p: Poliza) => unknown][] = [
        ["ID",              p => p.id],
        ["N° Póliza",       p => p.numero_poliza ?? ""],
        ["N° Oficial",      p => p.numero_poliza_oficial ?? ""],
        ["Titular",         p => `${p.prospecto_nombre ?? ""} ${p.prospecto_apellido ?? ""}`.trim()],
        ["Email",           p => p.prospecto_email ?? ""],
        ["Teléfono",        p => p.prospecto_telefono ?? ""],
        ["Plan",            p => p.plan_nombre ?? ""],
        ["Año plan",        p => p.anio_plan ?? ""],
        ["Vendedor",        p => p.vendedor_nombre ?? ""],
        ["Supervisor",      p => p.supervisor_nombre ?? ""],
        ["Estado",          p => p.estado ?? ""],
        ["Estado firma",    p => p.estado_firma ?? ""],
        ["Total",           p => p.total_final ?? ""],
        ["Creada",          p => p.created_at ?? ""],
      ]

      // Comillas dobles escapadas + BOM para que Excel abra bien los acentos.
      const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`
      const csv = [
        columnas.map(([h]) => escape(h)).join(","),
        ...polizas.map(p => columnas.map(([, get]) => escape(get(p))).join(",")),
      ].join("\r\n")

      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `polizas_${new Date().toISOString().split("T")[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${polizas.length} pólizas exportadas`)
    } catch { toast.error("Error al exportar CSV") }
    finally { setExportando(false) }
  }

  const resumen = estadisticas.resumen ?? {}
  const metricas = estadisticas.metricas_calculadas ?? {}

  const columnsPolizas = useMemo<ColumnDef<Poliza>[]>(() => [
    {
      id: "poliza",
      header: "Póliza",
      meta: { className: "w-20" },
      accessorFn: (pol) => pol.numero_poliza_oficial ?? pol.numero_poliza ?? "—",
      cell: ({ row }) => {
        const pol = row.original
        return (
          <div>
            <p className="font-bold text-sm">{pol.numero_poliza_oficial ?? pol.numero_poliza ?? "—"}</p>
            {pol.numero_poliza_oficial && pol.numero_poliza && (
              <p className="text-xs text-muted-foreground font-mono">#{pol.numero_poliza}</p>
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
          <div>
            <p className="font-semibold text-sm">{pol.prospecto_nombre} {pol.prospecto_apellido}</p>
            {pol.prospecto_telefono && <p className="text-xs text-muted-foreground">{pol.prospecto_telefono}</p>}
          </div>
        )
      },
    },
    {
      id: "plan",
      header: "Plan",
      meta: { className: "hidden sm:table-cell" },
      accessorFn: (pol) => pol.plan_nombre ?? "",
      cell: ({ row }) => {
        const pol = row.original
        return (
          <div>
            <p className="font-semibold text-sm">{pol.plan_nombre ?? "—"}</p>
            {pol.anio_plan && <p className="text-xs text-muted-foreground">Año {pol.anio_plan}</p>}
          </div>
        )
      },
    },
    {
      id: "vendedor",
      header: "Vendedor",
      meta: { className: "hidden lg:table-cell" },
      accessorFn: (pol) => pol.vendedor_nombre ?? "",
      cell: ({ row }) => {
        const pol = row.original
        return (
          <div>
            <p className="font-semibold text-sm">{pol.vendedor_nombre ?? "—"}</p>
            {pol.vendedor_email && <p className="text-xs text-muted-foreground">{pol.vendedor_email}</p>}
          </div>
        )
      },
    },
    {
      id: "supervisor",
      header: "Supervisor",
      meta: { className: "hidden xl:table-cell" },
      accessorFn: (pol) => pol.supervisor_nombre ?? "",
      cell: ({ row }) => {
        const pol = row.original
        return (
          <div className="flex items-start gap-1">
            <UserCog className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="font-semibold text-sm text-primary">{pol.supervisor_nombre ?? "—"}</p>
              {pol.supervisor_email && <p className="text-xs text-muted-foreground">{pol.supervisor_email}</p>}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => {
        const pol = row.original
        return (
          <div className="flex flex-col gap-1">
            {pol.estado ? getBadgeEstado(pol.estado) : <Badge variant="outline">—</Badge>}
            <BadgeEstadoFirma poliza={pol} />
            {pol.requiere_auditoria_medica === 1 && (
              <Badge variant="risk" title="Requiere auditoría médica por IMC elevado"><Stethoscope aria-hidden="true" />Auditoría</Badge>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "total_final",
      header: "Total",
      meta: { className: "hidden md:table-cell" },
      cell: ({ row }) => <p className="font-semibold text-sm">{row.original.total_final != null ? fmtPeso(row.original.total_final) : "—"}</p>,
    },
    {
      accessorKey: "created_at",
      header: "Fecha",
      meta: { className: "hidden md:table-cell text-xs text-muted-foreground" },
      cell: ({ row }) => fmtFecha(row.original.created_at),
    },
    {
      id: "acciones",
      header: "Acciones",
      enableSorting: false,
      cell: ({ row }) => {
        const pol = row.original
        return (
          <div className="flex gap-1 flex-wrap">
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" className="size-8 bg-primary hover:bg-primary/90 text-white border-0" aria-label="Descargar PDF" onClick={() => descargarPDF(pol)}><Download className="size-3.5" aria-hidden="true" /></Button>
            </TooltipTrigger><TooltipContent>Descargar PDF</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" className="size-8 bg-muted hover:bg-muted/80 text-foreground border" aria-label="Ver documentos" onClick={() => abrirDocumentos(pol)}><FolderOpen className="size-3.5" aria-hidden="true" /></Button>
            </TooltipTrigger><TooltipContent>Ver documentos</TooltipContent></Tooltip>
            <BotonEnviarFirma poliza={pol} userRole="backoffice" onExito={fetchPolizas} />
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" aria-label="Cargar póliza firmada" onClick={() => { setPolizaCargarFirmada(pol); setCargarFirmadaModal(true) }}><Upload className="size-3.5" aria-hidden="true" /></Button>
            </TooltipTrigger><TooltipContent>Cargar póliza firmada</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" aria-label="Cambiar estado" onClick={() => abrirCambioEstado(pol)}><ArrowLeftRight className="size-3.5" aria-hidden="true" /></Button>
            </TooltipTrigger><TooltipContent>Cambiar estado</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" aria-label="Ver historial" onClick={() => abrirHistorial(pol)}><History className="size-3.5" aria-hidden="true" /></Button>
            </TooltipTrigger><TooltipContent>Ver historial</TooltipContent></Tooltip>
            <BotonesEliminarFirma poliza={pol} onActualizar={fetchPolizas} />
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" aria-label="Editar póliza" onClick={() => abrirEditar(pol)}><Edit className="size-3.5" aria-hidden="true" /></Button>
            </TooltipTrigger><TooltipContent>Editar póliza</TooltipContent></Tooltip>
            {/* Subida de documentos sueltos, como en PolizasBackOffice.jsx */}
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" aria-label="Subir documentos" onClick={() => { setPolizaDocsLibres(pol); setDocsLibresModal(true) }}><FilePlus className="size-3.5" aria-hidden="true" /></Button>
            </TooltipTrigger><TooltipContent>Subir documentos</TooltipContent></Tooltip>
            <BotonEliminarPoliza
              poliza={pol}
              size="icon"
              showLabel={false}
              endpointBase={`${API_URL}/backoffice/polizas`}
              onEliminada={fetchPolizas}
            />
            {pol.numero_contacto && (
              <Tooltip><TooltipTrigger asChild>
                <Button size="icon" className="size-8 bg-green-500 hover:bg-green-600 text-white border-0" aria-label="Ver WhatsApp" onClick={() => abrirWhatsapp(pol)}><MessageCircle className="size-3.5" aria-hidden="true" /></Button>
              </TooltipTrigger><TooltipContent>WhatsApp</TooltipContent></Tooltip>
            )}
          </div>
        )
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [fetchPolizas])

  return (
    <TooltipProvider>
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Pólizas</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Administración de pólizas, estados y documentación asociada</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle Tabla / Tarjetas */}
          <div className="flex rounded-md border overflow-hidden">
            <Button
              variant={tipoVista === "tabla" ? "default" : "ghost"}
              size="sm"
              className="h-8 rounded-none text-xs gap-1.5 px-3"
              onClick={() => setTipoVista("tabla")}
            >
              <List className="size-3.5" />Tabla
            </Button>
            <Button
              variant={tipoVista === "tarjetas" ? "default" : "ghost"}
              size="sm"
              className="h-8 rounded-none text-xs gap-1.5 px-3 border-l"
              onClick={() => setTipoVista("tarjetas")}
            >
              <LayoutGrid className="size-3.5" />Tarjetas
            </Button>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportarCSV} disabled={exportando} aria-label="Exportar CSV">
            <Download className="size-3.5" aria-hidden="true" />
            {exportando ? "Exportando..." : "Exportar CSV"}
          </Button>
          <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Actualizar pólizas" onClick={fetchPolizas}>
            <RefreshCw className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {[
          { label: "Total pólizas",    value: fmtNum(resumen.total_polizas),          icon: FileText,     tone: "neutral" as const },
          { label: "En proceso",        value: fmtNum(resumen.polizas_en_proceso),     icon: AlertCircle,  tone: "warn" as const },
          { label: "Activas",           value: fmtNum(resumen.polizas_activas),        icon: CheckCircle2, tone: "ok" as const },
          { label: "Finalizadas",       value: fmtNum(resumen.polizas_finalizadas),    icon: XCircle,      tone: "risk" as const },
          { label: "Facturación",       value: metricas.facturacion_total_formateada ?? "—", icon: DollarSign, tone: "neutral" as const },
          { label: "Tasa finalización", value: metricas.finalization_rate ?? "—",     icon: Percent,       tone: "neutral" as const },
          { label: "Ticket promedio",   value: metricas.ticket_promedio_formateado ?? "—", icon: TrendingUp, tone: "neutral" as const },
        ].map(s => (
          <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} tone={s.tone} />
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-base">Filtros</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">{fmtNum(totalPolizas)} pólizas en total</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={limpiarFiltros}>Limpiar</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
            {/* Buscar — ocupa 2 cols en lg */}
            <div className="lg:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden="true" />
                <Input className="pl-9 h-9" placeholder="Nombre, DNI, póliza..." value={filtros.buscar}
                  onChange={e => cambiarFiltro("buscar", e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Estado</Label>
              <Select value={filtros.estado} onValueChange={v => cambiarFiltro("estado", v)}>
                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" className="max-h-60 overflow-y-auto z-50">
                  <SelectItem value="todos">Todos</SelectItem>
                  {/* Estados del backend — si vienen vacíos se muestran los hardcodeados */}
                  {opcionesFiltro.estados.length > 0
                    ? opcionesFiltro.estados.map(e => <SelectItem key={e.estado} value={e.estado}>{e.estado}</SelectItem>)
                    : [
                        { v: "asesor",       l: "Asesor" },
                        { v: "supervisor",   l: "Supervisor" },
                        { v: "back_office",  l: "Back Office" },
                        { v: "venta_cerrada",l: "Venta Cerrada" },
                      ].map(({ v, l }) => <SelectItem key={v} value={v}>{l}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Supervisor</Label>
              <Select value={filtros.supervisor_id} onValueChange={v => cambiarFiltro("supervisor_id", v)}>
                <SelectTrigger className="h-9 w-full" disabled={loadingFiltros}><SelectValue placeholder={loadingFiltros ? "Cargando..." : undefined} /></SelectTrigger>
                <SelectContent position="popper" className="max-h-60 overflow-y-auto z-50">
                  <SelectItem value="todos">Todos ({opcionesFiltro.supervisores.length})</SelectItem>
                  {opcionesFiltro.supervisores.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.first_name} {s.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Vendedor</Label>
              <Select value={filtros.vendedor_id} onValueChange={v => cambiarFiltro("vendedor_id", v)}>
                <SelectTrigger className="h-9 w-full" disabled={loadingFiltros}><SelectValue placeholder={loadingFiltros ? "Cargando..." : undefined} /></SelectTrigger>
                <SelectContent position="popper" className="max-h-60 overflow-y-auto z-50">
                  <SelectItem value="todos">Todos ({opcionesFiltro.vendedores.length})</SelectItem>
                  {opcionesFiltro.vendedores.map(v => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.first_name} {v.last_name}
                      {v.supervisor_nombre && <span className="text-muted-foreground text-xs ml-1">· {v.supervisor_nombre}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Plan</Label>
              <Select value={filtros.plan} onValueChange={v => cambiarFiltro("plan", v)}>
                <SelectTrigger className="h-9 w-full" disabled={loadingFiltros}><SelectValue placeholder={loadingFiltros ? "Cargando..." : undefined} /></SelectTrigger>
                <SelectContent position="popper" className="max-h-60 overflow-y-auto z-50">
                  <SelectItem value="todos">Todos</SelectItem>
                  {opcionesFiltro.planes.map(p => (
                    <SelectItem key={typeof p === "string" ? p : (p as {nombre: string}).nombre} value={typeof p === "string" ? p : (p as {nombre: string}).nombre}>
                      {typeof p === "string" ? p : (p as {nombre: string}).nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Desde</Label>
              <Input type="date" className="h-9 w-full" value={filtros.desde} onChange={e => cambiarFiltro("desde", e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Hasta</Label>
              <Input type="date" className="h-9 w-full" value={filtros.hasta} onChange={e => cambiarFiltro("hasta", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla / Tarjetas */}
      <Card>
        <CardContent className="p-0">
          {loading ? <Skeleton className="h-64 w-full" /> : polizas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="rounded-full bg-muted p-4"><FileText className="size-8 text-muted-foreground" /></div>
              <div>
                <p className="font-medium text-sm">Sin pólizas</p>
                <p className="text-xs text-muted-foreground mt-1">No hay pólizas para los filtros aplicados</p>
              </div>
              <Button variant="outline" size="sm" onClick={limpiarFiltros}>Limpiar filtros</Button>
            </div>
          ) : tipoVista === "tabla" ? (
            <div className="p-4">
              <DataTable columns={columnsPolizas} data={polizas} pageSize={perPage} emptyMessage="Sin pólizas" />
            </div>
          ) : (
            /* ── Vista registro ── */
            <div className="reg reg--bo-pol border-t-2 border-rule-heavy">
              <div className="reg-row reg-head" role="presentation">
                <span>Nº póliza</span>
                <span>Titular</span>
                <span>Plan</span>
                <span className="text-right">Total</span>
                <span>Asignación</span>
                <span>Estado</span>
                <span className="text-right">Fecha</span>
                <span />
              </div>

              {polizas.map(pol => (
                <div key={pol.id} className="reg-row reg-entry">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold tabular-nums">
                      {pol.numero_poliza_oficial ?? pol.numero_poliza ?? "—"}
                    </span>
                    {pol.numero_poliza_oficial && pol.numero_poliza && (
                      <span className="block truncate text-[11.5px] tabular-nums text-muted-foreground">#{pol.numero_poliza}</span>
                    )}
                  </span>

                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">
                      {pol.prospecto_apellido}<span className="font-normal text-muted-foreground">, {pol.prospecto_nombre}</span>
                    </span>
                    {pol.prospecto_telefono && (
                      <span className="block truncate text-[11.5px] tabular-nums text-muted-foreground">{pol.prospecto_telefono}</span>
                    )}
                  </span>

                  <span className="min-w-0 text-muted-foreground">
                    <span className="block truncate text-[12.5px]">{pol.plan_nombre ?? "—"}</span>
                    {pol.anio_plan && <span className="block truncate text-[11.5px]">Año {pol.anio_plan}</span>}
                  </span>

                  <span className="text-right text-[13px] font-semibold tabular-nums">
                    {pol.total_final != null ? fmtPeso(pol.total_final) : "—"}
                  </span>

                  <span className="min-w-0 text-muted-foreground">
                    {pol.vendedor_nombre && <span className="block truncate text-[12.5px]">{pol.vendedor_nombre}</span>}
                    {pol.supervisor_nombre && (
                      <span className="flex items-center gap-1 truncate text-[11.5px] font-medium text-primary">
                        <UserCog className="size-3 shrink-0" aria-hidden="true" />{pol.supervisor_nombre}
                      </span>
                    )}
                    {!pol.vendedor_nombre && !pol.supervisor_nombre && <span className="text-[12.5px]">—</span>}
                  </span>

                  <span className="flex min-w-0 flex-wrap items-center gap-1">
                    {pol.estado ? getBadgeEstado(pol.estado) : <Badge variant="outline" size="sm">—</Badge>}
                    <BadgeEstadoFirma poliza={pol} />
                    {pol.requiere_auditoria_medica === 1 && (
                      <Badge variant="risk" size="sm" className="pointer-events-none" title="Requiere auditoría médica por IMC elevado">
                        <Stethoscope aria-hidden="true" />Auditoría
                      </Badge>
                    )}
                  </span>

                  <span className="text-right text-[12px] tabular-nums text-muted-foreground">{fmtFecha(pol.created_at)}</span>

                  <span className="reg-actions">
                    <Tooltip><TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => descargarPDF(pol)}><Download className="size-3.5" /></Button>
                    </TooltipTrigger><TooltipContent>Descargar PDF</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => abrirDocumentos(pol)}><FolderOpen className="size-3.5" /></Button>
                    </TooltipTrigger><TooltipContent>Ver documentos</TooltipContent></Tooltip>
                    <BotonEnviarFirma poliza={pol} userRole="backoffice" onExito={fetchPolizas} />
                    <Tooltip><TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => { setPolizaCargarFirmada(pol); setCargarFirmadaModal(true) }}><Upload className="size-3.5" /></Button>
                    </TooltipTrigger><TooltipContent>Cargar firmada</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => abrirCambioEstado(pol)}><ArrowLeftRight className="size-3.5" /></Button>
                    </TooltipTrigger><TooltipContent>Cambiar estado</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => abrirHistorial(pol)}><History className="size-3.5" /></Button>
                    </TooltipTrigger><TooltipContent>Ver historial</TooltipContent></Tooltip>
                    <BotonesEliminarFirma poliza={pol} onActualizar={fetchPolizas} />
                    <Tooltip><TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => abrirEditar(pol)}><Edit className="size-3.5" /></Button>
                    </TooltipTrigger><TooltipContent>Editar póliza</TooltipContent></Tooltip>
                    {pol.numero_contacto && (
                      <Tooltip><TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => abrirWhatsapp(pol)}><MessageCircle className="size-3.5" /></Button>
                      </TooltipTrigger><TooltipContent>WhatsApp</TooltipContent></Tooltip>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
            <p className="text-xs text-muted-foreground hidden sm:block">Página {pagina} de {totalPaginas} · {fmtNum(totalPolizas)} pólizas</p>
            <div className="flex items-center gap-1.5 mx-auto sm:mx-0">
            <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Página anterior" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}><ChevronLeft className="size-4" aria-hidden="true" /></Button>
            {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
              const start = Math.max(1, Math.min(pagina - 2, totalPaginas - 4))
              const page = start + i
              return page <= totalPaginas ? (
                <Button key={page} variant={page === pagina ? "default" : "outline"} size="icon" className="h-7 w-7 text-xs" onClick={() => setPagina(page)}>{page}</Button>
              ) : null
            })}
            <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Página siguiente" disabled={pagina === totalPaginas} onClick={() => setPagina(p => p + 1)}><ChevronRight className="size-4" aria-hidden="true" /></Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal: Cambio de estado */}
      <Dialog open={cambioEstadoModal} onOpenChange={setCambioEstadoModal}>
        <DialogContent className="max-w-md" showCloseButton={false}>
          <DialogHeader><DialogTitle><Edit className="inline size-4 mr-2" />Cambiar estado — Póliza #{polizaSeleccionada?.id}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm mb-1.5 block">Nuevo estado</Label>
              <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS_POLIZA.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Motivo (opcional)</Label>
              <Textarea rows={3} placeholder="Motivo del cambio..." value={motivoCambio} onChange={e => setMotivoCambio(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="destructive" onClick={() => setCambioEstadoModal(false)}>Cancelar</Button>
              <Button onClick={guardarEstado} disabled={savingEstado}>{savingEstado ? "Guardando..." : "Guardar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Historial */}
      <Dialog open={historialModal} onOpenChange={setHistorialModal}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle><History className="inline size-4 mr-2" />Historial — Póliza #{polizaSeleccionada?.id}</DialogTitle></DialogHeader>
          {loadingHistorial ? <Skeleton className="h-32 w-full" /> : historialEstados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin historial</p>
          ) : (
            <div className="space-y-2">
              {historialEstados.map((h, i) => (
                <div key={i} className="border-b pb-2 text-sm">
                  <div className="flex justify-between">
                    <strong>{String(h.estado_nuevo ?? h.estado ?? "—")}</strong>
                    <span className="text-xs text-muted-foreground">{String(h.fecha ?? h.created_at ?? "")}</span>
                  </div>
                  {!!h.motivo && <p className="text-xs text-muted-foreground">{String(h.motivo)}</p>}
                  {!!h.usuario_nombre && <p className="text-xs text-muted-foreground">Por: {String(h.usuario_nombre)}</p>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: WhatsApp */}
      <Dialog open={whatsappModal} onOpenChange={setWhatsappModal}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle><MessageCircle className="inline size-4 mr-2 text-muted-foreground" />WhatsApp — {polizaSeleccionada?.prospecto_nombre} {polizaSeleccionada?.prospecto_apellido}</DialogTitle></DialogHeader>
          {loadingWA ? <Skeleton className="h-40 w-full" /> : mensajesWA.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin mensajes</p>
          ) : (
            <div className="space-y-2">
              {mensajesWA.map((m, i) => {
                const esEnviado = m.tipo === "enviado"
                return (
                  <div key={i} className={`flex ${esEnviado ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${esEnviado ? "bg-primary/10" : "bg-muted"}`}>
                      <p>{String(m.contenido ?? m.mensaje ?? "")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{String(m.fecha_envio ?? "")}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Documentos */}
      <Dialog open={documentosModal} onOpenChange={setDocumentosModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle><FolderOpen className="inline size-4 mr-2 text-muted-foreground" />Documentos — Póliza #{polizaSeleccionada?.id} {polizaSeleccionada?.prospecto_nombre} {polizaSeleccionada?.prospecto_apellido}</DialogTitle>
          </DialogHeader>
          {loadingDocumentos ? <Skeleton className="h-48 w-full" /> : (() => {
            const gruposDocumentos = Object.entries(documentos)
            if (gruposDocumentos.length === 0) return (
              <p className="text-sm text-muted-foreground text-center py-8">Sin documentos cargados</p>
            )
            return (
              <div className="space-y-4">
                {gruposDocumentos.map(([grupo, docs]) => {
                  const lista = Array.isArray(docs) ? docs : [docs]
                  return (
                    <div key={grupo}>
                      <h4 className="text-sm font-semibold capitalize mb-2 text-muted-foreground">
                        {grupo.replace(/_/g, " ")}
                        <Badge variant="secondary" className="ml-2 text-xs">{lista.length}</Badge>
                      </h4>
                      <div className="divide-y rounded-md border overflow-hidden">
                        {lista.map((doc: Record<string, unknown>, idx: number) => (
                          <div key={idx} className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors text-sm">
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="size-4 text-muted-foreground shrink-0" />
                              <span className="truncate">{String(doc.nombre_original ?? doc.tipo ?? `Documento ${idx + 1}`)}</span>
                            </div>
                            <div className="flex gap-1 shrink-0 ml-2">
                              <Tooltip><TooltipTrigger asChild>
                                <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent"
                                  onClick={() => previewDocumento(Number(doc.id))}>
                                  <Eye className="size-3.5" />
                                </Button>
                              </TooltipTrigger><TooltipContent>Previsualizar</TooltipContent></Tooltip>
                              <Tooltip><TooltipTrigger asChild>
                                <Button size="icon" className="size-8 bg-primary hover:bg-primary/90 text-white border-0"
                                  onClick={() => descargarDocumento(Number(doc.id), String(doc.nombre_original ?? `documento_${idx + 1}`))}>
                                  <Download className="size-3.5" />
                                </Button>
                              </TooltipTrigger><TooltipContent>Descargar</TooltipContent></Tooltip>
                              <Tooltip><TooltipTrigger asChild>
                                <Button size="icon" variant="destructive" className="size-8"
                                  onClick={() => eliminarDocumento(Number(doc.id))}>
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </TooltipTrigger><TooltipContent>Eliminar</TooltipContent></Tooltip>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal: Preview documento */}
      <Dialog open={previewModal} onOpenChange={v => { setPreviewModal(v); if (!v && previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader><DialogTitle><Eye className="inline size-4 mr-2" />Vista previa</DialogTitle></DialogHeader>
          {previewUrl && (
            <div className="flex justify-center items-center h-[70vh]">
              <iframe src={previewUrl} className="w-full h-full rounded border" title="preview" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Editar póliza */}
      <Dialog open={editarModal} onOpenChange={v => !guardandoEdicion && setEditarModal(v)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-4xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Edit className="size-4" />
              Editar póliza #{polizaSeleccionada?.id}
              {polizaSeleccionada?.numero_poliza && <span className="text-muted-foreground text-sm font-normal">· {polizaSeleccionada.numero_poliza}</span>}
            </DialogTitle>
          </DialogHeader>
          {loadingEdicion ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : polizaEdicion ? (
            <div className="space-y-4 pt-2">
              <Tabs defaultValue="datos_personales">
                <TabsList className="w-full overflow-x-auto flex flex-nowrap h-auto gap-1 pb-1 justify-start">
                  <TabsTrigger value="datos_personales" className="text-xs whitespace-nowrap">Datos personales</TabsTrigger>
                  <TabsTrigger value="informacion_afiliado" className="text-xs whitespace-nowrap">Afiliado</TabsTrigger>
                  <TabsTrigger value="integrantes" className="text-xs whitespace-nowrap">Integrantes</TabsTrigger>
                  <TabsTrigger value="declaracion_salud" className="text-xs whitespace-nowrap">Salud</TabsTrigger>
                  <TabsTrigger value="cobertura_anterior" className="text-xs whitespace-nowrap">Cobertura ant.</TabsTrigger>
                  <TabsTrigger value="informacion_facturacion" className="text-xs whitespace-nowrap">Facturación</TabsTrigger>
                  <TabsTrigger value="datos_comerciales" className="text-xs whitespace-nowrap">Comercial</TabsTrigger>
                  <TabsTrigger value="observaciones" className="text-xs whitespace-nowrap">Observaciones</TabsTrigger>
                </TabsList>

                {/* Tab: Datos personales */}
                <TabsContent value="datos_personales" className="mt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {([
                      ["nombre", "Nombre"],
                      ["apellido", "Apellido"],
                      ["dni", "DNI"],
                      ["cuil", "CUIL"],
                      ["fecha_nacimiento", "Fecha nacimiento"],
                      ["email", "Email"],
                      ["telefono", "Teléfono"],
                      ["domicilio", "Domicilio"],
                      ["localidad", "Localidad"],
                      ["provincia", "Provincia"],
                    ] as [string, string][]).map(([campo, label]) => (
                      <div key={campo} className="space-y-1.5">
                        <Label className="text-xs font-medium">{label}</Label>
                        <Input
                          className="h-9 text-sm"
                          value={String((polizaEdicion.datos_personales as Record<string, unknown>)?.[campo] ?? "")}
                          onChange={e => setCampoEdicion("datos_personales", campo, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Tab: Información afiliado */}
                <TabsContent value="informacion_afiliado" className="mt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {([
                      ["tipo_afiliacion", "Tipo afiliación"],
                      ["plan", "Plan"],
                      ["forma_pago", "Forma de pago"],
                      ["banco", "Banco"],
                      ["sucursal", "Sucursal"],
                      ["numero_cuenta", "N° cuenta"],
                      ["cbu", "CBU"],
                    ] as [string, string][]).map(([campo, label]) => (
                      <div key={campo} className="space-y-1.5">
                        <Label className="text-xs font-medium">{label}</Label>
                        <Input
                          className="h-9 text-sm"
                          value={String((polizaEdicion.informacion_afiliado as Record<string, unknown>)?.[campo] ?? "")}
                          onChange={e => setCampoEdicion("informacion_afiliado", campo, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Tab: Integrantes */}
                <TabsContent value="integrantes" className="mt-4">
                  <div className="space-y-4">
                    {(polizaEdicion.integrantes ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Sin integrantes registrados</p>
                    ) : (polizaEdicion.integrantes ?? []).map((integ, idx) => (
                      <div key={idx} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Integrante #{idx + 1}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {(["nombre", "apellido", "dni", "fecha_nacimiento", "parentesco"] as string[]).map(campo => (
                            <div key={campo} className="space-y-1.5">
                              <Label className="text-xs font-medium capitalize">{campo.replace(/_/g, " ")}</Label>
                              <Input
                                className="h-9 text-sm"
                                value={String((integ as Record<string, unknown>)[campo] ?? "")}
                                onChange={e => setCampoEdicion("integrantes", campo, e.target.value, idx)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Tab: Declaración de salud */}
                <TabsContent value="declaracion_salud" className="mt-4">
                  <div className="space-y-2">
                    {Object.entries((polizaEdicion.declaracion_salud as Record<string, unknown>) ?? {}).map(([key, val]) => {
                      if (key === "respuestas" && typeof val === "object" && val !== null) {
                        return (
                          <div key={key} className="space-y-1">
                            <Label className="text-xs font-semibold block mb-2">Respuestas</Label>
                            {Object.entries(val as Record<string, unknown>).map(([preg, resp]) => (
                              <div key={preg} className="flex items-center justify-between py-1 border-b text-xs">
                                <span className="text-muted-foreground pr-4">{preg.replace(/_/g, " ")}</span>
                                <div className="flex items-center gap-3">
                                  <label className="flex items-center gap-1 cursor-pointer">
                                    <Checkbox checked={resp === true || resp === "Sí" || resp === "si"}
                                      onCheckedChange={v => {
                                        const nuevas = { ...(val as Record<string, unknown>), [preg]: v ? "Sí" : "No" }
                                        setCampoEdicion("declaracion_salud", "respuestas", nuevas)
                                      }} />
                                    Sí
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      }
                      if (typeof val === "string") {
                        return (
                          <div key={key} className="space-y-1.5">
                            <Label className="text-xs font-medium capitalize">{key.replace(/_/g, " ")}</Label>
                            <Textarea className="text-sm" rows={2} value={val}
                              onChange={e => setCampoEdicion("declaracion_salud", key, e.target.value)} />
                          </div>
                        )
                      }
                      return null
                    })}
                    {Object.keys((polizaEdicion.declaracion_salud as Record<string, unknown>) ?? {}).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">Sin declaración de salud registrada</p>
                    )}
                  </div>
                </TabsContent>

                {/* Tab: Cobertura anterior */}
                <TabsContent value="cobertura_anterior" className="mt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.entries((polizaEdicion.cobertura_anterior as Record<string, unknown>) ?? {}).map(([campo, val]) => (
                      <div key={campo} className="space-y-1.5">
                        <Label className="text-xs font-medium capitalize">{campo.replace(/_/g, " ")}</Label>
                        <Input className="h-9 text-sm" value={String(val ?? "")}
                          onChange={e => setCampoEdicion("cobertura_anterior", campo, e.target.value)} />
                      </div>
                    ))}
                    {Object.keys((polizaEdicion.cobertura_anterior as Record<string, unknown>) ?? {}).length === 0 && (
                      <p className="col-span-2 text-sm text-muted-foreground text-center py-6">Sin cobertura anterior</p>
                    )}
                  </div>
                </TabsContent>

                {/* Tab: Facturación */}
                <TabsContent value="informacion_facturacion" className="mt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {([
                      ["razon_social", "Razón social"],
                      ["cuit", "CUIT"],
                      ["condicion_iva", "Condición IVA"],
                      ["domicilio_fiscal", "Domicilio fiscal"],
                      ["email_facturacion", "Email facturación"],
                    ] as [string, string][]).map(([campo, label]) => (
                      <div key={campo} className="space-y-1.5">
                        <Label className="text-xs font-medium">{label}</Label>
                        <Input
                          className="h-9 text-sm"
                          value={String((polizaEdicion.informacion_facturacion as Record<string, unknown>)?.[campo] ?? "")}
                          onChange={e => setCampoEdicion("informacion_facturacion", campo, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Tab: Datos comerciales */}
                <TabsContent value="datos_comerciales" className="mt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {([
                      ["numero_poliza_oficial", "N° póliza oficial"],
                      ["vigencia_desde", "Vigencia desde"],
                      ["vigencia_hasta", "Vigencia hasta"],
                      ["prima_mensual", "Prima mensual"],
                      ["forma_pago_comercial", "Forma de pago"],
                    ] as [string, string][]).map(([campo, label]) => (
                      <div key={campo} className="space-y-1.5">
                        <Label className="text-xs font-medium">{label}</Label>
                        <Input
                          className="h-9 text-sm"
                          value={String((polizaEdicion.datos_comerciales as Record<string, unknown>)?.[campo] ?? "")}
                          onChange={e => setCampoEdicion("datos_comerciales", campo, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Tab: Observaciones */}
                <TabsContent value="observaciones" className="mt-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Observaciones generales</Label>
                    <Textarea
                      rows={6}
                      placeholder="Observaciones sobre la póliza..."
                      value={String(polizaEdicion.observaciones ?? "")}
                      onChange={e => setCampoEdicion("observaciones", "", e.target.value)}
                    />
                    <div className="flex items-center gap-2 pt-2">
                      <Checkbox
                        id="terminos"
                        checked={!!polizaEdicion.terminos_aceptados}
                        onCheckedChange={v => setCampoEdicion("terminos_aceptados", "", v)}
                      />
                      <Label htmlFor="terminos" className="text-sm cursor-pointer">Términos y condiciones aceptados</Label>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <Separator />

              {/* Motivo obligatorio */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Motivo de la edición <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  rows={3}
                  placeholder="Describí el motivo del cambio..."
                  value={motivoEdicion}
                  onChange={e => setMotivoEdicion(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="destructive" onClick={() => setEditarModal(false)} disabled={guardandoEdicion}>
                  <X className="size-3.5 mr-1.5" />Cancelar
                </Button>
                <Button onClick={guardarEdicion} disabled={guardandoEdicion || !motivoEdicion.trim()}>
                  <Save className="size-3.5 mr-1.5" />
                  {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <CargarPolizaFirmadaModal
        open={cargarFirmadaModal}
        onOpenChange={setCargarFirmadaModal}
        polizaId={polizaCargarFirmada?.id ?? 0}
        numeroPoliza={polizaCargarFirmada?.numero_poliza}
        onSuccess={fetchPolizas}
      />
      {polizaDocsLibres && (
        <SubirDocumentosLibresModal
          open={docsLibresModal}
          onOpenChange={setDocsLibresModal}
          poliza={polizaDocsLibres}
          apiContext="backoffice"
          onDocumentosActualizados={fetchPolizas}
        />
      )}
    </div>
    </TooltipProvider>
  )
}
