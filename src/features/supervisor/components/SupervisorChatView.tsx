import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import { MessageCircle, RefreshCw, Search, User, Bot, Inbox } from "lucide-react"

import { API_URL } from "@/lib/config"
import { getAuthHeaders } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

// ─────────────────────────────────────────────────────────────────────────────
// Chat del supervisor: listado de conversaciones del equipo + hilo de mensajes.
// Endpoints:
//   GET /supervisor/chat/conversaciones
//   GET /supervisor/chat/mensajes/:conversacionId
// Paridad con el bloque de chat de `SupervisorDashboard.jsx`.
// ─────────────────────────────────────────────────────────────────────────────

interface Conversacion {
  id: number | string
  telefono?: string
  prospecto_nombre?: string
  prospecto_apellido?: string
  vendedor_nombre?: string
  estado?: string
  ultima_actividad?: string
  total_mensajes?: number
  no_leidos?: number
}

interface Mensaje {
  id?: number | string
  contenido?: string
  mensaje?: string
  direccion?: string
  from_me?: boolean | number
  created_at?: string
  fecha_envio?: string
  url_archivo?: string
}

const esSaliente = (m: Mensaje) => {
  if (typeof m.from_me === "boolean") return m.from_me
  if (typeof m.from_me === "number") return m.from_me === 1
  return m.direccion === "saliente"
}
const textoDe = (m: Mensaje) => m.contenido ?? m.mensaje ?? ""
const fechaDe = (m: Mensaje) => m.created_at ?? m.fecha_envio

export function SupervisorChatView() {
  const [conversaciones, setConversaciones] = React.useState<Conversacion[]>([])
  const [seleccionada, setSeleccionada] = React.useState<Conversacion | null>(null)
  const [mensajes, setMensajes] = React.useState<Mensaje[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadingMsg, setLoadingMsg] = React.useState(false)
  const [busqueda, setBusqueda] = React.useState("")

  const fetchConversaciones = React.useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API_URL}/supervisor/chat/conversaciones`, {
        headers: getAuthHeaders(),
      })
      const lista = data?.data ?? data ?? []
      setConversaciones(Array.isArray(lista) ? lista : [])
    } catch {
      toast.error("No se pudieron cargar las conversaciones")
      setConversaciones([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { fetchConversaciones() }, [fetchConversaciones])

  React.useEffect(() => {
    if (!seleccionada) return
    let cancelado = false

    const cargar = async () => {
      setLoadingMsg(true)
      try {
        const { data } = await axios.get(
          `${API_URL}/supervisor/chat/mensajes/${seleccionada.id}`,
          { headers: getAuthHeaders() }
        )
        if (cancelado) return
        const lista = data?.data ?? data ?? []
        setMensajes(Array.isArray(lista) ? lista : [])
      } catch {
        if (!cancelado) { setMensajes([]); toast.error("No se pudieron cargar los mensajes") }
      } finally {
        if (!cancelado) setLoadingMsg(false)
      }
    }

    cargar()
    return () => { cancelado = true }
  }, [seleccionada])

  const filtradas = React.useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    if (!t) return conversaciones
    return conversaciones.filter(c =>
      `${c.prospecto_nombre ?? ""} ${c.prospecto_apellido ?? ""} ${c.telefono ?? ""} ${c.vendedor_nombre ?? ""}`
        .toLowerCase()
        .includes(t)
    )
  }, [conversaciones, busqueda])

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* Listado */}
      <Card className="overflow-hidden">
        <CardContent className="p-3 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-9"
                placeholder="Buscar conversación…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="size-9" onClick={fetchConversaciones} disabled={loading}>
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </Button>
          </div>

          <ScrollArea className="h-[60vh] pr-2">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : filtradas.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Inbox className="size-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Sin conversaciones.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filtradas.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSeleccionada(c)}
                    className={cn(
                      "w-full text-left rounded-lg border p-2.5 transition-colors hover:bg-muted/50",
                      seleccionada?.id === c.id && "bg-muted border-primary/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">
                        {`${c.prospecto_nombre ?? ""} ${c.prospecto_apellido ?? ""}`.trim() || c.telefono || `#${c.id}`}
                      </span>
                      {(c.no_leidos ?? 0) > 0 && (
                        <Badge className="text-[10px] h-5">{c.no_leidos}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {[c.vendedor_nombre, c.telefono].filter(Boolean).join(" · ")}
                    </p>
                    {c.ultima_actividad && (
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(c.ultima_actividad).toLocaleString("es-AR")}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Hilo */}
      <Card className="overflow-hidden">
        <CardContent className="p-3">
          {!seleccionada ? (
            <div className="h-[60vh] flex flex-col items-center justify-center text-muted-foreground">
              <MessageCircle className="size-10 mb-2 opacity-30" />
              <p className="text-sm">Elegí una conversación para ver los mensajes.</p>
            </div>
          ) : (
            <>
              <div className="border-b pb-2 mb-3">
                <p className="font-medium text-sm">
                  {`${seleccionada.prospecto_nombre ?? ""} ${seleccionada.prospecto_apellido ?? ""}`.trim() ||
                    seleccionada.telefono}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[seleccionada.telefono, seleccionada.vendedor_nombre && `Vendedor: ${seleccionada.vendedor_nombre}`]
                    .filter(Boolean).join(" · ")}
                </p>
              </div>

              <ScrollArea className="h-[54vh] pr-3">
                {loadingMsg ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-3/4" />
                    <Skeleton className="h-12 w-2/3 ml-auto" />
                  </div>
                ) : mensajes.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
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
                              saliente ? "bg-green-600 text-white" : "bg-muted"
                            )}
                          >
                            <div className="flex items-center gap-1 mb-0.5 opacity-70">
                              {saliente ? <Bot className="size-3" /> : <User className="size-3" />}
                              <span className="text-[10px]">
                                {fechaDe(m) ? new Date(fechaDe(m)!).toLocaleString("es-AR") : ""}
                              </span>
                            </div>
                            {m.url_archivo ? (
                              <a href={m.url_archivo} target="_blank" rel="noopener noreferrer" className="underline">
                                {textoDe(m) || "Ver archivo adjunto"}
                              </a>
                            ) : textoDe(m)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
