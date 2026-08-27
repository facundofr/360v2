// ─────────────────────────────────────────────────────────────────────────────
// Enmascarado de datos de contacto.
//
// Producción define estas funciones por separado en 9 archivos
// (`ProspectosDashboard.jsx:1613`, `PolizasDashboard.jsx:120`,
// `ProspectoDetalle.jsx:210`, etc.). Acá viven una sola vez.
//
// Regla: el vendedor no ve el teléfono ni el correo completos en los listados;
// sólo los últimos 4 dígitos y las 2 primeras letras del correo. El número real
// se usa igual al enviar (WhatsApp, cupones): se enmascara la vista, no el dato.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enmascara un teléfono dejando visibles los últimos 4 dígitos, preservando el
 * formato de origen igual que `maskPhoneNumber` en producción.
 */
export function maskPhone(phone?: string | null): string {
  if (!phone) return ""
  const cleaned = phone.replace(/\D/g, "")
  if (cleaned.length < 4) return phone

  const masked = "*".repeat(cleaned.length - 4) + cleaned.slice(-4)

  if (phone.includes("+")) return `+${masked}`
  // Formatos con separadores —(011) 1234-5678— se normalizan a un largo fijo.
  if (phone.includes("-") || phone.includes(" ") || phone.includes("(")) {
    return `******${cleaned.slice(-4)}`
  }
  return masked
}

/** Enmascara un correo dejando visibles las 2 primeras letras y el dominio. */
export function maskEmail(email?: string | null): string {
  if (!email) return ""
  const [local, domain] = email.split("@")
  if (!domain) return email
  if (local.length <= 2) return `**@${domain}`
  return `${local.substring(0, 2)}${"*".repeat(local.length - 2)}@${domain}`
}
