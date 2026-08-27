import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import { API_URL } from "@/lib/config"
import { getAuthHeaders } from "@/lib/auth"
import DocumentPreviewModal from "@/components/modals/DocumentPreviewModal"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileText, X, CheckCircle, Eye, Loader2 } from "lucide-react"

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface TipoDocumento {
  key: string
  label: string
  icon: string
  maxFiles: number
  description: string
}

interface DocumentoExistente {
  id: number
  tipo: string
  nombre: string
  tamanio?: number
  url?: string
  tipo_mime?: string
}

/** Resumen de completitud que devuelve `.../documentos/estadisticas`. */
interface EstadisticasDocumentos {
  total_documentos?: number
  tipos_cargados?: number
  tipos_totales?: number
  porcentaje_completitud?: number
}

interface Props {
  polizaId: number | string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDocumentosActualizados?: () => void
}

// ─── Config ───────────────────────────────────────────────────────────────────
const TIPOS: TipoDocumento[] = [
  {
    key: "codem",
    label: "CODEM",
    icon: "📋",
    maxFiles: 1,
    description: "Certificado de Discapacidad y/o Enfermedad Médica",
  },
  {
    key: "formulario_f152",
    label: "Formulario F152",
    icon: "📝",
    maxFiles: 1,
    description: "Formulario de solicitud de afiliación",
  },
  {
    key: "formulario_f184",
    label: "Formulario F184",
    icon: "📋",
    maxFiles: 1,
    description: "Formulario de opción de cambio",
  },
  {
    key: "constancia_inscripcion",
    label: "Constancia de Inscripción",
    icon: "✅",
    maxFiles: 1,
    description: "Constancia de inscripción en AFIP",
  },
  {
    key: "comprobante_pago_cuota",
    label: "Comprobantes de Pago",
    icon: "💳",
    maxFiles: 12,
    description: "Comprobantes de pago de cuotas (máx. 12)",
  },
  {
    key: "estudios_medicos",
    label: "Estudios Médicos",
    icon: "🏥",
    maxFiles: 20,
    description: "Estudios, análisis y/o informes médicos (máx. 20)",
  },
]

type ArchivosMap = Record<string, File[]>

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 ** 2).toFixed(1)} MB`
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function CargaMultipleDocumentos({
  polizaId,
  open,
  onOpenChange,
  onDocumentosActualizados,
}: Props) {
  const emptyFiles = () =>
    Object.fromEntries(TIPOS.map((t) => [t.key, []])) as ArchivosMap

  const [archivos, setArchivos] = React.useState<ArchivosMap>(emptyFiles())
  const [existentes, setExistentes] = React.useState<
    Record<string, DocumentoExistente[]>
  >({})
  const [uploading, setUploading] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [loadingInit, setLoadingInit] = React.useState(false)
  const [estadisticas, setEstadisticas] =
    React.useState<EstadisticasDocumentos | null>(null)
  const [preview, setPreview] = React.useState<{
    url: string
    mime: string
    nombre: string
  } | null>(null)

  /**
   * Trae los documentos ya cargados y las estadísticas de completitud, igual
   * que `cargarDatos` en producción (`CargaMultipleDocumentos.jsx:108`).
   */
  const cargarDatos = React.useCallback(async () => {
    if (!polizaId) return
    setLoadingInit(true)
    try {
      const [docsRes, statsRes] = await Promise.allSettled([
        axios.get(`${API_URL}/supervisor/polizas/${polizaId}/documentos`, {
          headers: getAuthHeaders(),
        }),
        axios.get(
          `${API_URL}/supervisor/polizas/${polizaId}/documentos/estadisticas`,
          { headers: getAuthHeaders() }
        ),
      ])
      setExistentes(
        docsRes.status === "fulfilled"
          ? (docsRes.value.data?.documentos ?? {})
          : {}
      )
      setEstadisticas(
        statsRes.status === "fulfilled"
          ? (statsRes.value.data?.data ?? null)
          : null
      )
    } finally {
      setLoadingInit(false)
    }
  }, [polizaId])

  // Al abrir: limpia la selección pendiente y trae el estado del servidor.
  React.useEffect(() => {
    if (!open || !polizaId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intencional al abrir el modal
    setArchivos(emptyFiles())
    cargarDatos()
  }, [open, polizaId, cargarDatos])

  const handleFileChange = (tipo: TipoDocumento, files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files)
    setArchivos((prev) => {
      const existing = prev[tipo.key] ?? []
      const combined = [...existing, ...arr].slice(0, tipo.maxFiles)
      return { ...prev, [tipo.key]: combined }
    })
  }

  const removeFile = (key: string, idx: number) => {
    setArchivos((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== idx),
    }))
  }

  /**
   * Sube los archivos uno por uno a `POST .../documentos/multiple`.
   *
   * ⚠️ NO consolidar en un solo request contra `.../documentos`: esa ruta no
   * existe en el backend (`supervisor/polizasRoutes.js` sólo declara
   * `/:id/documentos/multiple`) y devolvía 404. El contrato real es un archivo
   * por request, en el campo `documentos`, con `tipos_documento` como JSON array
   * (`polizasController.js:1589,1655`). Es lo que hace producción
   * (`CargaMultipleDocumentos.jsx:206`).
   */
  const handleUpload = async () => {
    const pendientes = Object.entries(archivos).flatMap(([tipo, files]) =>
      files.map((file) => ({ tipo, file }))
    )
    if (pendientes.length === 0) {
      toast.error("Seleccioná al menos un archivo")
      return
    }

    setUploading(true)
    setProgress(0)

    let subidos = 0
    const errores: string[] = []

    for (const { tipo, file } of pendientes) {
      try {
        const fd = new FormData()
        fd.append("documentos", file)
        fd.append("tipos_documento", JSON.stringify([tipo]))

        await axios.post(
          `${API_URL}/supervisor/polizas/${polizaId}/documentos/multiple`,
          fd,
          {
            headers: {
              ...getAuthHeaders(),
              "Content-Type": "multipart/form-data",
            },
          }
        )
        subidos++
      } catch (err) {
        const msg = (err as { response?: { data?: { message?: string } } })
          ?.response?.data?.message
        errores.push(`${file.name}: ${msg ?? "error al subir"}`)
      } finally {
        setProgress(
          Math.round(((subidos + errores.length) / pendientes.length) * 100)
        )
      }
    }

    setUploading(false)
    setProgress(0)

    if (errores.length > 0) {
      toast.error(`${errores.length} archivo(s) fallaron`, {
        description: errores.join("\n"),
      })
    }
    if (subidos > 0) {
      toast.success(`${subidos} documento(s) cargado(s) correctamente`)
      setArchivos(emptyFiles())
      await cargarDatos()
      onDocumentosActualizados?.()
      if (errores.length === 0) onOpenChange(false)
    }
  }

  /** Previsualiza un documento ya cargado. Requiere blob: el endpoint pide header. */
  const previsualizar = async (doc: DocumentoExistente) => {
    try {
      const { data, headers } = await axios.get(
        `${API_URL}/supervisor/polizas/documentos/${doc.id}/preview`,
        { headers: getAuthHeaders(), responseType: "blob" }
      )
      const mime =
        doc.tipo_mime ||
        String(headers["content-type"] ?? "") ||
        "application/octet-stream"
      setPreview({
        url: URL.createObjectURL(new Blob([data], { type: mime })),
        mime,
        nombre: doc.nombre,
      })
    } catch {
      toast.error("No se pudo previsualizar el documento")
    }
  }

  const totalArchivos = Object.values(archivos).reduce(
    (s, a) => s + a.length,
    0
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Cargar Documentos — Póliza #{polizaId}
            </DialogTitle>
          </DialogHeader>

          {/* Completitud documental (GET .../documentos/estadisticas) */}
          {estadisticas && (
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Completitud documental
                </span>
                <span className="font-semibold tabular-nums">
                  {estadisticas.tipos_cargados ?? 0}/
                  {estadisticas.tipos_totales ?? TIPOS.length} tipos
                  {estadisticas.total_documentos != null &&
                    ` · ${estadisticas.total_documentos} archivos`}
                </span>
              </div>
              {estadisticas.porcentaje_completitud != null && (
                <Progress
                  value={estadisticas.porcentaje_completitud}
                  className="mt-2 h-1.5"
                />
              )}
            </div>
          )}

          {loadingInit ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="mt-2 space-y-4">
              {TIPOS.map((tipo) => {
                const files = archivos[tipo.key] ?? []
                const existentesDelTipo = existentes[tipo.key] ?? []
                return (
                  <div
                    key={tipo.key}
                    className="space-y-2 rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {tipo.icon} {tipo.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tipo.description}
                        </p>
                      </div>
                      <Badge
                        variant={files.length > 0 ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {files.length}/{tipo.maxFiles}
                      </Badge>
                    </div>

                    {/* Existentes */}
                    {existentesDelTipo.length > 0 && (
                      <div className="space-y-1">
                        {existentesDelTipo.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between rounded bg-muted/40 px-2 py-1"
                          >
                            <span className="flex items-center gap-1 text-xs">
                              <CheckCircle className="h-3 w-3 text-state-ok-text" />
                              {doc.nombre}
                              {doc.tamanio && (
                                <span className="ml-1 text-muted-foreground">
                                  ({formatBytes(doc.tamanio)})
                                </span>
                              )}
                            </span>
                            {/* Preview por blob: el endpoint exige header Authorization,
                              que una pestaña nueva no puede mandar. */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              title="Previsualizar"
                              aria-label={`Previsualizar ${doc.nombre}`}
                              onClick={() => previsualizar(doc)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Nuevos archivos seleccionados */}
                    {files.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded bg-muted px-2 py-1"
                      >
                        <span className="flex items-center gap-1 text-xs">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          {f.name}
                          <span className="ml-1 text-muted-foreground">
                            ({formatBytes(f.size)})
                          </span>
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1"
                          onClick={() => removeFile(tipo.key, i)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}

                    {/* Input */}
                    {files.length < tipo.maxFiles && (
                      <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-primary hover:underline">
                        <Upload className="h-3 w-3" />
                        Seleccionar {tipo.maxFiles > 1 ? "archivos" : "archivo"}
                        <input
                          type="file"
                          multiple={tipo.maxFiles > 1}
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          className="hidden"
                          onChange={(e) =>
                            handleFileChange(tipo, e.target.files)
                          }
                        />
                      </label>
                    )}
                  </div>
                )
              })}

              {/* Progreso */}
              {uploading && (
                <div className="space-y-1">
                  <Progress value={progress} className="h-2" />
                  <p className="text-center text-xs text-muted-foreground">
                    Subiendo… {progress}%
                  </p>
                </div>
              )}

              {totalArchivos === 0 && (
                <Alert>
                  <AlertDescription className="text-sm">
                    Seleccioná al menos un archivo para continuar.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={uploading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={uploading || totalArchivos === 0}
                  className="gap-1"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Cargar {totalArchivos > 0 && `(${totalArchivos})`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DocumentPreviewModal
        open={!!preview}
        onOpenChange={(v) => {
          if (!v && preview) {
            URL.revokeObjectURL(preview.url)
            setPreview(null)
          }
        }}
        previewUrl={preview?.url}
        previewMime={preview?.mime}
        documentName={preview?.nombre}
      />
    </>
  )
}
