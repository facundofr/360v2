import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import { Upload, FileText, Eye, Download, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { API_URL } from "@/lib/config"
import { abrirDocumentoProtegido, descargarDocumentoProtegido } from "@/lib/documentos"
import { getAuthToken } from "@/lib/auth"

const TIPOS_DOCUMENTOS = [
  { key: "codem", label: "CODEM", maxFiles: 1, description: "Certificado de Discapacidad/Enfermedad Médica" },
  { key: "formulario_f152", label: "Formulario F152", maxFiles: 1, description: "Formulario de solicitud de afiliación" },
  { key: "formulario_f184", label: "Formulario F184", maxFiles: 1, description: "Formulario de opción de cambio" },
  { key: "constancia_inscripcion", label: "Constancia de Inscripción", maxFiles: 1, description: "Constancia de inscripción en AFIP" },
  { key: "comprobante_pago_cuota", label: "Comprobantes de Pago", maxFiles: 12, description: "Comprobantes de pago (máx. 12)" },
  { key: "estudios_medicos", label: "Estudios Médicos", maxFiles: 20, description: "Estudios, análisis e informes médicos (máx. 20)" },
] as const


interface DocExistente {
  id: number
  nombre_archivo?: string
  created_at?: string
}

interface CargaDocumentosModalProps {
  polizaId: number
  userRole?: "supervisor" | "vendedor"
  open: boolean
  onOpenChange: (open: boolean) => void
  onDocumentosActualizados?: () => void
}

const getHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` })

export default function CargaDocumentosModal({ polizaId, userRole = "supervisor", open, onOpenChange, onDocumentosActualizados }: CargaDocumentosModalProps) {
  const [documentosExistentes, setDocumentosExistentes] = React.useState<Record<string, DocExistente[]>>({})
  const [archivosPorTipo, setArchivosPorTipo] = React.useState<Record<string, File[]>>({})
  const [loading, setLoading] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState(0)
  const [uploading, setUploading] = React.useState(false)

  const resetState = () => {
    setArchivosPorTipo({})
    setUploadProgress(0)
  }

  const fetchDocumentos = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API_URL}/${userRole}/polizas/${polizaId}/documentos`, { headers: getHeaders() })
      const docs: DocExistente[] = data?.data ?? data ?? []
      const grouped: Record<string, DocExistente[]> = {}
      for (const doc of docs) {
        const tipo = (doc as { tipo_documento?: string }).tipo_documento ?? "otro"
        if (!grouped[tipo]) grouped[tipo] = []
        grouped[tipo].push(doc)
      }
      setDocumentosExistentes(grouped)
    } catch {
      toast.error("Error al cargar documentos existentes")
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (open) fetchDocumentos()
    else resetState()
  }, [open, polizaId])

  const handleFileChange = (tipo: string, files: FileList | null) => {
    if (!files) return
    const tipoConfig = TIPOS_DOCUMENTOS.find(t => t.key === tipo)
    const max = tipoConfig?.maxFiles ?? 1
    setArchivosPorTipo(prev => ({
      ...prev,
      [tipo]: Array.from(files).slice(0, max),
    }))
  }

  const handleUpload = async () => {
    const tipos = Object.entries(archivosPorTipo).filter(([, files]) => files.length > 0)
    if (tipos.length === 0) { toast.error("Selecciona al menos un archivo"); return }

    setUploading(true)
    setUploadProgress(0)
    let completados = 0

    for (const [tipo, files] of tipos) {
      for (const file of files) {
        const fd = new FormData()
        fd.append("archivo", file)
        fd.append("tipo_documento", tipo)
        try {
          await axios.post(`${API_URL}/${userRole}/polizas/${polizaId}/documentos`, fd, {
            headers: { ...getHeaders(), "Content-Type": "multipart/form-data" },
          })
          completados++
          setUploadProgress(Math.round((completados / tipos.reduce((acc, [, f]) => acc + f.length, 0)) * 100))
        } catch {
          toast.error(`Error al subir ${file.name}`)
        }
      }
    }

    toast.success("Documentos cargados correctamente")
    setArchivosPorTipo({})
    setUploading(false)
    setUploadProgress(0)
    onDocumentosActualizados?.()
    fetchDocumentos()
  }

  // Estos endpoints exigen Bearer; `window.open` no puede mandarlo y devuelve 401.
  const handlePreview = (docId: number) =>
    abrirDocumentoProtegido(`${API_URL}/${userRole}/polizas/documentos/${docId}/preview`)

  const handleDownload = (docId: number, nombre?: string) =>
    descargarDocumentoProtegido(
      `${API_URL}/${userRole}/polizas/documentos/${docId}/download`,
      nombre ?? `documento-${docId}`
    )

  const totalSeleccionados = Object.values(archivosPorTipo).reduce((a, f) => a + f.length, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4" />
            Carga de Documentos
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {TIPOS_DOCUMENTOS.map(tipo => {
              const existentes = documentosExistentes[tipo.key] ?? []
              const seleccionados = archivosPorTipo[tipo.key] ?? []

              return (
                <div key={tipo.key} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{tipo.label}</p>
                      <p className="text-xs text-muted-foreground">{tipo.description}</p>
                    </div>
                    {existentes.length > 0 ? (
                      <Badge variant="ok">
                        <CheckCircle className="size-3 mr-1" />
                        {existentes.length} cargado{existentes.length > 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <Badge variant="warn">
                        <AlertCircle className="size-3 mr-1" />
                        Sin documentos
                      </Badge>
                    )}
                  </div>

                  {/* Documentos existentes */}
                  {existentes.length > 0 && (
                    <div className="space-y-1">
                      {existentes.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between bg-paper-sunk rounded p-2 text-xs">
                          <span className="flex items-center gap-1.5 truncate">
                            <FileText className="size-3 shrink-0" />
                            {doc.nombre_archivo ?? `Documento #${doc.id}`}
                          </span>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => handlePreview(doc.id)} className="p-1 hover:bg-accent rounded" title="Ver">
                              <Eye className="size-3" />
                            </button>
                            <button onClick={() => handleDownload(doc.id, doc.nombre_archivo)} className="p-1 hover:bg-accent rounded" title="Descargar">
                              <Download className="size-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Input de archivo */}
                  <div className="flex items-center gap-2">
                    <label className="flex-1 cursor-pointer">
                      <div className="border-2 border-dashed border-border rounded p-2 text-center text-xs text-muted-foreground hover:border-primary transition-colors">
                        {seleccionados.length > 0 ? (
                          <span className="text-primary font-medium">{seleccionados.length} archivo{seleccionados.length > 1 ? "s" : ""} seleccionado{seleccionados.length > 1 ? "s" : ""}</span>
                        ) : (
                          <span>Click para seleccionar (máx. {tipo.maxFiles})</span>
                        )}
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        multiple={tipo.maxFiles > 1}
                        accept="application/pdf,image/*"
                        onChange={e => handleFileChange(tipo.key, e.target.files)}
                      />
                    </label>
                    {seleccionados.length > 0 && (
                      <button
                        onClick={() => setArchivosPorTipo(prev => { const n = { ...prev }; delete n[tipo.key]; return n })}
                        className="p-1.5 hover:bg-destructive/10 rounded text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {uploading && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Subiendo documentos...</p>
            <Progress value={uploadProgress} />
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>Cancelar</Button>
          <Button onClick={handleUpload} disabled={totalSeleccionados === 0 || uploading || loading}>
            {uploading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Upload className="size-4 mr-2" />}
            Subir {totalSeleccionados > 0 ? `(${totalSeleccionados})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
