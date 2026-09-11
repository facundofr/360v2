import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { estadosConfig, type BadgeVariant, type Grade } from "@/utils/estados"

/**
 * EL PADRÓN — el sello de estado.
 *
 * Los datos y las derivaciones viven en `@/utils/estados`; acá sólo queda el
 * renderizado, para que el módulo exporte un componente y nada más.
 */
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
