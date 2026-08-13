import axios from "axios"
import { toast } from "sonner"
import { getAuthHeaders } from "@/lib/auth"

// ─────────────────────────────────────────────────────────────────────────────
// Apertura y descarga de documentos protegidos.
//
// ⚠️ NO usar `window.open(url)` con endpoints autenticados: una pestaña nueva
// no puede llevar el header `Authorization`, y el middleware `authenticateToken`
// del backend sólo lee ese header (no acepta el token por query string).
// El resultado es un 401 silencioso. Por eso se descarga como blob con axios
// —que sí manda el header— y recién después se abre el object URL.
//
// Excepción: `/polizas/:id/pdf` y `/polizas/pdf/:hash` son públicos a propósito
// (se mandan por WhatsApp). Esos sí pueden ir con `window.open` directo.
// ─────────────────────────────────────────────────────────────────────────────

/** Abre un documento protegido en una pestaña nueva. */
export async function abrirDocumentoProtegido(url: string, mimeSugerido?: string): Promise<void> {
  try {
    const { data, headers } = await axios.get(url, {
      headers: getAuthHeaders(),
      responseType: "blob",
    })
    const tipo = mimeSugerido || String(headers["content-type"] ?? "") || "application/octet-stream"
    const objectUrl = URL.createObjectURL(new Blob([data], { type: tipo }))
    const ventana = window.open(objectUrl, "_blank")
    if (!ventana) {
      toast.error("El navegador bloqueó la ventana emergente")
    }
    // Damos margen a que la pestaña cargue antes de revocar.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  } catch {
    toast.error("No se pudo abrir el documento")
  }
}

/** Descarga un documento protegido con un nombre de archivo dado. */
export async function descargarDocumentoProtegido(url: string, nombreArchivo: string): Promise<void> {
  try {
    const { data, headers } = await axios.get(url, {
      headers: getAuthHeaders(),
      responseType: "blob",
    })
    const tipo = String(headers["content-type"] ?? "") || "application/octet-stream"
    const objectUrl = URL.createObjectURL(new Blob([data], { type: tipo }))
    const a = document.createElement("a")
    a.href = objectUrl
    a.download = nombreArchivo
    a.click()
    URL.revokeObjectURL(objectUrl)
  } catch {
    toast.error("No se pudo descargar el documento")
  }
}
