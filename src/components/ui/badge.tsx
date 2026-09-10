import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * EL PADRÓN — el sello.
 *
 * Un estado no es una pastilla flotante: es un sello estampado en columna fija.
 * De ahí el rectángulo de 2px en vez de `rounded-4xl`, la caja versalita y el
 * peso 700. Ver DESIGN.md.
 *
 * `grade` (0 a 4) dibuja el medidor ordinal de carga: cuatro segmentos que se
 * llenan. El grado se lee CONTANDO, sin aprender la paleta; el color sólo
 * confirma lo que el conteo ya dijo. Se usa en los estados del embudo.
 *
 * Regla del violeta en esta app: violeta = acción. Un sello es dato, así que
 * el grado más alto va en tinta, nunca en violeta.
 */
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden border whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-primary [a]:hover:bg-primary/80",
        secondary:
          "bg-transparent text-muted-foreground border-rule [a]:hover:bg-muted",
        destructive:
          "bg-destructive/8 text-destructive border-destructive/35 focus-visible:ring-destructive/20 [a]:hover:bg-destructive/15",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "border-transparent text-muted-foreground hover:bg-muted hover:text-muted-foreground",
        /* El único que no es un sello: un enlace es prosa, no un estado. */
        link: "border-transparent text-primary underline-offset-4 hover:underline normal-case tracking-normal font-medium",
        ok: "bg-state-ok-soft text-state-ok-text border-state-ok/40 [a]:hover:bg-state-ok-soft/70",
        warn: "bg-state-warn-soft text-state-warn-text border-state-warn/40 [a]:hover:bg-state-warn-soft/70",
        risk: "bg-state-risk-soft text-state-risk-text border-state-risk/35 [a]:hover:bg-state-risk-soft/70",
        /* Carga comprometida: el grado más alto del embudo, en tinta. */
        firme:
          "bg-transparent text-foreground border-foreground [a]:hover:bg-muted",
      },
      size: {
        default: "h-[22px] px-1.5 text-[11px] font-bold uppercase tracking-[0.015em]",
        /* Para celdas muy apretadas. No baja de 10.5px: es el piso del ramp. */
        sm: "h-5 px-1 text-[10.5px] font-bold uppercase tracking-[0.02em]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  size = "default",
  grade,
  asChild = false,
  style,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean
    /** 0 a 4: grado de carga. Dibuja el medidor ordinal de cuatro segmentos. */
    grade?: 0 | 1 | 2 | 3 | 4
  }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-grade={grade}
      className={cn(
        badgeVariants({ variant, size }),
        "rounded-[var(--radius-stamp)]",
        className
      )}
      style={
        grade === undefined
          ? style
          : ({ ...style, "--grade": grade } as React.CSSProperties)
      }
      {...props}
    />
  )
}

export { Badge, badgeVariants }
