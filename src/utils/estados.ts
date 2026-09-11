// Datos y derivaciones de los estados de prospecto. Sin JSX a propósito: el
// renderizado vive en estadosHelper.tsx, y separarlos deja que Fast Refresh
// funcione en los componentes que los consumen.

// ─── Estados de prospecto: datos y derivaciones ─────────────────────────────────────────────────
// EL PADRÓN. Un estado es un sello estampado en columna fija, y lleva DOS cosas:
//
//   variant → la familia semántica (ok / warn / risk / firme / neutro).
//   grade   → el grado de CARGA, 0 a 4, dibujado como medidor ordinal.
//
// El grado se lee contando segmentos, sin aprender la paleta; el color sólo
// confirma lo que el conteo ya dijo. Ver DESIGN.md § Signature components.
//
//   0 · la carga se soltó      — descartado, medidor vacío y cortado
//   1 · inerte                 — el asiento existe y nada lo mueve
//   2 · en curso               — hay trabajo encima
//   3 · comprometido           — el embudo avanzó y hay obligación
//   4 · cerrado                — pago, firma, venta
//
// Ningún estado usa `default` (violeta): en esta app el violeta significa
// ACCIÓN, y un estado es dato. La carga comprometida va en tinta (`firme`).

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ok"
  | "warn"
  | "risk"
  | "firme"

export type Grade = 0 | 1 | 2 | 3 | 4

export interface EstadoConfig {
  variant: BadgeVariant
  text: string
  grade: Grade
}

export const estadosConfig: Record<string, EstadoConfig> = {
  // ── Sin trabajar ──────────────────────────────────────────────────────────
  Lead:                                 { variant: "secondary",   text: "Lead",            grade: 1 },

  // ── En contacto ───────────────────────────────────────────────────────────
  "1º Contacto":                        { variant: "warn",        text: "1º Contacto",     grade: 2 },
  "WhatsApp enviado":                   { variant: "secondary",   text: "WhatsApp enviado", grade: 1 },
  "Llamada telefónica":                 { variant: "secondary",   text: "Llamada",         grade: 1 },
  "Conversación iniciada por WhatsApp": { variant: "warn",        text: "Chat WhatsApp",   grade: 2 },
  "No contesta":                        { variant: "warn",        text: "No contesta",     grade: 2 },

  // ── Calificado ────────────────────────────────────────────────────────────
  "Promoción aplicada":                 { variant: "warn",        text: "Promo aplicada",  grade: 2 },
  "Calificado Cotización":              { variant: "warn",        text: "Cotización",      grade: 2 },
  "Calificado Póliza":                  { variant: "firme",       text: "Póliza",          grade: 3 },
  "Calificado Pago":                    { variant: "ok",          text: "Pago",            grade: 4 },

  // ── Póliza en curso ───────────────────────────────────────────────────────
  "Póliza iniciada":                    { variant: "firme",       text: "Póliza iniciada", grade: 3 },
  "Póliza generada":                    { variant: "firme",       text: "Póliza generada", grade: 3 },
  "Póliza enviada a supervisor":        { variant: "firme",       text: "Env. supervisor", grade: 3 },
  "Póliza pendiente a firma":           { variant: "warn",        text: "Pend. firma",     grade: 2 },
  "Póliza firmada":                     { variant: "ok",          text: "Firmada",         grade: 4 },
  Venta:                                { variant: "ok",          text: "Venta",           grade: 4 },

  // ── Descartado ────────────────────────────────────────────────────────────
  "Fuera de zona":                      { variant: "destructive", text: "Fuera zona",      grade: 0 },
  "Fuera de edad":                      { variant: "destructive", text: "Fuera edad",      grade: 0 },
  "No le interesa (económico)":         { variant: "destructive", text: "No interesa",     grade: 0 },
  "No le interesa cartilla":            { variant: "destructive", text: "No interesa",     grade: 0 },
  "No busca cobertura médica":          { variant: "destructive", text: "No cobertura",    grade: 0 },
  "Teléfono erróneo":                   { variant: "destructive", text: "Tel. erróneo",    grade: 0 },
  Preexistencia:                        { variant: "destructive", text: "Preexistencia",   grade: 0 },

  // ── Fuera del embudo: informativos, sin carga que medir ───────────────────
  "Ya es socio":                        { variant: "outline",     text: "Ya es socio",     grade: 1 },
  "Busca otra Cobertura":               { variant: "outline",     text: "Otra cobertura",  grade: 1 },
  Reafiliación:                         { variant: "outline",     text: "Reafiliación",    grade: 1 },
}


// ─── Etapa del embudo ─────────────────────────────────────────────────────────
// EL PADRÓN. El registro se agrupa por etapa y la etapa activa se marca: la
// posición en la lista codifica la posición en el embudo.
//
// La etapa NO es un dato nuevo — se deriva del estado, que sí es dato. Cinco
// etapas cubren los 26 estados.

export const ETAPAS = [
  "Sin trabajar",
  "En contacto",
  "Calificado",
  "Póliza en curso",
  "Descartado",
] as const

export type Etapa = (typeof ETAPAS)[number]

const ETAPA_POR_ESTADO: Record<string, Etapa> = {
  Lead: "Sin trabajar",

  "1º Contacto": "En contacto",
  "WhatsApp enviado": "En contacto",
  "Llamada telefónica": "En contacto",
  "Conversación iniciada por WhatsApp": "En contacto",
  "No contesta": "En contacto",

  "Promoción aplicada": "Calificado",
  "Calificado Cotización": "Calificado",
  "Calificado Póliza": "Calificado",
  "Calificado Pago": "Calificado",

  "Póliza iniciada": "Póliza en curso",
  "Póliza generada": "Póliza en curso",
  "Póliza enviada a supervisor": "Póliza en curso",
  "Póliza pendiente a firma": "Póliza en curso",
  "Póliza firmada": "Póliza en curso",
  Venta: "Póliza en curso",

  "Fuera de zona": "Descartado",
  "Fuera de edad": "Descartado",
  "No le interesa (económico)": "Descartado",
  "No le interesa cartilla": "Descartado",
  "No busca cobertura médica": "Descartado",
  "Teléfono erróneo": "Descartado",
  Preexistencia: "Descartado",
  "Ya es socio": "Descartado",
  "Busca otra Cobertura": "Descartado",
  Reafiliación: "Descartado",
}

/** Un estado desconocido cae en "Sin trabajar": es lo único que no miente. */
export function etapaDe(estado: string): Etapa {
  return ETAPA_POR_ESTADO[estado] ?? "Sin trabajar"
}

// ─── Trabado en ───────────────────────────────────────────────────────────────
// Segunda mitad de la elevación que donó la dirección de tensegridad: cada fila
// expone CONTRA QUÉ está trabada, para poder rastrear un registro estancado
// hasta su bloqueo sin abrirlo.
//
// También se deriva del estado. `libre: true` marca los que no esperan nada.

export type Traba = { texto: string; icono: "espera" | "llamada" | "chat" | "papel" | "alerta" | "libre" }

const TRABA_POR_ESTADO: Record<string, Traba> = {
  Lead: { texto: "Sin primer contacto", icono: "espera" },

  "1º Contacto": { texto: "Espera devolución de llamada", icono: "llamada" },
  "WhatsApp enviado": { texto: "Sin lectura desde el envío", icono: "chat" },
  "Llamada telefónica": { texto: "Llamada hecha, sin avance", icono: "llamada" },
  "Conversación iniciada por WhatsApp": { texto: "Respondió, falta cotizar", icono: "chat" },
  "No contesta": { texto: "Sin respuesta tras varios intentos", icono: "llamada" },

  "Promoción aplicada": { texto: "Promo aplicada, falta cotizar", icono: "papel" },
  "Calificado Cotización": { texto: "Cotización enviada, sin respuesta", icono: "papel" },
  "Calificado Póliza": { texto: "Listo para alta", icono: "libre" },
  "Calificado Pago": { texto: "Medio de pago validado", icono: "libre" },

  "Póliza iniciada": { texto: "Alta en curso", icono: "espera" },
  "Póliza generada": { texto: "Falta documentación", icono: "espera" },
  "Póliza enviada a supervisor": { texto: "En revisión de supervisor", icono: "espera" },
  "Póliza pendiente a firma": { texto: "Esperando firma del afiliado", icono: "alerta" },
  "Póliza firmada": { texto: "Nada pendiente", icono: "libre" },
  Venta: { texto: "Nada pendiente", icono: "libre" },

  "Fuera de zona": { texto: "Sin cartilla en el partido", icono: "espera" },
  "Fuera de edad": { texto: "Supera la edad de ingreso", icono: "espera" },
  "No le interesa (económico)": { texto: "Descartó por precio", icono: "espera" },
  "No le interesa cartilla": { texto: "Descartó por cartilla", icono: "espera" },
  "No busca cobertura médica": { texto: "No buscaba cobertura", icono: "espera" },
  "Teléfono erróneo": { texto: "Teléfono inválido", icono: "alerta" },
  Preexistencia: { texto: "Declaró patología excluyente", icono: "alerta" },
  "Ya es socio": { texto: "Ya está afiliado", icono: "libre" },
  "Busca otra Cobertura": { texto: "Busca otro producto", icono: "espera" },
  Reafiliación: { texto: "Reingreso pendiente", icono: "espera" },
}

export function trabadoEn(estado: string): Traba {
  return TRABA_POR_ESTADO[estado] ?? { texto: "Sin trabajar", icono: "espera" }
}


// ─── Pólizas: etapa y traba ───────────────────────────────────────────────────
// El registro de backoffice no es el embudo del vendedor. Acá la póliza ya
// existe y lo que ordena la cola es la AUDITORÍA: qué falta para darla de alta.
//
// Se deriva de tres campos que ya vienen del backend —`estado`, `estado_firma`
// y `requiere_auditoria_medica`—; no hay dato nuevo ni columna nueva en la base.

export interface PolizaAuditable {
  estado?: string
  estado_firma?: "pending" | "signed" | "rejected" | "expired" | null
  /** 0|1 — flag de IMC elevado (`polizasBackOfficeController.js:281`). */
  requiere_auditoria_medica?: number
}

export const ETAPAS_POLIZA = [
  "Con observación",
  "En revisión",
  "Esperando firma",
  "Listas para alta",
  "Dadas de alta",
  "Rechazadas",
] as const

export type EtapaPoliza = (typeof ETAPAS_POLIZA)[number]

/** Etapas terminales: ya no esperan trabajo de backoffice. */
export const ETAPAS_POLIZA_CERRADAS: readonly EtapaPoliza[] = ["Dadas de alta", "Rechazadas"]

/**
 * Primera coincidencia gana, y el orden es deliberado: lo que necesita a un
 * humano va arriba. Una póliza con auditoría médica pendiente es "Con
 * observación" aunque además esté esperando firma, porque la observación es
 * el bloqueo real.
 */
export function etapaPoliza(p: PolizaAuditable): EtapaPoliza {
  if (p.estado === "venta_rechazada") return "Rechazadas"
  if (p.estado === "venta_cerrada") return "Dadas de alta"
  if (p.requiere_auditoria_medica === 1) return "Con observación"
  if (p.estado_firma === "rejected" || p.estado_firma === "expired") return "Con observación"
  if (p.estado_firma === "pending") return "Esperando firma"
  if (p.estado_firma === "signed") return "Listas para alta"
  return "En revisión"
}

/** Contra qué está trabada la póliza. Mismo vocabulario de íconos que el prospecto. */
export function trabaPoliza(p: PolizaAuditable): Traba {
  if (p.estado === "venta_rechazada") return { texto: "Venta rechazada", icono: "alerta" }
  if (p.estado === "venta_cerrada") return { texto: "Nada pendiente", icono: "libre" }
  if (p.requiere_auditoria_medica === 1) return { texto: "Auditoría médica por IMC", icono: "alerta" }
  if (p.estado_firma === "rejected") return { texto: "El afiliado rechazó la firma", icono: "alerta" }
  if (p.estado_firma === "expired") return { texto: "La firma venció sin completarse", icono: "alerta" }
  if (p.estado_firma === "pending") return { texto: "Esperando firma del afiliado", icono: "espera" }
  if (p.estado_firma === "signed") return { texto: "Nada pendiente", icono: "libre" }
  if (p.estado === "asesor") return { texto: "En poder del vendedor", icono: "espera" }
  if (p.estado === "supervisor") return { texto: "En revisión del supervisor", icono: "espera" }
  return { texto: "Falta enviar a firma", icono: "papel" }
}

// ─── Antigüedad ───────────────────────────────────────────────────────────────
// El eje único que donó la dirección mesofótica: una sola escala de tiempo, con
// la banda caliente marcada. Una póliza de catorce días no es "vieja" en
// abstracto: es la que hay que mirar hoy.

/** A partir de acá la antigüedad se marca. Una semana sin avance ya es una traba. */
const DIAS_FRIOS = 7

export function antiguedadDe(fecha?: string): { texto: string; fria: boolean } {
  if (!fecha) return { texto: "—", fria: false }
  const t = new Date(fecha).getTime()
  if (!Number.isFinite(t)) return { texto: "—", fria: false }

  const horas = Math.floor((Date.now() - t) / 3_600_000)
  if (horas < 0) return { texto: "—", fria: false }
  if (horas < 1) return { texto: "recién", fria: false }
  if (horas < 24) return { texto: horas + " h", fria: false }

  const dias = Math.floor(horas / 24)
  return { texto: dias + " d", fria: dias >= DIAS_FRIOS }
}
