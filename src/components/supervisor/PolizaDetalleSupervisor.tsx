import * as React from "react"
import axios from "axios"
import { API_URL } from "@/lib/config"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import CargaMultipleDocumentos from "@/components/supervisor/CargaMultipleDocumentos"
import {
  FileText, Upload, Eye, Download,
  CheckCircle, Loader2,
} from "lucide-react"

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Poliza {
  id:            number
  numero_poliza?: string
  estado:        string
  nombre_afiliado?: string
  dni_afiliado?:    string
  plan_nombre?:     string
  vigencia_desde?:  string
  vigencia_hasta?:  string
  monto_cuota?:     number
}

interface Documento {
  id:        number
  tipo:      string
  nombre:    string
  tamanio?:  number
  createdAt?: string
}

interface Props {
  polizaId: number | string
}

function formatBytes(b: number): string {
  if (!b) return ""
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 ** 2).toFixed(1)} MB`
}

const TIPO_ICONS: Record<string, string> = {
  poliza_firmada:                  "📄",
  auditoria_medica:                "🏥",
  documento_identidad_adicional:   "🆔",
  comprobante_ingresos:            "💰",
  autorizacion_debito:             "💳",
  documento_adicional:             "📎",
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function PolizaDetalleSupervisor({ polizaId }: Props) {
  const [poliza,    setPoliza]    = React.useState<Poliza | null>(null)
  const [documentos, setDocumentos] = React.useState<Record<string, Documento[]>>({})
  const [loading,   setLoading]   = React.useState(true)
  const [error,     setError]     = React.useState<string | null>(null)
  const [openModal, setOpenModal] = React.useState(false)

  const cargarDatos = React.useCallback(async () => {
    if (!polizaId) return
    setLoading(true); setError(null)
    try {
      const [polizaRes, docsRes] = await Promise.allSettled([
        axios.get(`${API_URL}/supervisor/polizas/${polizaId}`),
        axios.get(`${API_URL}/supervisor/polizas/${polizaId}/documentos`),
      ])
      if (polizaRes.status === "fulfilled") setPoliza(polizaRes.value.data.data)
      else setError("Error al cargar la póliza")
      if (docsRes.status   === "fulfilled") setDocumentos(docsRes.value.data.documentos ?? {})
    } catch {
      setError("Error al cargar los datos")
    } finally {
      setLoading(false)
    }
  }, [polizaId])

  React.useEffect(() => { cargarDatos() }, [cargarDatos])

  const totalDocs = Object.values(documentos).flat().length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  }

  if (!poliza) return null

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">
            Póliza {poliza.numero_poliza ?? `#${poliza.id}`}
          </h2>
          <Badge variant={poliza.estado === "vigente" ? "default" : "secondary"} className="capitalize">
            {poliza.estado}
          </Badge>
        </div>
        <Button size="sm" className="gap-1" onClick={() => setOpenModal(true)}>
          <Upload className="h-4 w-4" />
          Cargar Documentos
        </Button>
      </div>

      {/* Datos de la póliza */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Datos del Afiliado</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-6 text-sm">
          {poliza.nombre_afiliado && (
            <div><p className="text-xs text-muted-foreground">Nombre</p><p className="font-medium">{poliza.nombre_afiliado}</p></div>
          )}
          {poliza.dni_afiliado && (
            <div><p className="text-xs text-muted-foreground">DNI</p><p className="font-medium">{poliza.dni_afiliado}</p></div>
          )}
          {poliza.plan_nombre && (
            <div><p className="text-xs text-muted-foreground">Plan</p><p className="font-medium">{poliza.plan_nombre}</p></div>
          )}
          {poliza.vigencia_desde && (
            <div><p className="text-xs text-muted-foreground">Vigencia desde</p><p className="font-medium">{new Date(poliza.vigencia_desde).toLocaleDateString("es-ES")}</p></div>
          )}
          {poliza.vigencia_hasta && (
            <div><p className="text-xs text-muted-foreground">Vigencia hasta</p><p className="font-medium">{new Date(poliza.vigencia_hasta).toLocaleDateString("es-ES")}</p></div>
          )}
          {poliza.monto_cuota !== undefined && (
            <div><p className="text-xs text-muted-foreground">Cuota mensual</p><p className="font-medium">${poliza.monto_cuota.toLocaleString("es-AR")}</p></div>
          )}
        </CardContent>
      </Card>

      {/* Documentos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Documentos adjuntos</span>
            <Badge variant="secondary">{totalDocs}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {totalDocs === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin documentos adjuntos.</p>
          ) : (
            Object.entries(documentos).map(([tipo, docs]) => (
              docs.length > 0 && (
                <div key={tipo}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    {TIPO_ICONS[tipo] ?? "📄"} {tipo.replace(/_/g, " ")}
                  </p>
                  <div className="space-y-1">
                    {docs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between bg-muted/30 rounded px-3 py-2">
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          <span className="truncate max-w-[200px]">{doc.nombre}</span>
                          {doc.tamanio && <span className="text-xs text-muted-foreground">({formatBytes(doc.tamanio)})</span>}
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
                            <a href={`${API_URL}/supervisor/polizas/documentos/${doc.id}/preview`} target="_blank" rel="noopener noreferrer">
                              <Eye className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
                            <a href={`${API_URL}/supervisor/polizas/documentos/${doc.id}/download`} target="_blank" rel="noopener noreferrer">
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Separator className="mt-2" />
                </div>
              )
            ))
          )}
        </CardContent>
      </Card>

      {/* Modal de carga */}
      <CargaMultipleDocumentos
        polizaId={polizaId}
        open={openModal}
        onOpenChange={setOpenModal}
        onDocumentosActualizados={cargarDatos}
      />
    </div>
  )
}
