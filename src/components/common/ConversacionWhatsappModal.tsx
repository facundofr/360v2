import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import { MessageCircle, Loader2, ArrowLeft, User, Bot } from "lucide-react"

import { API_URL } from "@/lib/config"
import { getAuthHeaders } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// ─────────────────────────────────────────────────────────────────────────────
// Visor de conversaciones de WhatsApp de un prospecto.
//
// Los tres roles leen lo mismo pero por rutas distintas, así que el componente
// recibe el `rol` y arma los endpoints. Reemplaza al visor que en producción
// está duplicado en ProspectosAdmin, PolizasBackOffice y SupervisorDashboard.
// ─────────────────────────────────────────────────────────────────────────────

export type RolConversacion = "admin" | "backoffice" | "supervisor"

interface Conversacion {
  id: number | string
  telefono?: string
  prospecto_nombre?: string
  prospecto_apellido?: string
  estado?: string
  ultima_actividad?: string
  total_mensajes?: number
}

interface Mensaje {
  id?: number | string
  contenido?: string
  mensaje?: string
  texto?: string
  direccion?: "entrante" | "saliente" | string
  rol?: string
  from_me?: boolean | number
  created_at?: string
  fecha?: string
  tipo?: string
  url_archivo?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  rol: RolConversacion
  /** Prospecto cuyas conversaciones se listan. */
  prospectoId?: number | string | null
  /** Teléfono, alternativa que usa la ruta de admin. */
  telefono?: string | null
  titulo?: string
}

/** Rutas por rol: listado de conversaciones del prospecto. */
function urlConversaciones(rol: RolConversacion, prospectoId: number | string, telefono?: string | null) {
  if (rol === "admin" && telefono) return `${API_URL}/admin/whatsapp/conversaciones/${encodeURIComponent(telefono)}`
  if (rol === "backoffice") return `${API_URL}/backoffice/polizas/prospectos/${prospectoId}/conversaciones`
  if (rol === "supervisor") return `${API_URL}/supervisor/chat/conversaciones/prospecto/${prospectoId}`
  return `${API_URL}/chat/conversaciones/prospecto/${prospectoId}`
}

/** Rutas por rol: mensajes de una conversación. */
function urlMensajes(rol: RolConversacion, conversacionId: number | string) {
  if (rol === "admin") return `${API_URL}/admin/whatsapp/conversacion/${conversacionId}/mensajes`
  if (rol === "backoffice") return `${API_URL}/backoffice/polizas/conversaciones/${conversacionId}/mensajes`
  if (rol === "supervisor") return `${API_URL}/supervisor/chat/mensajes/${conversacionId}`
  return `${API_URL}/chat/conversaciones/${conversacionId}/mensajes`
}

function esSaliente(m: Mensaje) {
  if (typeof m.from_me === "boolean") return m.from_me
  if (typeof m.from_me === "number") return m.from_me === 1
  if (m.direccion) return m.direccion === "saliente"
  if (m.rol) return m.rol === "assistant" || m.rol === "vendedor"
  return false
}

const textoDe = (m: Mensaje) => m.contenido ?? m.mensaje ?? m.texto ?? ""
const fechaDe = (m: Mensaje) => m.created_at ?? m.fecha

export function ConversacionWhatsappModal({
  open,
  onOpenChange,
  rol,
  prospectoId,
  telefono,
  titulo,
}: Props) {
  const [conversaciones, setConversaciones] = React.useState<Conversacion[]>([])
  const [seleccionada, setSeleccionada] = React.useState<Conversacion | null>(null)
  const [mensajes, setMensajes] = React.useState<Mensaje[]>([])
  const [loadingConv, setLoadingConv] = React.useState(false)
  const [loadingMsg, setLoadingMsg] = React.useState(false)

  // Cargar conversaciones al abrir
  React.useEffect(() => {
    if (!open || (!prospectoId && !telefono)) return
    let cancelado = false

    const cargar = async () => {
      setLoadingConv(true)
      setSeleccionada(null)
      setMensajes([])
      try {
        const { data } = await axios.get(urlConversaciones(rol, prospectoId ?? "", telefono), {
          headers: getAuthHeaders(),
        })
        if (cancelado) return
        const lista: Conversacion[] = data?.data ?? data ?? []
        setConversaciones(Array.isArray(lista) ? lista : [])
        // Si hay una sola, abrirla directamente.
        if (Array.isArray(lista) && lista.length === 1) setSeleccionada(lista[0])
      } catch {
        if (!cancelado) {
          setConversaciones([])
          toast.error("No se pudieron cargar las conversaciones")
        }
      } finally {
        if (!cancelado) setLoadingConv(false)
      }
    }

    cargar()
    return () => { cancelado = true }
  }, [open, rol, prospectoId, telefono])

  // Cargar mensajes de la conversación seleccionada
  React.useEffect(() => {
    if (!seleccionada) return
    let cancelado = false

    const cargar = async () => {
      setLoadingMsg(true)
      try {
        const { data } = await axios.get(urlMensajes(rol, seleccionada.id), { headers: getAuthHeaders() })
        if (cancelado) return
        const lista: Mensaje[] = data?.data ?? data ?? []
        setMensajes(Array.isArray(lista) ? lista : [])
      } catch {
        if (!cancelado) {
          setMensajes([])
          toast.error("No se pudieron cargar los mensajes")
        }
      } finally {
        if (!cancelado) setLoadingMsg(false)
      }
    }

    cargar()
    return () => { cancelado = true }
  }, [seleccionada, rol])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-4 text-muted-foreground" />
            {titulo ?? "Conversación de WhatsApp"}
          </DialogTitle>
          <DialogDescription>
            {seleccionada
              ? `${seleccionada.prospecto_nombre ?? ""} ${seleccionada.prospecto_apellido ?? ""}`.trim() ||
                seleccionada.telefono ||
                "Conversación"
              : "Seleccioná una conversación para ver los mensajes."}
          </DialogDescription>
        </DialogHeader>

        {/* Listado de conversaciones */}
        {!seleccionada && (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {loadingConv ? (
              <>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </>
            ) : conversaciones.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Este prospecto no tiene conversaciones de WhatsApp.
              </p>
            ) : (
              conversaciones.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSeleccionada(c)}
                  className="w-full text-left border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">
                      {`${c.prospecto_nombre ?? ""} ${c.prospecto_apellido ?? ""}`.trim() || c.telefono || `#${c.id}`}
                    </span>
                    {c.estado && <Badge variant="outline" className="text-xs">{c.estado}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[c.telefono, c.total_mensajes != null && `${c.total_mensajes} mensajes`,
                      c.ultima_actividad && new Date(c.ultima_actividad).toLocaleString("es-AR")]
                      .filter(Boolean).join(" · ")}
                  </p>
                </button>
              ))
            )}
          </div>
        )}

        {/* Hilo de mensajes */}
        {seleccionada && (
          <>
            {conversaciones.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="self-start h-7 -mt-2"
                onClick={() => setSeleccionada(null)}
              >
                <ArrowLeft className="size-3.5 mr-1" />Volver a conversaciones
              </Button>
            )}
            <ScrollArea className="h-[55vh] pr-3">
              {loadingMsg ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-3/4" />
                  <Skeleton className="h-12 w-2/3 ml-auto" />
                  <Skeleton className="h-12 w-3/5" />
                </div>
              ) : mensajes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  La conversación no tiene mensajes.
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
                            saliente
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-1 mb-0.5 opacity-70">
                            {saliente ? <Bot className="size-3" /> : <User className="size-3" />}
                            <span className="text-[10px]">
                              {fechaDe(m) ? new Date(fechaDe(m)!).toLocaleString("es-AR") : ""}
                            </span>
                          </div>
                          {m.url_archivo ? (
                            <a
                              href={m.url_archivo}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline"
                            >
                              {textoDe(m) || "Ver archivo adjunto"}
                            </a>
                          ) : (
                            textoDe(m)
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </>
        )}

        {loadingConv && <Loader2 className="size-4 animate-spin mx-auto text-muted-foreground" />}
      </DialogContent>
    </Dialog>
  )
}
