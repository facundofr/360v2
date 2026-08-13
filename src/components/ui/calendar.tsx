import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
const DAYS = ["Do","Lu","Ma","Mi","Ju","Vi","Sá"]

interface CalendarProps {
  mode?: "single" | "range"
  selected?: Date | { from?: Date; to?: Date } | null
  onSelect?: (date: Date | { from?: Date; to?: Date } | null) => void
  disabled?: (date: Date) => boolean
  className?: string
  initialFocus?: boolean
}

function Calendar({ mode = "single", selected, onSelect, disabled, className }: CalendarProps) {
  const today = new Date()
  const [viewDate, setViewDate] = React.useState<Date>(() => {
    if (selected instanceof Date) return new Date(selected.getFullYear(), selected.getMonth(), 1)
    if (selected && "from" in selected && selected.from) return new Date(selected.from.getFullYear(), selected.from.getMonth(), 1)
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  const isSelected = (d: Date): boolean => {
    if (!selected) return false
    if (selected instanceof Date) return selected.toDateString() === d.toDateString()
    if ("from" in selected) {
      if (selected.from && selected.from.toDateString() === d.toDateString()) return true
      if (selected.to && selected.to.toDateString() === d.toDateString()) return true
    }
    return false
  }

  const isInRange = (d: Date): boolean => {
    if (!selected || !(selected instanceof Object) || !("from" in selected)) return false
    const { from, to } = selected as { from?: Date; to?: Date }
    if (!from || !to) return false
    return d > from && d < to
  }

  const handleClick = (d: Date) => {
    if (disabled?.(d)) return
    if (mode === "single") {
      onSelect?.(d)
    } else {
      const range = selected as { from?: Date; to?: Date } | null
      if (!range?.from || (range.from && range.to)) {
        onSelect?.({ from: d })
      } else {
        if (d < range.from) {
          onSelect?.({ from: d, to: range.from })
        } else {
          onSelect?.({ from: range.from, to: d })
        }
      }
    }
  }

  const cells: (Date | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(year, month, i))

  return (
    <div className={cn("p-3 select-none", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-accent">
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium">{MONTHS[month]} {year}</span>
        <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-accent">
          <ChevronRight className="size-4" />
        </button>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs text-muted-foreground py-1">{d}</div>
        ))}
      </div>
      {/* Days */}
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) return <div key={`e-${i}`} />
          const isToday = d.toDateString() === today.toDateString()
          const sel = isSelected(d)
          const inRange = isInRange(d)
          const dis = disabled?.(d) ?? false
          return (
            <button
              key={d.toDateString()}
              type="button"
              onClick={() => handleClick(d)}
              disabled={dis}
              className={cn(
                "h-8 w-8 mx-auto flex items-center justify-center rounded-full text-sm transition-colors",
                isToday && !sel && "font-bold text-primary",
                sel && "bg-primary text-primary-foreground",
                inRange && !sel && "bg-accent rounded-none",
                !sel && !inRange && !dis && "hover:bg-accent",
                dis && "opacity-30 cursor-not-allowed"
              )}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { Calendar }
