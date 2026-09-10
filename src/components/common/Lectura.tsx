import * as React from "react"
import { ArrowUp, ArrowDown, Minus } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * EL PADRÓN — la lectura.
 *
 * Una regla horizontal continua de cifras, no una grilla de tarjetas con hueco
 * entre ellas. El filete se dibuja con `gap` sobre fondo de regla, así que las
 * divisiones aparecen también donde la grilla envuelve.
 *
 * Reemplaza el patrón que estaba copiado en cuatro vistas, cada una con su
 * propio `grid-cols` y su propia tipografía para el mismo dato.
 */

export function Lectura({ className, children, ...props }: React.ComponentProps<"dl">) {
  return (
    <dl data-slot="lectura" className={cn("readout", className)} {...props}>
      {children}
    </dl>
  )
}

interface LecturaItemProps extends Omit<React.ComponentProps<"div">, "children"> {
  rotulo: React.ReactNode
  valor: React.ReactNode
  /** Ícono junto al rótulo. Dibujado, nunca un emoji. */
  icono?: React.ElementType
  /** `positiva` dice si la variación es DESEABLE, no si el número sube. */
  tendencia?: { valor: number; positiva: boolean } | null
  /** Segunda línea bajo la cifra. */
  nota?: React.ReactNode
  cargando?: boolean
}

export function LecturaItem({
  rotulo, valor, icono: Icono, tendencia, nota, cargando, className, ...props
}: LecturaItemProps) {
  return (
    <div className={cn("min-w-0", className)} {...props}>
      <dt className={cn(Icono && "flex items-center gap-1.5")}>
        {Icono && <Icono className="size-3.5 shrink-0" aria-hidden="true" />}
        {rotulo}
      </dt>
      <dd className="flex min-w-0 items-baseline gap-2">
        <span className="min-w-0 truncate">{cargando ? "—" : valor}</span>
        {tendencia != null && (
          <span
            className={cn(
              "flex shrink-0 items-center gap-0.5 text-[11px] font-semibold tabular-nums",
              tendencia.valor === 0
                ? "text-muted-foreground"
                : tendencia.positiva
                  ? "text-state-ok-text"
                  : "text-state-risk-text"
            )}
          >
            {tendencia.valor > 0 ? <ArrowUp className="size-3" /> : tendencia.valor < 0 ? <ArrowDown className="size-3" /> : <Minus className="size-3" />}
            {Math.abs(tendencia.valor)}%
          </span>
        )}
      </dd>
      {nota && <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{nota}</p>}
    </div>
  )
}
