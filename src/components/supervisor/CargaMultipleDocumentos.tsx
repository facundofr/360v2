import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import { API_URL } from "@/lib/config"
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
  key:         string
  label:       string
  icon:        string
  maxFiles:    number
  description: string
}

interface DocumentoExistente {
  id:       number
  tipo:     string
  nombre:   string
  tamanio?: number
  url?:     string
}

interface Props {
  polizaId:                  number | string
  open:                      boolean
  onOpenChange:              (open: boolean) => void
  onDocumentosActualizados?: () => void
}

// ─── Config ───────────────────────────────────────────────────────────────────
const TIPOS: TipoDocumento[] = [
  { key: "codem",                    label: "CODEM",                    icon: "📋", maxFiles: 1,  description: "Certificado de Discapacidad y/o Enfermedad Médica" },
  { key: "formulario_f152",          label: "Formulario F152",          icon: "📝", maxFiles: 1,  description: "Formulario de solicitud de afiliación" },
  { key: "formulario_f184",          label: "Formulario F184",          icon: "📋", maxFiles: 1,  description: "Formulario de opción de cambio" },
  { key: "constancia_inscripcion",   label: "Constancia de Inscripción",icon: "✅", maxFiles: 1,  description: "Constancia de inscripción en AFIP" },
  { key: "comprobante_pago_cuota",   label: "Comprobantes de Pago",     icon: "💳", maxFiles: 12, description: "Comprobantes de pago de cuotas (máx. 12)" },
  { key: "estudios_medicos",         label: "Estudios Médicos",         icon: "🏥", maxFiles: 20, description: "Estudios, análisis y/o informes médicos (máx. 20)" },
]

type ArchivosMap = Record<string, File[]>

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 ** 2).toFixed(1)} MB`
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function CargaMultipleDocumentos({ polizaId, open, onOpenChange, onDocumentosActualizados }: Props) {
  const emptyFiles = () => Object.fromEntries(TIPOS.map((t) => [t.key, []])) as ArchivosMap

  const [archivos,    setArchivos]    = React.useState<ArchivosMap>(emptyFiles())
  const [existentes,  setExistentes]  = React.useState<Record<string, DocumentoExistente[]>>({})
  const [uploading,   setUploading]   = React.useState(false)
  const [progress,    setProgress]    = React.useState(0)
  const [loadingInit, setLoadingInit] = React.useState(false)

  // Cargar documentos existentes al abrir
  React.useEffect(() => {
    if (!open || !polizaId) return
    setArchivos(emptyFiles())

    const load = async () => {
      setLoadingInit(true)
      try {
        const { data } = await axios.get(`${API_URL}/supervisor/polizas/${polizaId}/documentos`)
        setExistentes(data.documentos ?? {})
      } catch { setExistentes({}) }
      finally { setLoadingInit(false) }
    }
    load()
  }, [open, polizaId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setArchivos((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }))
  }

  const handleUpload = async () => {
    const hasSomething = Object.values(archivos).some((a) => a.length > 0)
    if (!hasSomething) { toast.error("Seleccioná al menos un archivo"); return }

    setUploading(true); setProgress(0)
    try {
      const fd = new FormData()
      for (const [key, files] of Object.entries(archivos)) {
        files.forEach((f) => fd.append(key, f))
      }
      await axios.post(`${API_URL}/supervisor/polizas/${polizaId}/documentos`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100))
        },
      })
      toast.success("Documentos cargados exitosamente")
      onDocumentosActualizados?.()
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? "Error al cargar los documentos")
    } finally {
      setUploading(false); setProgress(0)
    }
  }

  const totalArchivos = Object.values(archivos).reduce((s, a) => s + a.length, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Cargar Documentos — Póliza #{polizaId}
          </DialogTitle>
        </DialogHeader>

        {loadingInit ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4 mt-2">
            {TIPOS.map((tipo) => {
              const files = archivos[tipo.key] ?? []
              const existentesDelTipo = existentes[tipo.key] ?? []
              return (
                <div key={tipo.key} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{tipo.icon} {tipo.label}</p>
                      <p className="text-xs text-muted-foreground">{tipo.description}</p>
                    </div>
                    <Badge variant={files.length > 0 ? "default" : "secondary"} className="text-xs">
                      {files.length}/{tipo.maxFiles}
                    </Badge>
                  </div>

                  {/* Existentes */}
                  {existentesDelTipo.length > 0 && (
                    <div className="space-y-1">
                      {existentesDelTipo.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between bg-muted/40 rounded px-2 py-1">
                          <span className="text-xs flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            {doc.nombre}
                            {doc.tamanio && <span className="text-muted-foreground ml-1">({formatBytes(doc.tamanio)})</span>}
                          </span>
                          {doc.url && (
                            <Button size="sm" variant="ghost" className="h-6 px-2" asChild>
                              <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-3 w-3" />
                              </a>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Nuevos archivos seleccionados */}
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 rounded px-2 py-1">
                      <span className="text-xs flex items-center gap-1">
                        <FileText className="h-3 w-3 text-blue-500" />
                        {f.name}
                        <span className="text-muted-foreground ml-1">({formatBytes(f.size)})</span>
                      </span>
                      <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => removeFile(tipo.key, i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}

                  {/* Input */}
                  {files.length < tipo.maxFiles && (
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-primary hover:underline w-fit">
                      <Upload className="h-3 w-3" />
                      Seleccionar {tipo.maxFiles > 1 ? "archivos" : "archivo"}
                      <input
                        type="file"
                        multiple={tipo.maxFiles > 1}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        className="hidden"
                        onChange={(e) => handleFileChange(tipo, e.target.files)}
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
                <p className="text-xs text-muted-foreground text-center">Subiendo… {progress}%</p>
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
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
                Cancelar
              </Button>
              <Button onClick={handleUpload} disabled={uploading || totalArchivos === 0} className="gap-1">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Cargar {totalArchivos > 0 && `(${totalArchivos})`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
