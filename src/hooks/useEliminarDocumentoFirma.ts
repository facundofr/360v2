import { useState } from "react"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface FirmaResult {
  success: boolean
  message?: string
  error?: string
  data?: unknown
}

export function useEliminarDocumentoFirma() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eliminarSolicitud = async (polizaId: number): Promise<FirmaResult> => {
    setLoading(true)
    setError(null)
    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/vafirma/solicitud/${polizaId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Error al eliminar solicitud")

      return {
        success: true,
        message: "Solicitud de firma eliminada. Puedes enviar nuevamente a firmar.",
        data,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido"
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }

  const eliminarDocumentoFirmado = async (
    polizaId: number,
    docUUID: string | null = null
  ): Promise<FirmaResult> => {
    setLoading(true)
    setError(null)
    try {
      const token = getAuthToken()
      const url = docUUID
        ? `${API_URL}/vafirma/documento-firmado/${polizaId}?docUUID=${docUUID}`
        : `${API_URL}/vafirma/documento-firmado/${polizaId}`

      const response = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Error al eliminar documento")

      return { success: true, message: "Documento firmado eliminado.", data }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido"
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }

  return { eliminarSolicitud, eliminarDocumentoFirmado, loading, error }
}
