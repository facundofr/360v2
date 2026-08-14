import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import { MessageCircle, User, Bot } from "lucide-react"

import { API_URL } from "@/lib/config"
import { getAuthHeaders } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

// GET /admin/validacion-whatsapp/prospectos/:id/conversacion
// Equivalente a `ValidacionConversacionModal.jsx`.

interface MensajeValidacion {
  id?: number | string
  contenido?: string
  mensaje?: string
  direccion?: string
  from_me?: boolean | number
  created_at?: string
  fecha_envio?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  prospectoId: number | string | null
  nombre?: string
}

const esSaliente = (m: MensajeValidacion) => {
  if (typeof m.from_me === "boolean") return m.from_me
  if (typeof m.from_me === "number") return m.from_me === 1
  return m.direccion === "saliente"
}

export function ValidacionConversacionModal({ open, onOpenChange, prospectoId, nombre }: Props) {
  const [mensajes, setMensajes] = React.useState<MensajeValidacion[]>([])
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
        const lista = data?.data?.mensajes ?? data?.data ?? data ?? []
        setMensajes(Array.isArray(lista) ? lista : [])
      } catch {
        if (!cancelado) {
          setMensajes([])
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
            <MessageCircle className="size-4 text-muted-foreground" />
            Conversación de validación
          </DialogTitle>
          <DialogDescription>{nombre ?? `Prospecto #${prospectoId}`}</DialogDescription>
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
                const fecha = m.created_at ?? m.fecha_envio
                return (
                  <div key={m.id ?? i} className={cn("flex", saliente ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words",
                        saliente ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-1 mb-0.5 opacity-70">
                        {saliente ? <Bot className="size-3" /> : <User className="size-3" />}
                        <span className="text-[10px]">
                          {fecha ? new Date(fecha).toLocaleString("es-AR") : ""}
                        </span>
                      </div>
                      {m.contenido ?? m.mensaje ?? ""}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

export default ValidacionConversacionModal
