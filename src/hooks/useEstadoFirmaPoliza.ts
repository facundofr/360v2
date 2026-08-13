import { useState, useCallback, useRef } from "react"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

type EstadoFirma = "pending" | "signed" | "rejected" | "expired" | null

interface EstadoFirmaData {
  estadoLocal: EstadoFirma
  estadoVaFirma: string
  docUUID?: string
  emailFirmante?: string
  requiereBiometria?: boolean
}

export function useEstadoFirmaPoliza(polizaId: number | null) {
  const [estadoFirma, setEstadoFirma] = useState<EstadoFirmaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const consultandoRef = useRef(false)

  const consultarEstado = useCallback(async () => {
    if (!polizaId) {
      setError("ID de póliza no especificado")
      return null
    }
    if (consultandoRef.current) return null

    consultandoRef.current = true
    setLoading(true)
    setError(null)

    try {
      const token = getAuthToken()
      const response = await fetch(`${API_URL}/vafirma/estado/${polizaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.status === 404) {
        setEstadoFirma(null)
        return null
      }

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Error al consultar estado")
      }

      const resultado = await response.json()
      if (resultado.success) {
        const estadoData: EstadoFirmaData = {
          estadoLocal: resultado.data.estadoLocal,
          estadoVaFirma: resultado.data.estadoVaFirma,
          docUUID: resultado.data.docUUID,
          emailFirmante: resultado.data.emailFirmante,
          requiereBiometria: resultado.data.requiereBiometria,
        }
        setEstadoFirma(estadoData)
        return estadoData
      }
      return null
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido"
      setError(msg)
      return null
    } finally {
      setLoading(false)
      consultandoRef.current = false
    }
  }, [polizaId])

  const estaFirmada = useCallback(() => estadoFirma?.estadoLocal === "signed", [estadoFirma])
  const estaPendiente = useCallback(() => estadoFirma?.estadoLocal === "pending", [estadoFirma])
  const estaRechazada = useCallback(() => estadoFirma?.estadoLocal === "rejected", [estadoFirma])
  const estaExpirada = useCallback(() => estadoFirma?.estadoLocal === "expired", [estadoFirma])
  const fueEnviada = useCallback(() => estadoFirma !== null, [estadoFirma])

  return {
    estadoFirma,
    consultarEstado,
    loading,
    error,
    estaFirmada,
    estaPendiente,
    estaRechazada,
    estaExpirada,
    fueEnviada,
  }
}
