import { useState, useCallback, useRef } from "react"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Poliza {
  id: number
  pdf_hash?: string
  prospecto_nombre?: string
  prospecto_apellido?: string
  numero_poliza_oficial?: string
  numero_poliza?: string
  prospecto_documento?: string
}

interface FirmaResult {
  success: boolean
  message?: string
  error?: string
  data?: unknown
  docUUID?: string
  cancelPolling?: () => void
}

export function useEnviarPolizaFirma() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<(() => void) | null>(null)

  const convertirPolizaAPDF = async (poliza: Poliza): Promise<string> => {
    if (poliza.pdf_hash) {
      const response = await fetch(`${API_URL}/polizas/pdf/${poliza.pdf_hash}`)
      if (response.ok) {
        const blob = await response.blob()
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1]
            resolve(base64)
          }
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
      }
    }
    throw new Error("PDF no disponible")
  }

  const iniciarPollingAutomatico = (
    polizaId: number,
    onFirmada: (data: unknown) => void,
    onError: (msg: string) => void
  ) => {
    let intentos = 0
    const maxIntentos = 30
    let intervalId: ReturnType<typeof setInterval> | null = null
    let cancelado = false

    const consultarEstado = async () => {
      try {
        const token = getAuthToken()
        const response = await fetch(`${API_URL}/vafirma/estado/${polizaId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) throw new Error("Error consultando estado")

        const json = await response.json()
        const estado = json.data?.estadoLocal || json.data?.status

        if (estado === "signed") {
          cancelado = true
          if (intervalId) clearInterval(intervalId)
          onFirmada(json.data)
          return
        }

        if (estado === "rejected") {
          cancelado = true
          if (intervalId) clearInterval(intervalId)
          onError("El prospecto rechazó la firma")
          return
        }

        if (estado === "expired") {
          cancelado = true
          if (intervalId) clearInterval(intervalId)
          onError("El link de firma expiró")
          return
        }

        intentos++
        if (intentos >= maxIntentos) {
          cancelado = true
          if (intervalId) clearInterval(intervalId)
          onError("Timeout: No se completó la firma en 5 minutos")
        }
      } catch {
        intentos++
        if (intentos >= maxIntentos) {
          cancelado = true
          if (intervalId) clearInterval(intervalId)
          onError("Error al consultar estado de firma")
        }
      }
    }

    consultarEstado()
    if (!cancelado) {
      intervalId = setInterval(consultarEstado, 10000)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
      cancelado = true
    }
  }

  const enviarAFirma = useCallback(
    async (
      poliza: Poliza,
      emailConfirmado: string,
      _telefonoConfirmado?: string,
      onFirmada?: (data: unknown) => void,
      onErrorFirma?: (msg: string) => void
    ): Promise<FirmaResult> => {
      setLoading(true)
      setError(null)
      try {
        if (!poliza) throw new Error("Póliza no especificada")
        if (!emailConfirmado || !emailConfirmado.trim()) throw new Error("Email del prospecto es requerido")

        const token = getAuthToken()
        const pdfBase64 = await convertirPolizaAPDF(poliza)

        const nombreProspecto = `${poliza.prospecto_nombre || "Prospecto"} ${poliza.prospecto_apellido || ""}`.trim()
        const numeroPoliza = poliza.numero_poliza_oficial || poliza.numero_poliza || `POL-${poliza.id}`
        const nombreArchivo = `Poliza_${numeroPoliza}.pdf`

        const response = await fetch(`${API_URL}/vafirma/enviar-poliza`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pdfBase64,
            fileName: nombreArchivo,
            signerName: nombreProspecto,
            signerEmail: emailConfirmado,
            emailSubject: `Póliza #${numeroPoliza} para firmar`,
            emailMessage: `Por favor, firma tu póliza ${numeroPoliza}. Se requiere validación de tu rostro.`,
            dni: poliza.prospecto_documento || undefined,
            polizaId: poliza.id,
            requireBiometric: true,
            signatureType: "Simple",
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Error al enviar póliza a firma")
        }

        const resultado = await response.json()

        if (onFirmada && onErrorFirma) {
          pollingRef.current = iniciarPollingAutomatico(poliza.id, onFirmada, onErrorFirma)
        }

        return {
          success: true,
          data: resultado.data,
          docUUID: resultado.data?.docUUID,
          message: "Póliza enviada para firma. Monitorando estado automáticamente...",
          cancelPolling: () => {
            if (pollingRef.current) {
              pollingRef.current()
              pollingRef.current = null
            }
          },
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error desconocido"
        setError(msg)
        return { success: false, error: msg }
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { enviarAFirma, loading, error, setError }
}
