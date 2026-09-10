import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import { MessageCircle, Clock, Check, CheckCheck, X } from "lucide-react"

import { API_URL } from "@/lib/config"
import { getAuthHeaders } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

// GET /admin/validacion-whatsapp/prospectos/:id/conversacion
// Equivalente a `ValidacionConversacionModal.jsx`. Forma real de la respuesta
// (`validacionWhatsappService.js:560-585`): { prospecto, conversacion, mensajes },
// con cada mensaje como { id, mensaje, tipo, origen, estado_entrega, created_at }.
// "Saliente" es cualquier origen que no sea 'cliente' (igual que prod).

type EstadoEntrega = "pendiente" | "enviando" | "enviado" | "entregado" | "leido" | "fallido"

interface MensajeValidacion {
  id?: number | string
  mensaje?: string
  origen?: string
  estado_entrega?: EstadoEntrega
  created_at?: string
}

interface ProspectoValidacion {
  nombre?: string
  apellido?: string
  numero_contacto?: string
  estado?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  prospectoId: number | string | null
  nombre?: string
}

const esSaliente = (m: MensajeValidacion) => m.origen !== "cliente"

function TicksEntrega({ estado }: { estado?: EstadoEntrega }) {
  switch (estado) {
    case "pendiente":
    case "enviando":
      return <Clock className="size-3 opacity-60" />
    case "enviado":
      return <Check className="size-3 opacity-75" />
    case "entregado":
      return <CheckCheck className="size-3 opacity-75" />
    case "leido":
      return <CheckCheck className="size-3 text-[#34B7F1]" />
    case "fallido":
      return <X className="size-3 text-destructive" />
    default:
      return null
  }
}

export function ValidacionConversacionModal({ open, onOpenChange, prospectoId, nombre }: Props) {
  const [mensajes, setMensajes] = React.useState<MensajeValidacion[]>([])
  const [prospecto, setProspecto] = React.useState<ProspectoValidacion | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open || !prospectoId) return
    let cancelado = false

    const cargar = async () => {
      setLoading(true)
      try {
        const { data } = await axios.get(
          `${API_URL}/admin/validacion-whatsapp/prospectos/${prospectoId}/conversacion`,
          { headers: getAuthHeaders() }
        )
        if (cancelado) return
        setMensajes(Array.isArray(data?.data?.mensajes) ? data.data.mensajes : [])
        setProspecto(data?.data?.prospecto ?? null)
      } catch {
        if (!cancelado) {
          setMensajes([])
          setProspecto(null)
          toast.error("No se pudo cargar la conversación")
        }
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    cargar()
    return () => { cancelado = true }
  }, [open, prospectoId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-4 text-state-ok-text" />
            {prospecto ? `${prospecto.nombre ?? ""} ${prospecto.apellido ?? ""}`.trim() : "Conversación de validación"}
          </DialogTitle>
          <DialogDescription>
            {nombre ?? `Prospecto #${prospectoId}`}
            {prospecto?.numero_contacto && ` · ${prospecto.numero_contacto}`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[55vh] pr-3">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-12 w-2/3 ml-auto" />
              <Skeleton className="h-12 w-3/5" />
            </div>
          ) : mensajes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Todavía no hay mensajes en esta validación.
            </p>
          ) : (
            <div className="space-y-2">
              {mensajes.map((m, i) => {
                const saliente = esSaliente(m)
                return (
                  <div key={m.id ?? i} className={cn("flex", saliente ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words",
                        saliente ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                    >
                      <div>{m.mensaje}</div>
                      <div className={cn(
                        "flex items-center justify-end gap-1 mt-1",
                        saliente ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        <span className="text-[10.5px]">
                          {m.created_at ? new Date(m.created_at).toLocaleString("es-AR", {
                            day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                          }) : ""}
                        </span>
                        {saliente && <TicksEntrega estado={m.estado_entrega} />}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {prospecto?.estado && (
          <DialogFooter className="sm:justify-start">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              Estado actual: <Badge variant="secondary">{prospecto.estado}</Badge>
            </p>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ValidacionConversacionModal
