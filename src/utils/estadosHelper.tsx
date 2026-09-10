import { Badge } from "@/components/ui/badge"
import * as React from "react"

// ─── Mapeo de estados → sello ─────────────────────────────────────────────────
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

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ok"
  | "warn"
  | "risk"
  | "firme"

type Grade = 0 | 1 | 2 | 3 | 4

interface EstadoConfig {
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

export function getBadgeEstado(estado: string): React.ReactElement {
  const config = estadosConfig[estado] ?? {
    variant: "secondary" as BadgeVariant,
    text: estado,
    grade: 1 as Grade,
  }
  return (
    <Badge variant={config.variant} grade={config.grade}>
      {config.text}
    </Badge>
  )
}
