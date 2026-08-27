import * as React from "react"
import { FileText, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  DocumentosPolizaPanel,
  type ApiContextDocumentos,
  type DocumentosPolizaPanelRef,
} from "@/features/vendedor/components/DocumentosPolizaPanel"

interface Poliza {
  id: number
  numero_poliza_oficial?: string
  numero_poliza?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  poliza: Poliza | null
  apiContext?: ApiContextDocumentos
  /** Abre el modal de carga de documentos. Si no se pasa, el botón no se muestra. */
  onCargarDocumentos?: () => void
}

/**
 * Modal "Documentos de póliza" del vendedor.
 * Réplica de `ProspectosDashboard.jsx:3202-3320`.
 */
export function DocumentosPolizaModal({
  open,
  onOpenChange,
  poliza,
  apiContext = "vendedor",
  onCargarDocumentos,
}: Props) {
  const panelRef = React.useRef<DocumentosPolizaPanelRef>(null)
  const numero = poliza?.numero_poliza_oficial ?? poliza?.numero_poliza ?? poliza?.id

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-4" />
            Documentos de la póliza N° {numero}
          </DialogTitle>
        </DialogHeader>

        {open && poliza && (
          <DocumentosPolizaPanel ref={panelRef} polizaId={poliza.id} apiContext={apiContext} />
        )}

        <DialogFooter className="gap-2">
          {onCargarDocumentos && (
            <Button variant="outline" onClick={onCargarDocumentos}>
              <Plus className="size-4 mr-2" />Cargar documentos
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DocumentosPolizaModal
