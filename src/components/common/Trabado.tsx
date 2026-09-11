import * as React from "react"
import { AlertTriangle, Check, FileText, Lock, MessageCircle, Phone } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Traba } from "@/utils/estados"

/**
 * EL PADRÓN — la celda «trabado en».
 *
 * Segunda mitad de la elevación que donó la dirección de tensegridad: cada
 * asiento expone CONTRA QUÉ está esperando, así un registro estancado se
 * rastrea hasta su bloqueo sin abrirlo.
 *
 * El ícono es dibujado, nunca un emoji, y se deriva de la traba: no es una
 * decisión que tome quien consume el componente. Las trabas libres llevan
 * `data-none`, que las atenúa en vez de darles su propio color.
 */
const ICONO_TRABA = {
  espera: Lock,
  llamada: Phone,
  chat: MessageCircle,
  papel: FileText,
  alerta: AlertTriangle,
  libre: Check,
} as const

export function Trabado({
  traba, className, ...props
}: Omit<React.ComponentProps<"span">, "children"> & { traba: Traba }) {
  const Icono = ICONO_TRABA[traba.icono]
  const libre = traba.icono === "libre"

  return (
    <span
      className={cn("blocked", className)}
      {...(libre ? { "data-none": "" } : {})}
      {...props}
    >
      <Icono className="size-3.5" aria-hidden="true" />
      <span>{traba.texto}</span>
    </span>
  )
}
