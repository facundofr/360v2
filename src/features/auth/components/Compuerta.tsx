import * as React from "react"

import { cn } from "@/lib/utils"
import ThemeToggle from "@/components/common/theme-toggle"
import Logo from "@/components/ui/logo"

/**
 * EL PADRÓN — la compuerta.
 *
 * La pantalla que se cruza antes de entrar al padrón: login, alta de cuenta,
 * recuperación, verificación. Una sola columna centrada de 336px, el logo
 * arriba y nada más. No hay ilustración al costado: la mitad de la pantalla
 * ocupada por una foto no ayuda a escribir una contraseña, y en el tema oscuro
 * obligaba a un filtro de brillo para que no encandilara.
 *
 * Reemplaza cuatro maquetados distintos —dos con la foto a la izquierda, dos
 * con tarjeta de sombra y cabecera de color— por uno solo.
 */
export function Compuerta({
  titulo,
  descripcion,
  icono: Icono,
  children,
  className,
}: {
  /** Se omite cuando el formulario ya trae su propio encabezado. */
  titulo?: React.ReactNode
  descripcion?: React.ReactNode
  /** Dibujado, nunca un emoji. */
  icono?: React.ElementType
  children: React.ReactNode
  className?: string
}) {
  return (
    <main className="relative grid min-h-svh place-items-center px-6 py-10">
      {/* El cambio de tema queda fuera del camino del formulario */}
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>

      <div className={cn("w-full max-w-[336px]", className)}>
        <Logo className="mx-auto mb-[18px] h-16" />

        {titulo && (
          <header className="mb-[22px] text-center">
            {Icono && (
              <Icono className="mx-auto mb-2.5 size-6 text-muted-foreground" aria-hidden="true" />
            )}
            <h1 className="text-[21px] font-bold tracking-[-0.025em]">{titulo}</h1>
            {descripcion && (
              <p className="mt-1.5 text-[12.5px] text-muted-foreground">{descripcion}</p>
            )}
          </header>
        )}

        {children}
      </div>
    </main>
  )
}
