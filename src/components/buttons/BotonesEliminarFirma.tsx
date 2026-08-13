import { useState } from "react"
import { toast } from "sonner"
import { Trash2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useEliminarDocumentoFirma } from "@/hooks/useEliminarDocumentoFirma"

interface Poliza {
  id: number
  estado_firma?: "pending" | "signed" | "rejected" | "expired" | null
  referencia_vafirma?: string
}

interface BotonesEliminarFirmaProps {
  poliza: Poliza
  onActualizar?: () => void
}

export function BotonesEliminarFirma({ poliza, onActualizar }: BotonesEliminarFirmaProps) {
  const { eliminarSolicitud, eliminarDocumentoFirmado, loading } = useEliminarDocumentoFirma()
  const [confirmAction, setConfirmAction] = useState<"solicitud" | "documento" | null>(null)

  if (!poliza?.estado_firma) return null

  const esPendiente = poliza.estado_firma === "pending"
  const esFirmada = poliza.estado_firma === "signed"

  if (!esPendiente && !esFirmada) return null

  const handleConfirm = async () => {
    if (!confirmAction) return
    try {
      const resultado =
        confirmAction === "solicitud"
          ? await eliminarSolicitud(poliza.id)
          : await eliminarDocumentoFirmado(poliza.id, poliza.referencia_vafirma ?? "")

      if (resultado?.success) {
        toast.success(confirmAction === "solicitud" ? "Solicitud eliminada" : "Documento eliminado")
        onActualizar?.()
      } else {
        toast.error(resultado?.error ?? "Error al eliminar")
      }
    } catch {
      toast.error("Error inesperado")
    } finally {
      setConfirmAction(null)
    }
  }

  return (
    <>
      <div className="flex gap-1.5 flex-wrap">
        {esPendiente && (
          <Button
            size="sm"
            variant="outline"
            className="text-yellow-600 hover:text-yellow-700 border-yellow-200"
            onClick={() => setConfirmAction("solicitud")}
            disabled={loading}
          >
            <RefreshCw className="size-3.5 mr-1" />
            Reenviar
          </Button>
        )}
        {esFirmada && (
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-700 border-red-200"
            onClick={() => setConfirmAction("documento")}
            disabled={loading}
          >
            <Trash2 className="size-3.5 mr-1" />
            Eliminar Doc.
          </Button>
        )}
      </div>

      <Dialog open={!!confirmAction} onOpenChange={(open: boolean) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "solicitud" ? "¿Eliminar solicitud de firma?" : "¿Eliminar documento firmado?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "solicitud"
                ? "Se eliminará la solicitud y podrás enviar nuevamente a firmar."
                : "Se eliminará el documento de VAFirma y de la base de datos. Podrás generar una nueva versión."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancelar</Button>
            <Button
              className={confirmAction === "documento" ? "bg-red-600 hover:bg-red-700" : "bg-yellow-600 hover:bg-yellow-700"}
              onClick={handleConfirm}
            >
              {loading ? "Eliminando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
