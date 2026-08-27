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

/**
 * Etiquetas legibles por tipo de documento. Réplica de `formatTipoDocumento`
 * en `ProspectosDashboard.jsx:1579`. Cualquier tipo no listado se muestra crudo.
 */
const ETIQUETAS_TIPO_DOCUMENTO: Record<string, string> = {
  codem: "CODEM",
  formulario_f152: "Formulario F152",
  formulario_f184: "Formulario F184",
  constancia_inscripcion: "Constancia de Inscripción",
  comprobante_pago_cuota: "Comprobante de Pago de Cuota",
  estudios_medicos: "Estudios Médicos",
  dni_frente: "DNI Frente",
  dni_dorso: "DNI Dorso",
  constancia_ingresos: "Constancia de Ingresos",
  recibo_sueldo: "Recibo de Sueldo",
  autorizacion_debito: "Autorización de Débito",
  declaracion_jurada: "Declaración Jurada",
  poliza_firmada: "Póliza Firmada",
  auditoria_medica: "Auditoría Médica",
  documento_identidad_adicional: "Documento de Identidad Adicional",
  comprobante_ingresos: "Comprobante de Ingresos",
  otros: "Otros",
}

export function formatTipoDocumento(tipo?: string): string {
  if (!tipo) return "Documento"
  return ETIQUETAS_TIPO_DOCUMENTO[tipo] ?? tipo
}

export function formatFileSize(bytes?: number | string | null): string {
  const n = typeof bytes === "string" ? Number(bytes) : bytes
  if (!n || Number.isNaN(n)) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(n) / Math.log(k))
  return `${parseFloat((n / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/** Documento de póliza tal como lo devuelve el backend. */
export interface DocumentoPoliza {
  id: number
  tipo_documento: string
  nombre_original: string
  /** El backend usa la clave con eñe. */
  "tamaño_bytes"?: number
  tamano_bytes?: number
  tipo_mime?: string
  integrante_index?: number | null
  observaciones?: string | null
  created_at?: string
}

/**
 * Aplana la respuesta de `GET .../polizas/:id/documentos`, que llega agrupada
 * por tipo (`{ documentos: { dni_frente: [...], ... } }`), a un array plano.
 * Réplica de `fetchDocumentosPoliza` en `ProspectosDashboard.jsx:547`.
 */
export function aplanarDocumentos(data: unknown): DocumentoPoliza[] {
  const payload = data as { documentos?: Record<string, DocumentoPoliza[]> | DocumentoPoliza[] }
  const docs = payload?.documentos
  if (!docs) return []
  if (Array.isArray(docs)) return docs
  return Object.entries(docs).flatMap(([tipo, lista]) =>
    (lista ?? []).map(doc => ({ ...doc, tipo_documento: doc.tipo_documento ?? tipo }))
  )
}

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
