import { useState, useEffect, useRef, useCallback } from "react"
import axios from "axios"
import { toast } from "sonner"
import {
  MessageCircle, Send, ArrowLeft, Search, RefreshCw,
  Paperclip, X, Check, CheckCheck, Download, FileText, Image
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Conversacion {
  id: number
  telefono?: string
  prospecto_nombre?: string
  prospecto_apellido?: string
  ultimo_mensaje?: string
  mensajes_no_leidos?: number
  updated_at?: string
  /** abierta | pendiente | cerrada */
  estado?: string
}

interface Mensaje {
  id: string | number
  mensaje?: string
  texto?: string
  tipo?: "enviado" | "recibido" | string
  origen?: "vendedor" | "cliente" | string
  estado_entrega?: string
  created_at?: string
  archivo_url?: string
  archivo_tipo?: string
  archivo_nombre?: string
}

interface Plantilla {
  id: string
  nombre: string
  descripcion?: string
}

interface EstadisticasChat {
  total_conversaciones?: number
  conversaciones_activas?: number
  mensajes_hoy?: number
  sin_responder?: number
  [k: string]: number | undefined
}

// ─── Adjuntos: mismos límites que producción (`WhatsAppVista.jsx`) ───────────
const MAX_ARCHIVO_BYTES = 100 * 1024 * 1024 // 100 MB

const TIPOS_PERMITIDOS = [
  "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "video/mp4", "video/3gpp",
  "audio/mpeg", "audio/ogg", "audio/aac", "audio/amr",
]

const ACCEPT_ARCHIVOS =
  ".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.mp4,.3gpp,.mp3,.ogg,.aac,.amr"

function maskPhone(phone: string): string {
  if (!phone) return ""
  const cleaned = phone.replace(/\D/g, "")
  if (cleaned.length < 4) return phone
  return "*".repeat(Math.max(0, cleaned.length - 4)) + cleaned.slice(-4)
}

const PLANTILLAS_DEFAULT: Record<string, Plantilla> = {
  saludo_inicial: { id: "saludo_inicial", nombre: "Saludo Inicial", descripcion: "👋 Primer contacto" },
  seguimiento_cotizacion: { id: "seguimiento_cotizacion", nombre: "Seguimiento Cotización", descripcion: "📄 Seguimiento post-cotización" },
  seguimiento_poliza: { id: "seguimiento_poliza", nombre: "Seguimiento Póliza", descripcion: "✅ Verificar recepción póliza" },
  informacion_adicional: { id: "informacion_adicional", nombre: "Información Adicional", descripcion: "💙 Info sobre plan de salud" },
  cierre_conversacion: { id: "cierre_conversacion", nombre: "Cierre Conversación", descripcion: "✨ Despedida cortés" },
}

interface WhatsAppVistaProps {
  onVolver?: () => void
}

export function WhatsAppVista({ onVolver }: WhatsAppVistaProps) {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [conversacionActual, setConversacionActual] = useState<Conversacion | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [nuevoMensaje, setNuevoMensaje] = useState("")
  const [plantillas, setPlantillas] = useState<Record<string, Plantilla>>(PLANTILLAS_DEFAULT)
  const [loading, setLoading] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [vistaMovil, setVistaMovil] = useState<"lista" | "chat">("lista")
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null)
  const [estadisticas, setEstadisticas] = useState<EstadisticasChat | null>(null)

  const mensajesRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const authHeaders = { Authorization: `Bearer ${getAuthToken()}` }

  const cargarConversaciones = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/chat/conversaciones`, {
        headers: authHeaders,
        params: { limit: 50, busqueda },
      })
      if (data.success) setConversaciones(data.data ?? [])
    } catch {
      // silencioso en auto-refresh
    }
  }, [busqueda])

  const cargarMensajes = useCallback(async (id: number) => {
    try {
      const { data } = await axios.get(`${API_URL}/chat/conversaciones/${id}/mensajes`, { headers: authHeaders })
      if (data.success) setMensajes(data.data ?? [])
    } catch {
      // silencioso
    }
  }, [])

  const marcarLeidos = async (id: number) => {
    try {
      await axios.patch(`${API_URL}/chat/conversaciones/${id}/marcar-leidos`, {}, { headers: authHeaders })
    } catch {
      // silencioso
    }
  }

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/chat/conversaciones`, {
          headers: authHeaders,
          params: { limit: 50, busqueda: "" },
        })
        if (data.success) setConversaciones(data.data ?? [])
      } catch { void 0 }
      try {
        // API_URL ya termina en /api; prod tiene acá un `/api` de más y por eso
        // siempre cae al catálogo por defecto. La ruta real es /api/whatsapp/plantillas.
        const { data } = await axios.get(`${API_URL}/whatsapp/plantillas`, { headers: authHeaders })
        if (data.success && data.plantillas) setPlantillas(data.plantillas)
      } catch { void 0 }
      try {
        const { data } = await axios.get(`${API_URL}/chat/estadisticas`, { headers: authHeaders })
        setEstadisticas(data?.data ?? data ?? null)
      } catch { void 0 }
    }
    init()

    intervalRef.current = setInterval(() => {
      cargarConversaciones()
      if (conversacionActual) cargarMensajes(conversacionActual.id)
    }, 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  useEffect(() => {
    if (conversacionActual) {
      const id = setInterval(() => cargarMensajes(conversacionActual.id), 5000)
      return () => clearInterval(id)
    }
  }, [conversacionActual])

  useEffect(() => {
    if (mensajesRef.current) {
      mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight
    }
  }, [mensajes])

  const abrirConversacion = async (conv: Conversacion) => {
    setLoading(true)
    setConversacionActual(conv)
    setVistaMovil("chat")
    await cargarMensajes(conv.id)
    await marcarLeidos(conv.id)
    setConversaciones(prev => prev.map(c => c.id === conv.id ? { ...c, mensajes_no_leidos: 0 } : c))
    setLoading(false)
  }

  /** Valida tamaño y tipo antes de aceptar el adjunto (igual que prod). */
  const seleccionarArchivo = (file: File | null) => {
    if (!file) { setArchivoSeleccionado(null); return }

    if (file.size > MAX_ARCHIVO_BYTES) {
      toast.error("El archivo es demasiado grande. Tamaño máximo: 100 MB")
      return
    }
    if (!TIPOS_PERMITIDOS.includes(file.type)) {
      toast.error("Tipo de archivo no permitido")
      return
    }
    setArchivoSeleccionado(file)
  }

  /** PATCH /chat/conversaciones/:id/estado — cerrar / reabrir la conversación. */
  const cambiarEstadoConversacion = async (estado: string, motivo?: string) => {
    if (!conversacionActual) return
    try {
      await axios.patch(
        `${API_URL}/chat/conversaciones/${conversacionActual.id}/estado`,
        { estado, motivo },
        { headers: authHeaders }
      )
      setConversacionActual(prev => (prev ? { ...prev, estado } : prev))
      setConversaciones(prev => prev.map(c => (c.id === conversacionActual.id ? { ...c, estado } : c)))
      toast.success(`Conversación marcada como "${estado}"`)
    } catch {
      toast.error("No se pudo cambiar el estado de la conversación")
    }
  }

  const enviarMensaje = async () => {
    if ((!nuevoMensaje.trim() && !archivoSeleccionado) || !conversacionActual) return
    setEnviando(true)

    // Optimistic
    const tempMsg: Mensaje = {
      id: `temp-${Date.now()}`,
      mensaje: nuevoMensaje,
      tipo: "enviado",
      origen: "vendedor",
      estado_entrega: "enviando",
      created_at: new Date().toISOString(),
    }
    setMensajes(prev => [...prev, tempMsg])
    const texto = nuevoMensaje
    setNuevoMensaje("")

    try {
      if (archivoSeleccionado) {
        const fd = new FormData()
        fd.append("archivo", archivoSeleccionado)
        fd.append("mensaje", texto)
        await axios.post(
          `${API_URL}/chat/conversaciones/${conversacionActual.id}/mensajes/archivo`,
          fd,
          { headers: { ...authHeaders, "Content-Type": "multipart/form-data" } }
        )
        setArchivoSeleccionado(null)
      } else {
        await axios.post(
          `${API_URL}/chat/conversaciones/${conversacionActual.id}/mensajes`,
          { mensaje: texto },
          { headers: authHeaders }
        )
      }
      await cargarMensajes(conversacionActual.id)
    } catch {
      setMensajes(prev => prev.map(m => m.id === tempMsg.id ? { ...m, estado_entrega: "fallido" } : m))
      toast.error("Error al enviar el mensaje")
    } finally {
      setEnviando(false)
    }
  }

  const enviarPlantilla = async (plantillaId: string) => {
    if (!conversacionActual) return
    setEnviando(true)
    const user = JSON.parse(localStorage.getItem("auth_user") ?? "{}")
    const nombreVendedor = user?.nombre ?? "tu asesor"
    const nombreCliente = `${conversacionActual.prospecto_nombre ?? ""} ${conversacionActual.prospecto_apellido ?? ""}`.trim() || "estimado cliente"

    // `API_URL` ya termina en `/api` y el backend monta estas rutas en
    // `/api/whatsapp` (server.js:286), así que el path va SIN repetir el prefijo.
    // Producción escribe `${API_URL}/api/whatsapp/...` → `/api/api/whatsapp/...`
    // y las cinco plantillas devuelven 404. No replicar ese bug.
    const endpoints: Record<string, { url: string; body: object }> = {
      saludo_inicial: { url: `${API_URL}/whatsapp/saludo-inicial`, body: { telefono: conversacionActual.telefono, nombreVendedor } },
      seguimiento_cotizacion: { url: `${API_URL}/whatsapp/seguimiento-cotizacion`, body: { telefono: conversacionActual.telefono, nombreCliente } },
      seguimiento_poliza: { url: `${API_URL}/whatsapp/seguimiento-poliza`, body: { telefono: conversacionActual.telefono, nombreCliente } },
      informacion_adicional: { url: `${API_URL}/whatsapp/informacion-adicional`, body: { telefono: conversacionActual.telefono } },
      cierre_conversacion: { url: `${API_URL}/whatsapp/cierre-conversacion`, body: { telefono: conversacionActual.telefono } },
    }

    const ep = endpoints[plantillaId]
    if (!ep) { setEnviando(false); return }

    try {
      await axios.post(ep.url, ep.body, { headers: authHeaders })
      toast.success(`Plantilla "${plantillas[plantillaId]?.nombre}" enviada`)
      await cargarMensajes(conversacionActual.id)
    } catch {
      toast.error("Error al enviar la plantilla")
    } finally {
      setEnviando(false)
    }
  }

  const conversacionesFiltradas = conversaciones.filter(c => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      c.prospecto_nombre?.toLowerCase().includes(q) ||
      c.prospecto_apellido?.toLowerCase().includes(q) ||
      c.telefono?.includes(q)
    )
  })

  const formatHora = (iso?: string) => {
    if (!iso) return ""
    const d = new Date(iso)
    return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
  }

  const esEnviado = (msg: Mensaje) => msg.tipo === "enviado" || msg.origen === "vendedor"

  return (
    <div className="flex h-[calc(100vh-80px)] border rounded-xl overflow-hidden">
      {/* ─── Lista de conversaciones ──── */}
      <div className={`w-full sm:w-80 border-r flex flex-col ${vistaMovil === "chat" ? "hidden sm:flex" : "flex"}`}>
        {/* Header Lista */}
        <div className="px-4 py-3 border-b">
          {onVolver && (
            <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={onVolver}>
              <ArrowLeft className="size-4 mr-1" />Volver
            </Button>
          )}
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="size-5 text-green-600" />
            <h2 className="font-semibold">WhatsApp</h2>
          </div>
          {/* Estadísticas del chat (GET /chat/estadisticas) */}
          {estadisticas && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {estadisticas.conversaciones_activas != null && (
                <Badge variant="outline" className="text-[10px]">
                  {estadisticas.conversaciones_activas} activas
                </Badge>
              )}
              {estadisticas.mensajes_hoy != null && (
                <Badge variant="outline" className="text-[10px]">
                  {estadisticas.mensajes_hoy} hoy
                </Badge>
              )}
              {(estadisticas.sin_responder ?? 0) > 0 && (
                <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500">
                  {estadisticas.sin_responder} sin responder
                </Badge>
              )}
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-9 text-sm"
              placeholder="Buscar conversación..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        {/* Conversaciones */}
        <div className="flex-1 overflow-y-auto">
          {conversacionesFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <MessageCircle className="size-10 mb-3 opacity-30" />
              <p className="text-sm">Sin conversaciones</p>
            </div>
          ) : (
            conversacionesFiltradas.map(conv => (
              <button
                key={conv.id}
                className={`w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors flex items-start gap-3 ${conversacionActual?.id === conv.id ? "bg-muted" : ""}`}
                onClick={() => abrirConversacion(conv)}
              >
                <div className="size-9 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
                  <MessageCircle className="size-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">
                      {conv.prospecto_nombre} {conv.prospecto_apellido}
                    </p>
                    <span className="text-xs text-muted-foreground shrink-0 ml-1">{formatHora(conv.updated_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{maskPhone(conv.telefono ?? "")}</p>
                  {conv.ultimo_mensaje && (
                    <p className="text-xs text-muted-foreground truncate">{conv.ultimo_mensaje}</p>
                  )}
                </div>
                {(conv.mensajes_no_leidos ?? 0) > 0 && (
                  <Badge className="bg-green-600 shrink-0 text-xs">
                    {conv.mensajes_no_leidos}
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>

        <div className="p-2 border-t">
          <Button variant="ghost" size="sm" className="w-full" onClick={cargarConversaciones}>
            <RefreshCw className="size-4 mr-2" />Actualizar
          </Button>
        </div>
      </div>

      {/* ─── Panel de chat ──── */}
      <div className={`flex-1 flex flex-col ${vistaMovil === "lista" ? "hidden sm:flex" : "flex"}`}>
        {!conversacionActual ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <MessageCircle className="size-14 opacity-20" />
            <p className="text-sm">Seleccioná una conversación para ver los mensajes</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden size-8"
                onClick={() => setVistaMovil("lista")}
              >
                <ArrowLeft className="size-4" />
              </Button>
              <div className="size-9 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <MessageCircle className="size-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">
                  {conversacionActual.prospecto_nombre} {conversacionActual.prospecto_apellido}
                </p>
                <p className="text-xs text-muted-foreground">{maskPhone(conversacionActual.telefono ?? "")}</p>
              </div>

              {/* Estado de la conversación (PATCH .../estado) */}
              <Select
                value={conversacionActual.estado ?? "abierta"}
                onValueChange={v => cambiarEstadoConversacion(v)}
              >
                <SelectTrigger className="h-7 w-[120px] text-xs shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="abierta">Abierta</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="cerrada">Cerrada</SelectItem>
                </SelectContent>
              </Select>

              {/* Plantillas */}
              <div className="flex gap-1 flex-wrap justify-end">
                {Object.values(plantillas).map(plt => (
                  <Button
                    key={plt.id}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => enviarPlantilla(plt.id)}
                    disabled={enviando}
                    title={plt.descripcion}
                  >
                    {plt.nombre.replace("Seguimiento ", "").replace(" Conversación", "")}
                  </Button>
                ))}
              </div>
            </div>

            {/* Mensajes */}
            <div ref={mensajesRef} className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                    <Skeleton className="h-10 w-48 rounded-2xl" />
                  </div>
                ))
              ) : mensajes.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Sin mensajes aún
                </div>
              ) : (
                mensajes.map((msg, i) => (
                  <div key={msg.id ?? i} className={`flex ${esEnviado(msg) ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      esEnviado(msg)
                        ? "bg-green-600 text-white"
                        : "bg-muted text-foreground"
                    } ${msg.estado_entrega === "fallido" ? "opacity-50" : ""}`}>
                      {msg.archivo_url ? (
                        <div className="space-y-1">
                          {msg.archivo_tipo?.startsWith("image") ? (
                            <a href={msg.archivo_url} target="_blank" rel="noopener noreferrer">
                              <Image className="size-4 inline mr-1" />
                              {msg.archivo_nombre ?? "Imagen"}
                            </a>
                          ) : (
                            <a href={msg.archivo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline">
                              {msg.archivo_tipo?.includes("pdf")
                                ? <FileText className="size-4" />
                                : <Download className="size-4" />
                              }
                              {msg.archivo_nombre ?? "Archivo"}
                            </a>
                          )}
                          {(msg.mensaje || msg.texto) && <p>{msg.mensaje ?? msg.texto}</p>}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.mensaje ?? msg.texto}</p>
                      )}
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        <span className={`text-[10px] ${esEnviado(msg) ? "text-green-100" : "text-muted-foreground"}`}>
                          {formatHora(msg.created_at)}
                        </span>
                        {esEnviado(msg) && (
                          msg.estado_entrega === "leido" ? <CheckCheck className="size-3 text-green-200" /> :
                          msg.estado_entrega === "entregado" ? <CheckCheck className="size-3 text-green-100" /> :
                          msg.estado_entrega === "enviando" ? null :
                          <Check className="size-3 text-green-100" />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Archivo seleccionado */}
            {archivoSeleccionado && (
              <div className="px-4 py-2 border-t bg-muted/50 flex items-center gap-2 text-sm">
                <Paperclip className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{archivoSeleccionado.name}</span>
                <Button variant="ghost" size="icon" className="size-6" onClick={() => setArchivoSeleccionado(null)}>
                  <X className="size-3" />
                </Button>
              </div>
            )}

            {/* Input de mensaje */}
            <div className="border-t p-3 flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => fileInputRef.current?.click()}
                title="Adjuntar archivo"
              >
                <Paperclip className="size-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={ACCEPT_ARCHIVOS}
                onChange={e => seleccionarArchivo(e.target.files?.[0] ?? null)}
              />
              <Textarea
                className="flex-1 resize-none text-sm"
                placeholder="Escribí un mensaje..."
                value={nuevoMensaje}
                rows={1}
                onChange={e => setNuevoMensaje(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    enviarMensaje()
                  }
                }}
              />
              <Button
                className="bg-green-600 hover:bg-green-700 shrink-0 h-9"
                disabled={(!nuevoMensaje.trim() && !archivoSeleccionado) || enviando}
                onClick={enviarMensaje}
              >
                <Send className="size-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
