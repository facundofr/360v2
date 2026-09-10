import { useState, useEffect, useCallback, useMemo } from "react"
import { useConfirm } from "@/components/common/confirm-dialog"
import axios from "axios"
import { toast } from "sonner"
import { Search, RefreshCw, Download, Trash2, FileText, Filter, ChevronLeft, ChevronRight, FolderOpen, User, DownloadCloud, CheckCircle, Clock, AlertCircle, RotateCcw, Eye, Paperclip } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "@/components/ui/data-table"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Poliza {
  id: number
  numero_poliza?: string
  numero_poliza_oficial?: string
  prospecto_nombre?: string
  prospecto_apellido?: string
  prospecto_email?: string
  prospecto_telefono?: string
  plan_nombre?: string
  vendedor_nombre?: string
  vendedor_apellido?: string
  vendedor_email?: string
  supervisor_nombre?: string
  supervisor_email?: string
  estado?: string
  created_at?: string
  fecha_vencimiento?: string
  pdf_hash?: string
  total_final?: number | string
  docs_count?: number
  deleted_at?: string
}

interface Estadisticas {
  total?: number
  activas?: number
  pendientes?: number
  vencidas?: number
}

interface EstadisticasDocumentos {
  total_documentos?: number
  polizas_con_documentos?: number
  polizas_sin_documentos?: number
  tamano_total_mb?: number
  por_tipo?: { tipo: string; cantidad: number }[]
}

/** Forma real de `polizasAdminController.js` obtenerFiltrosAvanzados — antes
 * declaraba `{id, nombre}` para vendedores/supervisores (el backend devuelve
 * `first_name`/`last_name`, sin `nombre`) y `planes` como `string[]` (es un
 * array de objetos `{id, nombre, uso_count}`). */
interface FiltrosOpciones {
  vendedores?: { id: number; first_name: string; last_name: string }[]
  supervisores?: { id: number; first_name: string; last_name: string }[]
  planes?: { id: number; nombre: string; uso_count?: number }[]
  estados?: string[]
}

interface Documento {
  id: number
  nombre_original: string
  tipo_mime: string
  created_at?: string
}

export default function PolizasAdmin() {
  const confirm = useConfirm()
  const [polizas, setPolizas] = useState<Poliza[]>([])
  const [loading, setLoading] = useState(false)
  const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null)
  const [estadisticasDocs, setEstadisticasDocs] = useState<EstadisticasDocumentos | null>(null)
  const [opcionesFiltro, setOpcionesFiltro] = useState<FiltrosOpciones>({})
  const [filtros, setFiltros] = useState({ estado: "todos", vendedor_id: "todos", supervisor_id: "todos", plan: "todos", buscar: "", desde: "", hasta: "", incluir_eliminadas: false })
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)

  // Modal documentos
  const [docModal, setDocModal] = useState<{ open: boolean; poliza: Poliza | null }>({ open: false, poliza: null })
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  // Preview documento
  const [previewModal, setPreviewModal] = useState<{ open: boolean; url: string; mime: string; nombre: string } | null>(null)

  const authHeaders = { Authorization: `Bearer ${getAuthToken()}` }
  const PER_PAGE = 20

  const fetchPolizas = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pagina), limit: String(PER_PAGE) })
      Object.entries(filtros).forEach(([k, v]) => { if (v !== "" && v !== "todos" && v !== false) params.append(k, String(v)) })
      if (filtros.incluir_eliminadas) params.append("incluir_eliminadas", "true")
      const { data } = await axios.get(`${API_URL}/admin/polizas?${params}`, { headers: authHeaders })
      setPolizas(data?.data ?? data ?? [])
      setTotalPaginas(data?.pagination?.total_pages ?? 1)
    } catch {
      toast.error("Error al cargar pólizas")
    } finally {
      setLoading(false)
    }
  }, [filtros, pagina])

  const fetchEstadisticas = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/admin/polizas/estadisticas`, { headers: authHeaders })
      setEstadisticas(data?.data ?? data)
    } catch { toast.error("Error al cargar estadísticas") }
  }, [])

  // Estadísticas de documentos adjuntos (paridad con `PolizasAdmin.jsx`).
  const fetchEstadisticasDocumentos = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/admin/documentos/estadisticas`, { headers: authHeaders })
      setEstadisticasDocs(data?.data ?? data)
    } catch {
      // No es crítico: la pantalla funciona sin este bloque.
    }
  }, [])

  const fetchFiltros = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/admin/polizas/filtros`, { headers: authHeaders })
      setOpcionesFiltro(data?.data ?? {})
    } catch { toast.error("Error al cargar filtros") }
  }, [])

  useEffect(() => {
    fetchPolizas(); fetchEstadisticas(); fetchFiltros(); fetchEstadisticasDocumentos()
  }, [fetchPolizas, fetchEstadisticas, fetchFiltros, fetchEstadisticasDocumentos])

  const verDocumentos = async (pol: Poliza) => {
    setDocModal({ open: true, poliza: pol })
    setLoadingDocs(true)
    try {
      const { data } = await axios.get(`${API_URL}/admin/polizas/${pol.id}/documentos`, { headers: authHeaders })
      const raw = data?.documentos ?? data?.data ?? []
      // La API puede devolver un objeto agrupado { dni: [...], acta: [...] } o un array plano
      let lista: Documento[] = []
      if (Array.isArray(raw)) {
        lista = raw
      } else if (raw && typeof raw === "object") {
        Object.values(raw).forEach((grupo) => {
          if (Array.isArray(grupo)) lista = lista.concat(grupo as Documento[])
        })
      }
      setDocumentos(lista)
    } catch {
      toast.error("Error al cargar documentos")
    } finally {
      setLoadingDocs(false)
    }
  }

  const descargarDocumento = async (docId: number, nombre: string) => {
    try {
      const response = await axios.get(`${API_URL}/admin/documentos/${docId}/download`, { headers: authHeaders, responseType: "blob" })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement("a")
      a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error("Error al descargar documento")
    }
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
      await axios.delete(`${API_URL}/admin/documentos/${docId}`, { headers: authHeaders })
      toast.success("Documento eliminado")
      setDocumentos(prev => prev.filter(d => d.id !== docId))
    } catch {
      toast.error("Error al eliminar documento")
    }
  }

  // El backend (`polizasAdminController.js:471-487`, `eliminarPoliza`) bindea
  // `motivo_eliminacion` directo en un `db.execute` preparado — si viaja
  // `undefined` (sin body), mysql2 tira "Bind parameters must not contain
  // undefined" y el delete siempre falla con 500. Réplica de
  // `PolizasAdmin.jsx:243-277`: motivo obligatorio antes de eliminar.
  const [eliminarPolizaModal, setEliminarPolizaModal] = useState<{ open: boolean; poliza: Poliza | null; motivo: string }>({ open: false, poliza: null, motivo: "" })

  const eliminarPoliza = (pol: Poliza) => {
    setEliminarPolizaModal({ open: true, poliza: pol, motivo: "" })
  }

  const confirmarEliminarPoliza = async () => {
    const pol = eliminarPolizaModal.poliza
    const motivo = eliminarPolizaModal.motivo.trim()
    if (!pol) return
    if (!motivo) { toast.error("Debés especificar un motivo"); return }
    try {
      await axios.delete(`${API_URL}/admin/polizas/${pol.id}`, {
        headers: authHeaders,
        data: { motivo_eliminacion: motivo },
      })
      toast.success("Póliza eliminada")
      setEliminarPolizaModal({ open: false, poliza: null, motivo: "" })
      fetchPolizas()
    } catch {
      toast.error("No se pudo eliminar la póliza")
    }
  }

  const restaurarPoliza = async (pol: Poliza) => {
    const ok = await confirm({
      title: `¿Restaurar la póliza #${pol.numero_poliza ?? pol.id}?`,
      description: "La póliza volverá a estar activa.",
      confirmText: "Restaurar",
    })
    if (!ok) return
    try {
      await axios.patch(`${API_URL}/admin/polizas/${pol.id}/restaurar`, {}, { headers: authHeaders })
      toast.success("Póliza restaurada")
      fetchPolizas()
    } catch {
      toast.error("Error al restaurar la póliza")
    }
  }

  const previewDocumento = async (doc: Documento) => {
    if (!doc.tipo_mime.startsWith("image/") && doc.tipo_mime !== "application/pdf") {
      toast.info("Este tipo de archivo no se puede previsualizar")
      return
    }
    try {
      const response = await axios.get(`${API_URL}/admin/documentos/${doc.id}/preview`, { headers: authHeaders, responseType: "blob" })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      setPreviewModal({ open: true, url, mime: doc.tipo_mime, nombre: doc.nombre_original })
    } catch {
      toast.error("No se pudo previsualizar el documento")
    }
  }

  const descargarPDF = (pol: Poliza) => {
    const url = pol.pdf_hash ? `${API_URL}/polizas/pdf/${pol.pdf_hash}` : null
    if (url) window.open(url, "_blank")
    else toast.error("Esta póliza no tiene PDF disponible")
  }

  // Los 12 estados reales de `polizas.estado` (`polizasAdminController.js`
  // obtenerFiltrosAvanzados) — antes sólo cubría 4 y el resto caía en el
  // fallback "secondary" sin distinción visual.
  const estadoBadge = (estado?: string) => {
    const variants: Record<string, "ok" | "warn" | "risk" | "secondary" | "default" | "outline"> = {
      borrador: "secondary",
      pendiente_revision: "warn",
      en_revision: "warn",
      pendiente_documentos: "warn",
      pendiente_autorizacion: "warn",
      autorizada: "default",
      enviada_cliente: "default",
      firmada: "default",
      activa: "ok",
      rechazada: "risk",
      cancelada: "risk",
      vencida: "risk",
    }
    return <Badge variant={variants[estado?.toLowerCase() ?? ""] ?? "outline"}>{estado ?? "—"}</Badge>
  }

  const columns = useMemo<ColumnDef<Poliza>[]>(() => [
    {
      id: "numero",
      header: "Número",
      meta: { className: "font-mono text-xs whitespace-nowrap" },
      accessorFn: (pol) => pol.numero_poliza ?? pol.numero_poliza_oficial ?? String(pol.id),
    },
    {
      id: "cliente",
      header: "Cliente",
      accessorFn: (pol) => `${pol.prospecto_nombre ?? ""} ${pol.prospecto_apellido ?? ""}`,
      cell: ({ row }) => (
        <>
          <p className="font-medium text-sm whitespace-nowrap">{row.original.prospecto_nombre} {row.original.prospecto_apellido}</p>
          {row.original.prospecto_email && <p className="text-xs text-muted-foreground">{row.original.prospecto_email}</p>}
        </>
      ),
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => estadoBadge(row.original.estado),
    },
    {
      id: "vendedor",
      header: "Vendedor",
      meta: { className: "hidden md:table-cell text-sm whitespace-nowrap" },
      accessorFn: (pol) => `${pol.vendedor_nombre ?? ""} ${pol.vendedor_apellido ?? ""}`,
    },
    {
      accessorKey: "supervisor_nombre",
      header: "Supervisor",
      meta: { className: "hidden lg:table-cell text-sm text-muted-foreground whitespace-nowrap" },
      cell: ({ row }) => row.original.supervisor_nombre ?? "—",
    },
    {
      accessorKey: "plan_nombre",
      header: "Plan",
      meta: { className: "hidden sm:table-cell text-sm" },
      cell: ({ row }) => row.original.plan_nombre ?? "—",
    },
    {
      accessorKey: "pdf_hash",
      header: "Hash PDF",
      enableSorting: false,
      meta: { className: "hidden xl:table-cell" },
      cell: ({ row }) => row.original.pdf_hash ? <span className="font-mono text-xs text-muted-foreground">{row.original.pdf_hash.slice(0, 8)}...</span> : "—",
    },
    {
      accessorKey: "docs_count",
      header: "Docs",
      meta: { className: "w-16" },
      cell: ({ row }) => (
        <span className={`inline-flex items-center justify-center size-6 rounded-full text-xs font-bold ${(row.original.docs_count ?? 0) > 0 ? "bg-state-ok text-white" : "bg-muted text-muted-foreground"}`}>
          {row.original.docs_count ?? 0}
        </span>
      ),
    },
    {
      accessorKey: "total_final",
      header: "Total",
      meta: { className: "hidden lg:table-cell text-sm whitespace-nowrap" },
      cell: ({ row }) => row.original.total_final ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(row.original.total_final)) : "—",
    },
    {
      accessorKey: "created_at",
      header: "Fecha",
      meta: { className: "hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap" },
      cell: ({ row }) => row.original.created_at ? new Date(row.original.created_at).toLocaleDateString("es-AR") : "—",
    },
    {
      id: "acciones",
      header: "Acciones",
      enableSorting: false,
      cell: ({ row }) => {
        const pol = row.original
        return (
          <div className="flex gap-1">
            <Button size="icon" className="size-8 bg-muted hover:bg-muted/80 text-foreground border" variant="outline" onClick={() => verDocumentos(pol)}>
              <FolderOpen className="size-3.5" />
            </Button>
            {pol.deleted_at ? (
              <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => restaurarPoliza(pol)} title="Restaurar póliza">
                <RotateCcw className="size-3.5" />
              </Button>
            ) : (
              <Button size="icon" variant="destructive" className="size-8" onClick={() => eliminarPoliza(pol)}>
                <Trash2 className="size-3.5" />
              </Button>
            )}
            <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => descargarPDF(pol)}>
              <DownloadCloud className="size-3.5" />
            </Button>
          </div>
        )
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  return (
    <div className="space-y-4">
      {/* Estadísticas */}
      {estadisticas && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-3 text-center">
            <FileText className="size-4 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold text-foreground">{estadisticas.total ?? 0}</p>
            <p className="text-xs text-muted-foreground">Total pólizas</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <CheckCircle className="size-4 mx-auto mb-1 text-state-ok-text" />
            <p className="text-2xl font-bold text-foreground">{estadisticas.activas ?? 0}</p>
            <p className="text-xs text-muted-foreground">Activas</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <Clock className="size-4 mx-auto mb-1 text-state-warn-text" />
            <p className="text-2xl font-bold text-foreground">{estadisticas.pendientes ?? 0}</p>
            <p className="text-xs text-muted-foreground">Pendientes</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <AlertCircle className="size-4 mx-auto mb-1 text-state-risk-text" />
            <p className="text-2xl font-bold text-foreground">{estadisticas.vencidas ?? 0}</p>
            <p className="text-xs text-muted-foreground">Vencidas</p>
          </CardContent></Card>
        </div>
      )}

      {/* Estadísticas de documentos adjuntos */}
      {estadisticasDocs && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-3 text-center">
            <Paperclip className="size-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold text-foreground">{estadisticasDocs.total_documentos ?? 0}</p>
            <p className="text-xs text-muted-foreground">Documentos</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <CheckCircle className="size-4 mx-auto mb-1 text-state-ok-text" />
            <p className="text-2xl font-bold text-foreground">{estadisticasDocs.polizas_con_documentos ?? 0}</p>
            <p className="text-xs text-muted-foreground">Pólizas con docs</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <AlertCircle className="size-4 mx-auto mb-1 text-state-warn-text" />
            <p className="text-2xl font-bold text-foreground">{estadisticasDocs.polizas_sin_documentos ?? 0}</p>
            <p className="text-xs text-muted-foreground">Pólizas sin docs</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <FileText className="size-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold text-foreground">
              {estadisticasDocs.tamano_total_mb != null ? `${estadisticasDocs.tamano_total_mb} MB` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Almacenamiento</p>
          </CardContent></Card>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar póliza..." value={filtros.buscar} onChange={e => setFiltros(f => ({ ...f, buscar: e.target.value }))} />
        </div>
        <Select value={filtros.estado} onValueChange={v => setFiltros(f => ({ ...f, estado: v }))}>
          <SelectTrigger className="w-40"><Filter className="size-3 mr-1" /><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {(opcionesFiltro.estados ?? []).map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtros.vendedor_id} onValueChange={v => setFiltros(f => ({ ...f, vendedor_id: v }))}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Vendedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los vendedores</SelectItem>
            {(opcionesFiltro.vendedores ?? []).map(v => <SelectItem key={v.id} value={String(v.id)}>{v.first_name} {v.last_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtros.supervisor_id} onValueChange={v => setFiltros(f => ({ ...f, supervisor_id: v }))}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Supervisor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los supervisores</SelectItem>
            {(opcionesFiltro.supervisores ?? []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.first_name} {s.last_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtros.plan} onValueChange={v => setFiltros(f => ({ ...f, plan: v }))}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Plan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los planes</SelectItem>
            {(opcionesFiltro.planes ?? []).map(p => <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Label htmlFor="polizas-desde" className="text-xs text-muted-foreground">Desde</Label>
          <Input id="polizas-desde" type="date" className="w-36" value={filtros.desde} onChange={e => setFiltros(f => ({ ...f, desde: e.target.value }))} />
        </div>
        <div className="flex items-center gap-1.5">
          <Label htmlFor="polizas-hasta" className="text-xs text-muted-foreground">Hasta</Label>
          <Input id="polizas-hasta" type="date" className="w-36" value={filtros.hasta} onChange={e => setFiltros(f => ({ ...f, hasta: e.target.value }))} />
        </div>
        <Button variant="outline" size="icon" onClick={fetchPolizas}><RefreshCw className="size-4" /></Button>
      </div>

      {/* Filtro incluir eliminadas */}
      <div className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          id="incluir-eliminadas"
          checked={filtros.incluir_eliminadas}
          onChange={e => setFiltros(f => ({ ...f, incluir_eliminadas: e.target.checked }))}
          className="rounded"
        />
        <label htmlFor="incluir-eliminadas" className="text-muted-foreground cursor-pointer">Incluir pólizas eliminadas</label>
      </div>

      {/* Tabla */}
      {loading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : (
        <>
          {/* pageSize = PER_PAGE: cada página ya viene acotada por el backend
              (`page`/`limit` en fetchPolizas), así que el paginador propio de
              DataTable no debe activarse — la paginación real es la de abajo,
              que dispara un nuevo fetch al servidor. */}
          <DataTable columns={columns} data={polizas} pageSize={PER_PAGE} emptyMessage="Sin pólizas" />

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Página {pagina} de {totalPaginas}</p>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="size-8" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}><ChevronLeft className="size-4" /></Button>
                <Button variant="outline" size="icon" className="size-8" disabled={pagina === totalPaginas} onClick={() => setPagina(p => p + 1)}><ChevronRight className="size-4" /></Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal documentos */}
      <Dialog open={docModal.open} onOpenChange={open => setDocModal({ open, poliza: open ? docModal.poliza : null })}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="size-4 text-muted-foreground" />
              Documentos de Póliza N° {docModal.poliza?.numero_poliza ?? docModal.poliza?.numero_poliza_oficial ?? docModal.poliza?.id}
            </DialogTitle>
          </DialogHeader>

          {/* Info cards: Cliente / Vendedor / Supervisor */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 space-y-1">
              <p className="text-sm font-medium flex items-center gap-1.5"><User className="size-3.5 text-muted-foreground" /> Cliente</p>
              <p className="text-sm">{docModal.poliza?.prospecto_nombre} {docModal.poliza?.prospecto_apellido}</p>
              {docModal.poliza?.prospecto_email && <p className="text-xs text-muted-foreground">{docModal.poliza.prospecto_email}</p>}
            </div>
            <div className="rounded-lg border p-3 space-y-1">
              <p className="text-sm font-medium flex items-center gap-1.5"><User className="size-3.5 text-muted-foreground" /> Vendedor</p>
              <p className="text-sm">{[docModal.poliza?.vendedor_nombre, docModal.poliza?.vendedor_apellido].filter(Boolean).join(" ") || "Sin vendedor"}</p>
              {docModal.poliza?.vendedor_email && <p className="text-xs text-muted-foreground">{docModal.poliza.vendedor_email}</p>}
            </div>
            <div className="rounded-lg border p-3 space-y-1">
              <p className="text-sm font-medium flex items-center gap-1.5"><User className="size-3.5 text-muted-foreground" /> Supervisor</p>
              <p className="text-sm">{docModal.poliza?.supervisor_nombre ?? "Sin supervisor asignado"}</p>
              {docModal.poliza?.supervisor_email && <p className="text-xs text-muted-foreground">{docModal.poliza.supervisor_email}</p>}
            </div>
          </div>

          {/* Estadísticas */}
          <div className="rounded-lg bg-muted/60 px-4 py-2.5 text-sm flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground shrink-0" />
            <span>
              <strong>Estadísticas:</strong> {documentos.length} documento{documentos.length !== 1 ? "s" : ""} en{" "}
              {new Set(documentos.map(d => d.tipo_mime)).size} tipo{new Set(documentos.map(d => d.tipo_mime)).size !== 1 ? "s" : ""} diferentes.
            </span>
          </div>

          {/* Lista de documentos */}
          {loadingDocs ? <Skeleton className="h-32 w-full" /> : (
            documentos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No hay documentos disponibles para esta póliza</p>
            ) : (
              <div className="space-y-2">
                {documentos.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <FileText className="size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.nombre_original}</p>
                      <p className="text-xs text-muted-foreground">{doc.tipo_mime}</p>
                    </div>
                    <Button size="icon" className="size-8 bg-muted text-foreground border hover:bg-accent" onClick={() => previewDocumento(doc)} title="Previsualizar">
                      <Eye className="size-3.5" />
                    </Button>
                    <Button size="icon" className="size-8 bg-primary hover:bg-primary/90 text-white border-0" onClick={() => descargarDocumento(doc.id, doc.nombre_original)}>
                      <Download className="size-3.5" />
                    </Button>
                    <Button size="icon" variant="destructive" className="size-8" onClick={() => eliminarDocumento(doc.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )
          )}

          <DialogFooter>
            <Button variant="destructive" onClick={() => setDocModal({ open: false, poliza: null })}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal preview documento */}
      <Dialog open={!!previewModal?.open} onOpenChange={open => { if (!open && previewModal?.url) { window.URL.revokeObjectURL(previewModal.url); setPreviewModal(null) } }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh]" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="size-4" /> {previewModal?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center overflow-auto max-h-[70vh]">
            {previewModal?.mime.startsWith("image/") ? (
              <img src={previewModal.url} alt={previewModal.nombre} className="max-w-full max-h-full object-contain" />
            ) : previewModal?.mime === "application/pdf" ? (
              <iframe src={previewModal.url} className="w-full h-[65vh]" title={previewModal.nombre} />
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => { if (previewModal?.url) window.URL.revokeObjectURL(previewModal.url); setPreviewModal(null) }}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eliminar póliza: motivo obligatorio (réplica de PolizasAdmin.jsx:243-277) */}
      <Dialog open={eliminarPolizaModal.open} onOpenChange={open => !open && setEliminarPolizaModal({ open: false, poliza: null, motivo: "" })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar la póliza #{eliminarPolizaModal.poliza?.numero_poliza ?? eliminarPolizaModal.poliza?.id}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="motivo-eliminar-poliza">Motivo de eliminación *</Label>
            <Textarea
              id="motivo-eliminar-poliza"
              rows={3}
              placeholder="Describí por qué eliminás esta póliza..."
              value={eliminarPolizaModal.motivo}
              onChange={e => setEliminarPolizaModal(m => ({ ...m, motivo: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEliminarPolizaModal({ open: false, poliza: null, motivo: "" })}>Cancelar</Button>
            <Button variant="destructive" disabled={!eliminarPolizaModal.motivo.trim()} onClick={confirmarEliminarPoliza}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
