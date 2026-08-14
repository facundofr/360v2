import { useState } from "react"
import { toast } from "sonner"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface BotonDescargarPolizaFirmadaProps {
  polizaId: number
  size?: "sm" | "default" | "lg" | "icon"
  showLabel?: boolean
  className?: string
}

export function BotonDescargarPolizaFirmada({
  polizaId,
  size = "sm",
  showLabel = true,
  className = "",
}: BotonDescargarPolizaFirmadaProps) {
  const [descargando, setDescargando] = useState(false)

  const handleDescargar = async () => {
    if (!polizaId) {
      toast.error("ID de póliza no especificado")
      return
    }
    setDescargando(true)
    try {
      const response = await fetch(`${API_URL}/vafirma/descargar-firmada/${polizaId}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })

      if (!response.ok) {
        let msg = `Error al descargar (${response.status})`
        try {
          const err = await response.json()
          msg = err.error ?? msg
        } catch {
          // ignore
        }
        throw new Error(msg)
      }

      const blob = await response.blob()
      if (blob.size === 0) throw new Error("El archivo descargado está vacío")

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Poliza_${polizaId}_Firmada.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Póliza firmada descargada correctamente")
    } catch (err: unknown) {
      const error = err as Error
      toast.error(error.message ?? "No se pudo descargar la póliza firmada")
    } finally {
      setDescargando(false)
    }
  }

  return (
    <Button
      size={size}
      variant="outline"
      className={`text-state-ok-text border-state-ok/30 hover:bg-state-ok-soft ${className}`}
      onClick={handleDescargar}
      disabled={descargando}
      title="Descargar póliza firmada"
    >
      <Download className="size-3.5" />
      {showLabel && <span className="ml-1.5">{descargando ? "Descargando..." : "Descargar firmada"}</span>}
    </Button>
  )
}
