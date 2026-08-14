import * as React from "react"
import { ArrowUp, ArrowDown, Minus, ChevronRight } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Tone = "neutral" | "ok" | "warn" | "risk"

const TONE_ICON_CLASS: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  ok: "bg-state-ok-soft text-state-ok-text",
  warn: "bg-state-warn-soft text-state-warn-text",
  risk: "bg-state-risk-soft text-state-risk-text",
}

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  subtitle?: React.ReactNode
  /** Tono del ícono. Default neutro: sólo usar ok/warn/risk si la card representa un estado real. */
  tone?: Tone
  /** positive: true → variación deseable (state-ok); false → variación indeseable (state-risk). */
  trend?: { value: number; positive: boolean } | null
  onClick?: () => void
  className?: string
  loading?: boolean
}

/**
 * Tarjeta KPI compartida (ícono + valor grande + etiqueta), reemplaza las ~8
 * reimplementaciones locales casi idénticas que había por rol, cada una con
 * su propio color de ícono arbitrario.
 */
export function StatCard({
  icon: Icon, label, value, subtitle, tone = "neutral", trend, onClick, className, loading,
}: StatCardProps) {
  return (
    <Card
      className={cn(onClick && "cursor-pointer hover:shadow-md transition-shadow", className)}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", TONE_ICON_CLASS[tone])}>
            <Icon className="size-5" />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {trend != null && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-xs font-medium",
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
            {onClick && <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />}
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight tabular-nums min-w-0 truncate">
          {loading ? "…" : value}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}
