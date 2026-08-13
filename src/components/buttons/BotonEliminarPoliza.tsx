import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import { Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Poliza {
  id: number
  numero_poliza_oficial?: string
  numero_poliza?: string
  estado?: string
  fecha_envio_firma?: string | null
  /** Acepta `null` porque el backend devuelve null cuando no hay envío a firma. */
  estado_firma?: string | null
}

interface Props {
  poliza: Poliza
  onEliminada?: () => void
  size?: "default" | "sm" | "lg" | "icon"
  showLabel?: boolean
  disabled?: boolean
  endpointBase?: string | null
}

export function BotonEliminarPoliza({
  poliza,
  onEliminada,
  size = "sm",
  showLabel = true,
  disabled = false,
  endpointBase = null,
}: Props) {
  const endpoint = endpointBase
    ? `${endpointBase}/${poliza?.id}`
    : `${API_URL}/backoffice/polizas/${poliza?.id}`
  const [loading, setLoading] = React.useState(false)
  const [openConfirm, setOpenConfirm] = React.useState(false)
  const [motivo, setMotivo] = React.useState("")

  const esVentaCerrada = poliza?.estado === "venta_cerrada"
  const fueEnviadaFirma =
    poliza?.fecha_envio_firma ||
    poliza?.estado_firma === "pending" ||
    poliza?.estado_firma === "signed"
  const puedeEliminar = !esVentaCerrada && !fueEnviadaFirma && !disabled

  const obtenerTooltip = () => {
    if (esVentaCerrada) return "No se puede eliminar: la venta ya fue cerrada"
    if (fueEnviadaFirma) return "No se puede eliminar: la póliza fue enviada a firma electrónica"
    return "Eliminar póliza"
  }

  const handleEliminar = async () => {
    if (!puedeEliminar) return
    setOpenConfirm(true)
    setMotivo("")
  }

  const confirmarEliminar = async () => {
    const numero = poliza?.numero_poliza_oficial || poliza?.numero_poliza || `#${poliza?.id}`
    if (!motivo.trim()) {
      toast.warning("El motivo es obligatorio")
      return
    }

    setLoading(true)
    try {
      const token = getAuthToken()
      await axios.delete(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        data: { motivo_eliminacion: motivo.trim() },
      })
      toast.success(`Póliza ${numero} eliminada correctamente.`)
      setOpenConfirm(false)
      if (onEliminada) onEliminada()
    } catch (err) {
      if (axios.isAxiosError(err)) {
        toast.error(err.response?.data?.error || err.response?.data?.message || "Error al eliminar la póliza")
      } else {
        toast.error("Error al eliminar la póliza")
      }
    } finally {
      setLoading(false)
    }
  }

  const numero = poliza?.numero_poliza_oficial || poliza?.numero_poliza || `#${poliza?.id}`

  return (
    <>
      <Button
        variant={puedeEliminar ? "outline" : "outline"}
        size={size}
        title={obtenerTooltip()}
        disabled={!puedeEliminar || loading}
        onClick={handleEliminar}
        className={puedeEliminar ? "text-destructive border-destructive/50 hover:bg-destructive/10" : "opacity-40 cursor-not-allowed"}
      >
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
        {showLabel && (loading ? " Eliminando..." : " Eliminar")}
      </Button>

      {openConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpenConfirm(false)}>
          <div className="bg-background rounded-lg shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">¿Eliminar póliza?</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Vas a eliminar la póliza <strong>{numero}</strong>. Esta acción no se puede deshacer automáticamente.
            </p>
            <div className="space-y-1 mb-4">
              <label className="text-xs font-medium">Motivo de la eliminación (obligatorio)</label>
              <textarea
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                rows={3}
                placeholder="Ingresá el motivo..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
                onClick={() => setOpenConfirm(false)}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9 px-4 py-2"
                onClick={confirmarEliminar}
                disabled={loading || !motivo.trim()}
              >
                {loading ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
                Confirmar eliminación
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
