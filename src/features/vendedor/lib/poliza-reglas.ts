// ─────────────────────────────────────────────────────────────────────────────
// Reglas de negocio del alta de póliza, portadas de producción.
//
// Todas son funciones puras a propósito: son las que tienen impacto en
// facturación y en auditoría médica, así que conviene poder testearlas sin
// montar el formulario.
//
// Fuente:
//   frontend/src/components/features/vendedor/poliza-form/PasoDatosPersonales.jsx
//   frontend/src/components/features/vendedor/poliza-form/PasoResumen.jsx
// ─────────────────────────────────────────────────────────────────────────────

import { FORMAS_PAGO } from "@/features/vendedor/constants/poliza"

/** Normaliza a `YYYY-MM-DD`; devuelve "" si no matchea. */
export function normalizarFechaYMD(fecha: string | null | undefined): string {
  if (!fecha) return ""
  const match = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : ""
}

/**
 * Mes de vigencia de la cobertura a partir de la fecha de solicitud.
 *
 *   día 1–13  → vigencia el MISMO mes
 *   día 14–31 → vigencia el mes SIGUIENTE (con salto de año en diciembre)
 *
 * Devuelve `YYYY-MM` (formato del input `type="month"`), o "" si la fecha es
 * inválida. Es una regla de facturación: si no se aplica, el período de
 * cobertura arranca en el mes equivocado.
 */
export function calcularMesVigencia(fechaSolicitud: string | null | undefined): string {
  const normalizada = normalizarFechaYMD(fechaSolicitud)
  if (!normalizada) return ""

  const [anio, mes, dia] = normalizada.split("-").map(Number)
  if (!anio || !mes || !dia) return ""

  let mesVigencia = mes
  let anioVigencia = anio

  if (dia >= 14) {
    mesVigencia = mes + 1
    if (mesVigencia > 12) {
      mesVigencia = 1
      anioVigencia = anio + 1
    }
  }

  return `${anioVigencia}-${String(mesVigencia).padStart(2, "0")}`
}

/** Fecha de hoy en `YYYY-MM-DD` (default de fecha_solicitud). */
export function fechaHoyYMD(): string {
  return new Date().toISOString().split("T")[0]
}

/**
 * Forma de pago que corresponde automáticamente según el % de promoción.
 * Sólo aplica si el vendedor todavía no eligió una: nunca pisa una elección
 * manual. Devuelve `null` si no hay regla para ese porcentaje.
 */
export function formaPagoPorPromocion(porcentaje: number | string | null | undefined): string | null {
  const pct = Number(porcentaje)
  if (pct === 35) return FORMAS_PAGO[2] // "Débito automático de cuenta (CBU)"
  if (pct === 50) return FORMAS_PAGO[1] // "Débito automático de tarjeta de crédito"
  return null
}

/** IMC con un decimal, o null si falta peso o altura. Altura en centímetros. */
export function calcularIMC(
  peso: number | string | null | undefined,
  altura: number | string | null | undefined
): number | null {
  const p = Number(peso)
  const a = Number(altura)
  if (!p || !a) return null
  const metros = a / 100
  return Number((p / (metros * metros)).toFixed(1))
}

/** Edad en años cumplidos a partir de una fecha de nacimiento. */
export function calcularEdad(fechaNacimiento: string | null | undefined): number {
  if (!fechaNacimiento) return 0
  const hoy = new Date()
  const nac = new Date(fechaNacimiento)
  if (Number.isNaN(nac.getTime())) return 0
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad < 0 ? 0 : edad
}

// ─── Auditoría médica ────────────────────────────────────────────────────────

export interface DatosFisicos {
  titular_peso?: string
  titular_altura?: string
  integrantes?: { peso?: string; altura?: string }[]
}

export interface RespuestaSalud {
  respuesta: "si" | "no"
  detalle?: string
}

/** `{ [integranteIndex]: { [preguntaId]: RespuestaSalud } }` */
export type RespuestasPorIntegrante = Record<string, Record<string, RespuestaSalud>>

/**
 * Determina si la póliza requiere auditoría médica. Se dispara con CUALQUIERA:
 *
 *   1. IMC > 30 del titular o de algún integrante
 *   2. alguna respuesta "si" en la declaración jurada resumida
 *   3. alguna enfermedad/patología tildada
 *   4. alguna respuesta "si" en el cuestionario de salud de cualquier integrante
 *
 * El backend guarda el flag en `polizas.requiere_auditoria_medica` y lo expone
 * en el listado, así que un falso negativo hace que una póliza que necesitaba
 * revisión médica pase derecho.
 */
export function requiereAuditoriaMedica(args: {
  datosFisicos?: DatosFisicos
  preguntasDJ?: { respuesta: string }[]
  enfermedadesSeleccionadas?: string[]
  respuestasSalud?: RespuestasPorIntegrante
}): boolean {
  const { datosFisicos, preguntasDJ, enfermedadesSeleccionadas, respuestasSalud } = args

  const imcTitular = calcularIMC(datosFisicos?.titular_peso, datosFisicos?.titular_altura)
  const imcIntegrantes = (datosFisicos?.integrantes ?? []).map((i) => calcularIMC(i.peso, i.altura))
  const tieneIMCElevado =
    (imcTitular !== null && imcTitular > 30) ||
    imcIntegrantes.some((imc) => imc !== null && imc > 30)

  const tieneDJAfirmativa =
    (preguntasDJ ?? []).some((p) => p.respuesta === "si") ||
    (enfermedadesSeleccionadas?.length ?? 0) > 0

  const tieneSaludAfirmativa = Object.values(respuestasSalud ?? {}).some((porIntegrante) =>
    Object.values(porIntegrante ?? {}).some((r) => r?.respuesta === "si")
  )

  return tieneIMCElevado || tieneDJAfirmativa || tieneSaludAfirmativa
}

// ─── Orden de integrantes ────────────────────────────────────────────────────

/** Producción ordena: Titular → cónyuge/pareja → resto. */
export function esConyuge(vinculo: string | null | undefined): boolean {
  const v = (vinculo ?? "").toLowerCase()
  return (
    v.includes("matrimonio") ||
    v.includes("conyuge") ||
    v.includes("cónyuge") ||
    v.includes("pareja")
  )
}
