import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * EL PADRÓN — el estado vacío.
 *
 * Estaba escrito a mano en 24 archivos, cada uno con su propio tamaño de
 * ícono, su propio texto centrado y su propia opacidad. Acá dice tres cosas
 * en orden: qué no hay, por qué, y qué se puede hacer al respecto.
 *
 * El ícono va tenue y sin baldosa de color: en este mundo el color comunica
 * estado, y "vacío" no es un estado que haya que señalar con color.
 */
interface EstadoVacioProps extends Omit<React.ComponentProps<"div">, "title"> {
  icono?: React.ElementType
  titulo: React.ReactNode
  /** Por qué está vacío. Se corta en 46ch: es prosa, no un rótulo. */
  descripcion?: React.ReactNode
  /** Qué hacer. Un solo botón: si hay dos, el vacío no era el problema. */
  accion?: React.ReactNode
  /** Para vacíos dentro de una celda o un panel angosto. */
  compacto?: boolean
}

export function EstadoVacio({
  icono: Icono, titulo, descripcion, accion, compacto, className, ...props
}: EstadoVacioProps) {
  return (
    <div
      data-slot="estado-vacio"
      className={cn(
        "flex flex-col items-center text-center",
        compacto ? "gap-2 px-4 py-8" : "gap-3 px-4 py-14",
        className
      )}
      {...props}
    >
      {Icono && (
        <Icono
          className={cn("shrink-0 text-muted-foreground/45", compacto ? "size-6" : "size-8")}
          aria-hidden="true"
        />
      )}
      <div>
        <p className={cn("font-semibold", compacto ? "text-[12.5px]" : "text-[14px]")}>{titulo}</p>
        {descripcion && (
          <p className="mx-auto mt-1 max-w-[46ch] text-[12.5px] leading-relaxed text-muted-foreground">
            {descripcion}
          </p>
        )}
      </div>
      {accion && <div className="mt-1">{accion}</div>}
    </div>
  )
}
