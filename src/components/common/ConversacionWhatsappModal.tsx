import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import { MessageCircle, Loader2, ArrowLeft, User, Bot, Paperclip } from "lucide-react"

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
  fecha_envio?: string
  /** admin: 'enviado' | 'recibido' | 'sistema' — define la dirección (`adminModel.js:1867`). */
  tipo?: string
  /** admin: estado de entrega ('pendiente'|'enviado'|'entregado'|'leido'|'fallido'). */
  estado?: string
  /** admin: quién lo mandó del lado de la empresa, viene de un JOIN con `users`. */
  vendedor_nombre?: string
  vendedor_apellido?: string
  url_archivo?: string
  archivo_url?: string
  archivo_nombre?: string
  archivo_tamaño?: number
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

function esSaliente(m: Mensaje, rol: RolConversacion) {
  // Admin y supervisor: la dirección la da `tipo` ('enviado'/'recibido'/'sistema'),
  // no `direccion`/`from_me` (`chatController.js` supervisor, `adminModel.js:1867`).
  if ((rol === "admin" || rol === "supervisor") && m.tipo) return m.tipo === "enviado"
  if (typeof m.from_me === "boolean") return m.from_me
  if (typeof m.from_me === "number") return m.from_me === 1
  if (m.direccion) return m.direccion === "saliente"
  if (m.rol) return m.rol === "assistant" || m.rol === "vendedor"
  return false
}

/** Supervisor anida el array bajo `data.data.conversaciones`/`.mensajes`
 * (`chatController.js` supervisor: `{success, data: {prospecto, conversaciones}}`
 * y `{success, data: {conversacion, mensajes}}`) — los demás roles devuelven
 * el array directo en `data.data`. */
function conversacionesDe(rol: RolConversacion, data: unknown): Conversacion[] {
  const d = data as { data?: { conversaciones?: Conversacion[] } | Conversacion[] } | Conversacion[]
  if (rol === "supervisor") {
    const nested = (d as { data?: { conversaciones?: Conversacion[] } })?.data
    return (nested as { conversaciones?: Conversacion[] })?.conversaciones ?? []
  }
  const flat = (d as { data?: Conversacion[] })?.data ?? (d as Conversacion[])
  return Array.isArray(flat) ? flat : []
}

function mensajesDe(rol: RolConversacion, data: unknown): Mensaje[] {
  if (rol === "supervisor") {
    const nested = (data as { data?: { mensajes?: Mensaje[] } })?.data
    return (nested as { mensajes?: Mensaje[] })?.mensajes ?? []
  }
  const flat = (data as { data?: Mensaje[] })?.data ?? (data as Mensaje[])
  return Array.isArray(flat) ? flat : []
}

const textoDe = (m: Mensaje) => m.contenido ?? m.mensaje ?? m.texto ?? ""
const fechaDe = (m: Mensaje) => m.created_at ?? m.fecha_envio ?? m.fecha
const archivoDe = (m: Mensaje) => m.archivo_url ?? m.url_archivo

const ESTADO_ENTREGA_LABEL: Record<string, string> = {
  entregado: "Entregado",
  leido: "Leído",
  enviado: "Enviado",
  pendiente: "Pendiente",
  fallido: "Fallido",
}

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
        const lista = conversacionesDe(rol, data)
        setConversaciones(lista)

        if (rol === "admin") {
          // Admin fusiona automáticamente los mensajes de TODAS las
          // conversaciones en una sola línea de tiempo (`ProspectosAdmin.jsx:
          // 516-538, cargarTodosLosMensajes`) — no hay paso de selección.
          if (Array.isArray(lista) && lista.length > 0) {
            setLoadingMsg(true)
            try {
              const respuestas = await Promise.all(
                lista.map((c) => axios.get(urlMensajes(rol, c.id), { headers: getAuthHeaders() }))
              )
              if (cancelado) return
              const todos = respuestas.flatMap((r) => (r.data?.data ?? r.data ?? []) as Mensaje[])
              todos.sort((a, b) => {
                const fa = fechaDe(a), fb = fechaDe(b)
                return (fa ? new Date(fa).getTime() : 0) - (fb ? new Date(fb).getTime() : 0)
              })
              setMensajes(todos)
            } catch {
              if (!cancelado) toast.error("No se pudieron cargar los mensajes")
            } finally {
              if (!cancelado) setLoadingMsg(false)
            }
          }
        } else if (Array.isArray(lista) && lista.length === 1) {
          // Otros roles: si hay una sola conversación, abrirla directamente.
          setSeleccionada(lista[0])
        }
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
        setMensajes(mensajesDe(rol, data))
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

  // Admin fusiona todas las conversaciones en una sola línea de tiempo: no
  // hay paso de selección, se muestra directo en cuanto termina de cargar.
  const esAdmin = rol === "admin"
  const mostrarSelector = !esAdmin && !seleccionada
  const mostrarHilo = esAdmin ? conversaciones.length > 0 : !!seleccionada
  const descripcion = esAdmin
    ? conversaciones[0]
      ? `${conversaciones[0].prospecto_nombre ?? ""} ${conversaciones[0].prospecto_apellido ?? ""}`.trim() ||
        conversaciones[0].telefono || "Conversación"
      : "Conversación"
    : seleccionada
      ? `${seleccionada.prospecto_nombre ?? ""} ${seleccionada.prospecto_apellido ?? ""}`.trim() ||
        seleccionada.telefono ||
        "Conversación"
      : "Seleccioná una conversación para ver los mensajes."

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-4 text-muted-foreground" />
            {titulo ?? "Conversación de WhatsApp"}
          </DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>

        {/* Listado de conversaciones (sólo roles que no fusionan) */}
        {mostrarSelector && (
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

        {/* Hilo de mensajes (fusionado para admin, de una conversación para el resto) */}
        {mostrarHilo && (
          <>
            {!esAdmin && conversaciones.length > 1 && (
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
                    const saliente = esSaliente(m, rol)
                    const archivo = archivoDe(m)
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
                          <div className={cn("flex items-center gap-1 mb-0.5 flex-wrap text-[10px]", saliente ? "opacity-80" : "opacity-70")}>
                            {saliente ? <Bot className="size-3" /> : <User className="size-3" />}
                            <span>{fechaDe(m) ? new Date(fechaDe(m)!).toLocaleString("es-AR") : ""}</span>
                            {esAdmin && m.vendedor_nombre && (
                              <span className="flex items-center gap-0.5">
                                <User className="size-2.5" />{m.vendedor_nombre} {m.vendedor_apellido}
                              </span>
                            )}
                          </div>

                          {archivo ? (
                            <a href={archivo} target="_blank" rel="noopener noreferrer" className="underline">
                              {textoDe(m) || "Ver archivo adjunto"}
                            </a>
                          ) : (
                            textoDe(m)
                          )}

                          {esAdmin && m.archivo_nombre && (
                            <Badge variant="secondary" className="mt-1.5 gap-1 text-[10px] font-normal">
                              <Paperclip className="size-2.5" />
                              {m.archivo_nombre}
                              {m.archivo_tamaño ? ` (${(m.archivo_tamaño / 1024).toFixed(0)} KB)` : ""}
                            </Badge>
                          )}

                          {esAdmin && m.estado && (
                            <div className="mt-1 flex justify-end">
                              <Badge variant="outline" className="text-[10px] font-normal opacity-80">
                                {ESTADO_ENTREGA_LABEL[m.estado] ?? m.estado}
                              </Badge>
                            </div>
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

        {esAdmin && !loadingConv && conversaciones.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Este prospecto no tiene conversaciones de WhatsApp.
          </p>
        )}

        {loadingConv && <Loader2 className="size-4 animate-spin mx-auto text-muted-foreground" />}
      </DialogContent>
    </Dialog>
  )
}
