import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * EL PADRÓN — el registro.
 *
 * Una fila por persona, el documento como eje. Encapsula la gramática que
 * antes se repetía a mano en ocho vistas: la retícula única que comparten
 * encabezado y filas, el `min-width: 0` sin el cual la fila desborda en vez
 * de elidir, y la celda de acciones que aparece en la fila enfocada.
 *
 * Las columnas viven en CSS (`.reg--<variante>` en index.css) porque son una
 * decisión de contenido por registro, con sus propios puntos de quiebre: qué
 * columna cae primero depende de qué dato es menos decisivo en ESA pantalla.
 * Meterlas acá como prop las volvería inline y perderían el responsive.
 */

type Variante =
  | "prospectos"
  | "pol"
  | "doc"
  | "user"
  | "vend"
  | "sup-pol"
  | "bo-pros"
  | "bo-pol"
  | "demo"

interface RegistroProps extends React.ComponentProps<"div"> {
  /** Juego de columnas. Cada uno define sus propios puntos de quiebre en CSS. */
  variante: Variante
}

export function Registro({ variante, className, children, ...props }: RegistroProps) {
  return (
    <div
      data-slot="registro"
      className={cn("reg", `reg--${variante}`, "border-t-2 border-rule-heavy", className)}
      {...props}
    >
      {children}
    </div>
  )
}

/** Encabezado de columnas. Consume la misma retícula que las filas. */
export function RegistroHead({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="registro-head"
      role="presentation"
      className={cn("reg-row reg-head", className)}
      {...props}
    >
      {children}
    </div>
  )
}

interface RegistroRowProps extends React.ComponentProps<"div"> {
  /** Atenúa la fila sin sacarla del registro (cuenta inactiva, dado de baja). */
  atenuada?: boolean
}

export function RegistroRow({ atenuada, className, children, ...props }: RegistroRowProps) {
  return (
    <div
      data-slot="registro-row"
      className={cn("reg-row reg-entry", atenuada && "opacity-60", className)}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Celda de acciones. Aparece en la fila enfocada, no flotando aparte.
 * `envuelve` para los registros con muchas acciones (pólizas lleva nueve).
 * En pantallas táctiles las acciones se muestran siempre: no hay hover.
 */
export function RegistroAcciones({
  envuelve,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { envuelve?: boolean }) {
  return (
    <div
      data-slot="registro-acciones"
      className={cn("reg-actions", envuelve && "flex-wrap gap-y-0.5", className)}
      {...props}
    >
      {children}
    </div>
  )
}
