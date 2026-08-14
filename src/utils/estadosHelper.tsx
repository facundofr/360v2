import { Badge } from "@/components/ui/badge"
import * as React from "react"

// ─── Mapeo de estados → variante semántica de Badge ────────────────────────────
// ok/warn/risk comunican ESTADO real (ver index.css, "SISTEMA DE COLOR SEMÁNTICO").
// default queda reservado para la etapa que representa LA acción principal del
// pipeline (calificado para póliza); el resto de estados informativos van
// neutros (secondary/outline).

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ok" | "warn" | "risk"

interface EstadoConfig {
  variant: BadgeVariant
  text: string
}

export const estadosConfig: Record<string, EstadoConfig> = {
  Lead:                              { variant: "secondary", text: "Lead" },
  "1º Contacto":                     { variant: "warn",     text: "1º Contacto" },
  "Calificado Cotización":           { variant: "warn",     text: "Cotización" },
  "Calificado Póliza":               { variant: "default",  text: "Póliza" },
  "Calificado Pago":                 { variant: "ok",       text: "Pago" },
  Venta:                             { variant: "ok",       text: "Venta" },
  "Fuera de zona":                   { variant: "destructive", text: "Fuera zona" },
  "Fuera de edad":                   { variant: "destructive", text: "Fuera edad" },
  "No contesta":                     { variant: "warn",     text: "No contesta" },
  "No le interesa (económico)":      { variant: "destructive", text: "No interesa" },
  "No le interesa cartilla":         { variant: "destructive", text: "No interesa" },
  "No busca cobertura médica":       { variant: "destructive", text: "No cobertura" },
  "Teléfono erróneo":                { variant: "destructive", text: "Tel. erróneo" },
  "Ya es socio":                     { variant: "outline",  text: "Ya es socio" },
  "Busca otra Cobertura":            { variant: "outline",  text: "Otra cobertura" },
  Preexistencia:                     { variant: "destructive", text: "Preexistencia" },
  Reafiliación:                      { variant: "outline",  text: "Reafiliación" },
}

export function getBadgeEstado(estado: string): React.ReactElement {
  const config = estadosConfig[estado] ?? { variant: "secondary" as BadgeVariant, text: estado }
  return (
    <Badge variant={config.variant}>
      {config.text}
    </Badge>
  )
}
