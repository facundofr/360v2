import { Badge } from "@/components/ui/badge"
import * as React from "react"

// ─── Mapeo de estados → variante de Badge shadcn ──────────────────────────────

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

interface EstadoConfig {
  variant: BadgeVariant
  text: string
  className?: string
}

export const estadosConfig: Record<string, EstadoConfig> = {
  Lead:                              { variant: "secondary", text: "Lead" },
  "1º Contacto":                     { variant: "outline",   text: "1º Contacto", className: "border-blue-400 text-blue-600" },
  "Calificado Cotización":           { variant: "outline",   text: "Cotización",  className: "border-yellow-500 text-yellow-600" },
  "Calificado Póliza":               { variant: "default",   text: "Póliza" },
  "Calificado Pago":                 { variant: "outline",   text: "Pago",        className: "border-green-500 text-green-600" },
  Venta:                             { variant: "outline",   text: "Venta",       className: "border-green-600 text-green-700 bg-green-50" },
  "Fuera de zona":                   { variant: "destructive", text: "Fuera zona" },
  "Fuera de edad":                   { variant: "destructive", text: "Fuera edad" },
  "No contesta":                     { variant: "outline",   text: "No contesta", className: "border-yellow-400 text-yellow-600" },
  "No le interesa (económico)":      { variant: "destructive", text: "No interesa" },
  "No le interesa cartilla":         { variant: "destructive", text: "No interesa" },
  "No busca cobertura médica":       { variant: "destructive", text: "No cobertura" },
  "Teléfono erróneo":                { variant: "destructive", text: "Tel. erróneo" },
  "Ya es socio":                     { variant: "outline",   text: "Ya es socio", className: "border-sky-400 text-sky-600" },
  "Busca otra Cobertura":            { variant: "outline",   text: "Otra cobertura", className: "border-orange-400 text-orange-600" },
  Preexistencia:                     { variant: "destructive", text: "Preexistencia" },
  Reafiliación:                      { variant: "outline",   text: "Reafiliación", className: "border-indigo-400 text-indigo-600" },
}

export function getBadgeEstado(estado: string): React.ReactElement {
  const config = estadosConfig[estado] ?? { variant: "secondary" as BadgeVariant, text: estado }
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.text}
    </Badge>
  )
}
