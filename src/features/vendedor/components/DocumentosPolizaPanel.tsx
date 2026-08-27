import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import { Eye, Download, Pencil, Trash2, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import DocumentPreviewModal from "@/components/modals/DocumentPreviewModal"
import { useConfirm } from "@/components/common/confirm-dialog"
import { API_URL } from "@/lib/config"
import { getAuthHeaders } from "@/lib/auth"
import {
  aplanarDocumentos,
  descargarDocumentoProtegido,
  formatFileSize,
  formatTipoDocumento,
  type DocumentoPoliza,
} from "@/lib/documentos"

export type ApiContextDocumentos = "vendedor" | "supervisor" | "backoffice"

interface Props {
  polizaId: number | null
  apiContext?: ApiContextDocumentos
  /** Muestra la acción de eliminar (la usa el editor de pólizas, no el listado). */
  permitirEliminar?: boolean
  /** Se dispara después de cualquier alta/baja/modificación. */
  onCambio?: () => void
}

export interface DocumentosPolizaPanelRef {
  recargar: () => Promise<void>
}

/** Tamaño máximo para el reemplazo de un documento (igual que producción). */
const MAX_BYTES = 10 * 1024 * 1024

function baseUrl(apiContext: ApiContextDocumentos) {
  if (apiContext === "supervisor") return `${API_URL}/supervisor/polizas`
  if (apiContext === "backoffice") return `${API_URL}/backoffice/polizas`
  return `${API_URL}/vendedor/polizas`
}

/**
 * Listado y mantenimiento de los documentos de una póliza: descargar,
 * previsualizar, reemplazar indicando motivo y —opcionalmente— eliminar.
 *
 * Réplica del modal de producción (`ProspectosDashboard.jsx:3202-3320`) y del
 * bloque de documentos de `EditarPolizaModal.jsx:180-322`.
 */
export const DocumentosPolizaPanel = React.forwardRef<DocumentosPolizaPanelRef, Props>(
  function DocumentosPolizaPanel({ polizaId, apiContext = "vendedor", permitirEliminar = false, onCambio }, ref) {
    const [documentos, setDocumentos] = React.useState<DocumentoPoliza[]>([])
    const [loading, setLoading] = React.useState(false)

    const [preview, setPreview] = React.useState<{ url: string; mime: string; nombre: string } | null>(null)

    const [aActualizar, setAActualizar] = React.useState<DocumentoPoliza | null>(null)
    const [nuevoArchivo, setNuevoArchivo] = React.useState<File | null>(null)
    const [motivo, setMotivo] = React.useState("")
    const [guardando, setGuardando] = React.useState(false)

    const confirm = useConfirm()
    const base = baseUrl(apiContext)

    const cargar = React.useCallback(async () => {
      if (!polizaId) return
      setLoading(true)
      try {
        const { data } = await axios.get(`${base}/${polizaId}/documentos`, { headers: getAuthHeaders() })
        setDocumentos(aplanarDocumentos(data))
      } catch {
        setDocumentos([])
        toast.error("No se pudieron cargar los documentos")
      } finally {
        setLoading(false)
      }
    }, [polizaId, base])

    React.useEffect(() => { cargar() }, [cargar])
    React.useImperativeHandle(ref, () => ({ recargar: cargar }), [cargar])

    const cerrarPreview = () => {
      if (preview) URL.revokeObjectURL(preview.url)
      setPreview(null)
    }

    const previsualizar = async (doc: DocumentoPoliza) => {
      try {
        const { data, headers } = await axios.get(`${base}/documentos/${doc.id}/preview`, {
          headers: getAuthHeaders(),
          responseType: "blob",
        })
        const mime = doc.tipo_mime || String(headers["content-type"] ?? "") || "application/octet-stream"
        setPreview({
          url: URL.createObjectURL(new Blob([data], { type: mime })),
          mime,
          nombre: doc.nombre_original,
        })
      } catch {
        toast.error("No se pudo previsualizar el documento")
      }
    }

    const descargar = (doc: DocumentoPoliza) =>
      descargarDocumentoProtegido(`${base}/documentos/${doc.id}/download`, doc.nombre_original)

    const elegirArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (file.size > MAX_BYTES) {
        toast.error("El archivo supera el máximo de 10 MB")
        e.target.value = ""
        return
      }
      setNuevoArchivo(file)
    }

    const cancelarActualizacion = () => {
      setAActualizar(null)
      setNuevoArchivo(null)
      setMotivo("")
    }

    const confirmarActualizacion = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!aActualizar) return
      if (!nuevoArchivo) { toast.error("Seleccione un archivo"); return }
      if (!motivo.trim()) { toast.error("Indique el motivo de la actualización"); return }

      setGuardando(true)
      try {
        const fd = new FormData()
        fd.append("documento", nuevoArchivo)
        fd.append("motivo_actualizacion", motivo.trim())

        await axios.put(`${API_URL}/polizas/documentos/${aActualizar.id}/actualizar`, fd, {
          headers: { ...getAuthHeaders(), "Content-Type": "multipart/form-data" },
        })

        toast.success("Documento actualizado correctamente")
        cancelarActualizacion()
        await cargar()
        onCambio?.()
      } catch (err) {
        toast.error(
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "No se pudo actualizar el documento"
        )
      } finally {
        setGuardando(false)
      }
    }

    const eliminar = async (doc: DocumentoPoliza) => {
      const ok = await confirm({
        title: "¿Eliminar documento?",
        description: `${formatTipoDocumento(doc.tipo_documento)} — ${doc.nombre_original}. Esta acción no se puede deshacer.`,
        confirmText: "Sí, eliminar",
        destructive: true,
      })
      if (!ok) return
      try {
        await axios.delete(`${base}/documentos/${doc.id}`, { headers: getAuthHeaders() })
        toast.success("Documento eliminado")
        await cargar()
        onCambio?.()
      } catch (err) {
        toast.error(
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "No se pudo eliminar el documento"
        )
      }
    }

    if (loading) {
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
      )
    }

    if (documentos.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <FileText className="size-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No hay documentos cargados para esta póliza</p>
        </div>
      )
    }

    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2">
          {documentos.map(doc => (
            <Card key={doc.id} className="flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <span className="text-sm font-semibold leading-tight">
                  {doc.observaciones || formatTipoDocumento(doc.tipo_documento)}
                </span>
                {doc.integrante_index !== null && doc.integrante_index !== undefined && (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    Integrante {doc.integrante_index + 1}
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="flex-1 space-y-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Archivo</p>
                  <p className="break-all font-medium">{doc.nombre_original}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tamaño</p>
                  <p className="font-medium tabular-nums">
                    {formatFileSize(doc["tamaño_bytes"] ?? doc.tamano_bytes)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Subido</p>
                  <p className="font-medium">
                    {doc.created_at
                      ? new Date(doc.created_at).toLocaleString("es-AR", {
                          year: "numeric", month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })
                      : "—"}
                  </p>
                </div>
              </CardContent>

              <CardFooter className="flex flex-wrap gap-2 pt-0">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => descargar(doc)}>
                  <Download className="size-3 mr-1" />Descargar
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAActualizar(doc); setNuevoArchivo(null); setMotivo("") }}>
                  <Pencil className="size-3 mr-1" />Actualizar
                </Button>
                {permitirEliminar && (
                  <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => eliminar(doc)}>
                    <Trash2 className="size-3 mr-1" />Eliminar
                  </Button>
                )}
                <Button size="sm" variant="secondary" className="h-7 text-xs ml-auto" onClick={() => previsualizar(doc)}>
                  <Eye className="size-3 mr-1" />Ver
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Reemplazo de un documento existente */}
        <Dialog open={!!aActualizar} onOpenChange={v => { if (!v) cancelarActualizacion() }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Actualizar documento</DialogTitle>
            </DialogHeader>

            <form onSubmit={confirmarActualizacion} className="space-y-4">
              {aActualizar && (
                <div className="rounded-md border bg-muted/40 p-3 text-xs">
                  <p className="text-muted-foreground">Documento actual</p>
                  <p className="break-all font-medium">{aActualizar.nombre_original}</p>
                  <p className="mt-1 text-muted-foreground">{formatTipoDocumento(aActualizar.tipo_documento)}</p>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="doc-nuevo-archivo">Nuevo archivo *</Label>
                <Input id="doc-nuevo-archivo" type="file" accept="image/*,.pdf" onChange={elegirArchivo} />
                <p className="text-xs text-muted-foreground">Máximo 10 MB</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="doc-motivo">Motivo de la actualización *</Label>
                <Textarea
                  id="doc-motivo" rows={3} value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  placeholder="Ej: el DNI estaba ilegible"
                />
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={cancelarActualizacion} disabled={guardando}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={guardando || !nuevoArchivo || !motivo.trim()}>
                  {guardando && <Loader2 className="size-4 mr-2 animate-spin" />}
                  Actualizar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <DocumentPreviewModal
          open={!!preview}
          onOpenChange={v => { if (!v) cerrarPreview() }}
          previewUrl={preview?.url}
          previewMime={preview?.mime}
          documentName={preview?.nombre}
        />
      </>
    )
  }
)

export default DocumentosPolizaPanel
