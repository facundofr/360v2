import * as React from "react"
import { ArrowUp, ArrowDown, Minus, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

type Tone = "neutral" | "ok" | "warn" | "risk"

/* El tono tiñe el ícono y nada más. En El Padrón el color confirma un estado;
   nunca es la decoración de un número. */
const TONE_ICON_CLASS: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  ok: "text-state-ok-text",
  warn: "text-state-warn-text",
  risk: "text-state-risk-text",
}

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  subtitle?: React.ReactNode
  /** Tono del ícono. Default neutro: sólo usar ok/warn/risk si representa un estado real. */
  tone?: Tone
  /** positive: true → variación deseable (state-ok); false → variación indeseable (state-risk). */
  trend?: { value: number; positive: boolean } | null
  onClick?: () => void
  className?: string
  loading?: boolean
}

/**
 * EL PADRÓN — la lectura.
 *
 * Antes era la plantilla de KPI que toda app de esta categoría ships: tarjeta
 * con sombra, ícono dentro de un cuadrado de color y un número enorme. Acá es
 * una lectura de folio: rótulo administrativo arriba, cifra tabular abajo,
 * filete de 1px y nada levitando.
 *
 * El ícono acompaña al rótulo en vez de ocupar su propia baldosa de color: en
 * este mundo el color comunica estado, no jerarquía visual.
 */
export function StatCard({
  icon: Icon, label, value, subtitle, tone = "neutral", trend, onClick, className, loading,
}: StatCardProps) {
  const Comp = onClick ? "button" : "div"

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-lg border border-rule bg-card px-4 py-3 text-left",
        onClick && "cursor-pointer transition-colors hover:bg-paper-sunk",
        className
      )}
    >
      {/* Rótulo: voz de encabezado de columna, no de titular. */}
      <span className="flex min-w-0 items-center gap-1.5">
        <Icon className={cn("size-3.5 shrink-0", TONE_ICON_CLASS[tone])} aria-hidden="true" />
        <span className="truncate text-[10.5px] font-bold tracking-[0.09em] text-muted-foreground uppercase">
          {label}
        </span>
        {onClick && <ChevronRight className="ml-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
      </span>

      {/* Cifra y variación, en la misma línea de base. */}
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="min-w-0 truncate text-[21px] leading-none font-bold tracking-[-0.025em] tabular-nums">
          {loading ? "—" : value}
        </span>
        {trend != null && (
          <span
            className={cn(
              "flex shrink-0 items-center gap-0.5 text-[11px] font-semibold tabular-nums",
              trend.value === 0
                ? "text-muted-foreground"
                : trend.positive
                  ? "text-state-ok-text"
                  : "text-state-risk-text"
            )}
          >
            {trend.value > 0 ? <ArrowUp className="size-3" /> : trend.value < 0 ? <ArrowDown className="size-3" /> : <Minus className="size-3" />}
            {Math.abs(trend.value)}%
          </span>
        )}
      </span>

      {subtitle && (
        <span className="truncate text-[11.5px] text-muted-foreground">{subtitle}</span>
      )}
    </Comp>
  )
}
