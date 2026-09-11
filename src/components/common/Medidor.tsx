import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * EL PADRÓN — el medidor.
 *
 * Barras de proporción que son dato, no adorno. Tres columnas fijas —rótulo,
 * pista, cifra— para que las filas se comparen leyendo en vertical.
 *
 * El relleno es tinta. Antes cada fila llevaba su propio color arbitrario, así
 * que había que leer la leyenda para saber qué era cada barra; acá la posición
 * y el rótulo ya lo dicen. El color queda reservado para los tonos de estado,
 * donde el color ES el dato.
 *
 * Reemplaza el patrón que estaba copiado en tres vistas de admin, cada una con
 * su propia altura de pista y su propia paleta.
 */

type Tono = "ink" | "muted" | "ok" | "warn" | "risk"

export function Medidor({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="medidor" className={cn("meter", className)} {...props}>
      {children}
    </div>
  )
}

interface MedidorFilaProps extends Omit<React.ComponentProps<"div">, "children"> {
  rotulo: React.ReactNode
  /** Lo que se muestra a la derecha: puede ser el conteo o el porcentaje. */
  cifra: React.ReactNode
  /** 0 a 100. Se recorta al rango: una proporción fuera de él es un error de cálculo. */
  porcentaje: number
  tono?: Tono
  /** Texto para lectores de pantalla, si la cifra sola no alcanza. */
  descripcion?: string
}

export function MedidorFila({
  rotulo, cifra, porcentaje, tono = "ink", descripcion, className, ...props
}: MedidorFilaProps) {
  /* Un porcentaje que llega NaN o fuera de rango se trata como cero: mostrar
     "NaN%" en pantalla es peor que mostrar una barra vacía. */
  const pct = Number.isFinite(porcentaje) ? Math.min(100, Math.max(0, porcentaje)) : 0

  return (
    <div
      className={cn("meter-row", className)}
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={descripcion ?? (typeof rotulo === "string" ? rotulo : undefined)}
      {...props}
    >
      <span className="rotulo">{rotulo}</span>
      <span className="track">
        <span
          className="fill"
          style={{ transform: `scaleX(${pct / 100})`, width: "100%" }}
          {...(tono !== "ink" ? { "data-tone": tono } : {})}
        />
      </span>
      <b className="cifra">{cifra}</b>
    </div>
  )
}

/**
 * La pista suelta, sin la retícula de tres columnas.
 *
 * Para los lugares donde el medidor completo no entra: una tarjeta de uso de
 * CPU que ya tiene su propio rótulo arriba, o una celda de tabla angosta.
 * Comparte la forma —2px de radio, filete de 1px, papel hundido— sin imponer
 * un layout que ahí no cabe.
 */
export function Pista({
  porcentaje, tono = "ink", className, ...props
}: Omit<React.ComponentProps<"span">, "children"> & { porcentaje: number; tono?: Tono }) {
  const pct = Number.isFinite(porcentaje) ? Math.min(100, Math.max(0, porcentaje)) : 0
  return (
    <span className={cn("track block", className)} {...props}>
      <span
        className="fill"
        style={{ transform: `scaleX(${pct / 100})`, width: "100%" }}
        {...(tono !== "ink" ? { "data-tone": tono } : {})}
      />
    </span>
  )
}
