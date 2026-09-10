
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
      {/* Encabezado reglado. Antes era una tarjeta con degradado violeta→púrpura,
          baldosa de vidrio e ícono grande: el look por defecto que la calibración
          del sistema existe para atrapar. Un encabezado de sección se dibuja con
          una regla, no con un banner de color. */}
      <header className="flex items-start gap-3 border-b border-rule-firm pb-4">
        <Upload className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2 className="text-[14px] leading-snug font-bold tracking-[-0.01em]">Gestión de documentos</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Carga múltiple de documentos para pólizas
          </p>
        </div>
      </header>

      {/* CTA */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <FileText className="size-8 text-muted-foreground/50" aria-hidden="true" />
          <div>
            <p className="text-[13px] font-semibold">Seleccioná una póliza para cargar documentos</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Usá la vista de pólizas para elegir una póliza específica y cargar sus documentos.
            </p>
          </div>
          <Button className="mt-1 gap-2" onClick={onIrAPolizas}>
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
            <Info className="size-4 text-muted-foreground" />
            Tipos de documentos soportados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-semibold mb-2">Documentos de Cliente:</p>
              <ul className="space-y-1.5">
                {tiposDocumentos.cliente.map(t => (
                  <li key={t} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="size-3.5 text-muted-foreground shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Documentos Internos:</p>
              <ul className="space-y-1.5">
                {tiposDocumentos.internos.map(t => (
                  <li key={t} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="size-3.5 text-muted-foreground shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex items-start gap-2 rounded-lg border bg-muted px-4 py-3">
            <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <strong>Límites:</strong> Máximo 6 archivos por carga, 10MB por archivo. Formatos soportados: JPG, PNG, PDF, DOC, DOCX.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
