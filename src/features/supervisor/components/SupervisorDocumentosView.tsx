
import { FileText, Upload, Info, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

interface SupervisorDocumentosViewProps {
  onIrAPolizas?: () => void
}

const tiposDocumentos = {
  cliente: [
    "Póliza firmada por cliente",
    "Auditoría médica",
    "Documentos de identidad",
    "Comprobantes de ingresos",
  ],
  internos: [
    "Formularios internos",
    "Reportes médicos",
    "Comunicaciones internas",
    "Otros documentos",
  ],
}

export function SupervisorDocumentosView({ onIrAPolizas }: SupervisorDocumentosViewProps) {
  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Header card */}
      <Card className="overflow-hidden border-0 bg-gradient-to-r from-violet-600 to-purple-700 text-white shadow-md">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="rounded-xl bg-white/20 p-3 shrink-0">
            <Upload className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold leading-tight">Gestión de Documentos</h2>
            <p className="text-sm text-white/80 mt-0.5">Carga múltiple de documentos para pólizas</p>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="rounded-full bg-muted p-5">
            <FileText className="size-10 text-muted-foreground/60" />
          </div>
          <div>
            <p className="font-medium text-sm">Selecciona una póliza para cargar documentos</p>
            <p className="text-xs text-muted-foreground mt-1">
              Utilizá la vista de pólizas para seleccionar una póliza específica y cargar documentos.
            </p>
          </div>
          <Button className="gap-2 mt-1" onClick={onIrAPolizas}>
            <FileText className="size-4" />
            Ir a Pólizas
            <ChevronRight className="size-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Tipos soportados */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="size-4 text-blue-500" />
            Tipos de documentos soportados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-semibold text-violet-600 dark:text-violet-400 mb-2">Documentos de Cliente:</p>
              <ul className="space-y-1.5">
                {tiposDocumentos.cliente.map(t => (
                  <li key={t} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="size-3.5 text-violet-500 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">Documentos Internos:</p>
              <ul className="space-y-1.5">
                {tiposDocumentos.internos.map(t => (
                  <li key={t} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="size-3.5 text-green-500 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-4 py-3">
            <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 dark:text-blue-300">
              <strong>Límites:</strong> Máximo 6 archivos por carga, 10MB por archivo. Formatos soportados: JPG, PNG, PDF, DOC, DOCX.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
