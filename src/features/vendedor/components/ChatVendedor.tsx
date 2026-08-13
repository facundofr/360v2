import { useState, useEffect, useRef } from "react"
import axios from "axios"
import { toast } from "sonner"
import { Bot, X, Send, History, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface Conversacion {
  id: number
  titulo?: string
  created_at?: string
  ultimo_mensaje?: string
}

export function ChatVendedor() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [conversacionId, setConversacionId] = useState<number | null>(null)
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [showHistorial, setShowHistorial] = useState(false)
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const authHeaders = { Authorization: `Bearer ${getAuthToken()}` }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    if (open) scrollToBottom()
  }, [messages, open])

  const fetchConversaciones = async () => {
    setLoadingHistorial(true)
    try {
      const { data } = await axios.get(`${API_URL}/chatbot-vendedor/conversaciones`, { headers: authHeaders })
      setConversaciones(data ?? [])
    } catch {
      toast.error("Error al cargar historial")
    } finally {
      setLoadingHistorial(false)
    }
  }

  const loadConversacion = async (id: number) => {
    try {
      const { data } = await axios.get(`${API_URL}/chatbot-vendedor/conversacion/${id}`, { headers: authHeaders })
      setMessages((data.mensajes ?? data) as Message[])
      setConversacionId(id)
      setShowHistorial(false)
    } catch {
      toast.error("Error al cargar conversación")
    }
  }

  const handleSend = async () => {
    const texto = input.trim()
    if (!texto || loading) return

    const userMsg: Message = { role: "user", content: texto }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const { data } = await axios.post(
        `${API_URL}/chatbot-vendedor/mensaje`,
        { mensaje: texto, conversacionId },
        { headers: authHeaders }
      )
      setConversacionId(data.conversacionId ?? conversacionId)
      const assistantMsg: Message = { role: "assistant", content: data.mensaje ?? data.respuesta ?? "..." }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error al procesar tu consulta. Intentá de nuevo." }])
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = () => {
    setOpen(true)
    if (messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: "¡Hola! Soy tu asistente de ventas. Puedo ayudarte con consultas sobre precios, planes, prestadores y promociones. ¿En qué te puedo ayudar?",
      }])
    }
  }

  const sugerencias = [
    "Ver planes disponibles",
    "Consultar prestadores",
    "¿Qué promociones hay?",
    "Comparar planes de salud",
  ]

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={handleOpen}
        className="fixed bottom-20 right-4 z-50 bg-muted text-foreground border hover:bg-accent rounded-full p-3 shadow-lg transition-all hover:scale-105"
        title="Asistente de ventas"
      >
        <Bot className="size-5" />
      </button>

      {/* Ventana de chat */}
      {open && (
        <div className="fixed bottom-36 right-4 z-50 w-80 sm:w-96 rounded-2xl border bg-background shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: "min(480px, calc(100vh - 160px))" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-purple-600 text-white">
            <div className="flex items-center gap-2">
              <Bot className="size-5" />
              <div>
                <p className="text-sm font-semibold">Asistente COBER</p>
                <p className="text-xs opacity-80">IA de ventas</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-white hover:bg-white/20"
                onClick={() => {
                  setShowHistorial(!showHistorial)
                  if (!showHistorial) fetchConversaciones()
                }}
                title="Historial"
              >
                <History className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-white hover:bg-white/20"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Historial de conversaciones */}
          {showHistorial && (
            <div className="absolute inset-0 top-11 bg-background z-10 flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 border-b">
                <p className="text-sm font-semibold">Conversaciones recientes</p>
                <Button variant="ghost" size="sm" onClick={() => setShowHistorial(false)}>
                  <X className="size-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {loadingHistorial ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)
                ) : conversaciones.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Sin conversaciones previas</p>
                ) : (
                  conversaciones.map(conv => (
                    <button
                      key={conv.id}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm"
                      onClick={() => loadConversacion(conv.id)}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate">{conv.titulo ?? `Conversación #${conv.id}`}</p>
                        <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                      </div>
                      {conv.ultimo_mensaje && (
                        <p className="text-xs text-muted-foreground truncate">{conv.ultimo_mensaje}</p>
                      )}
                    </button>
                  ))
                )}
              </div>
              <div className="p-2 border-t">
                <Button
                  className="w-full"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMessages([{
                      role: "assistant",
                      content: "¡Nueva conversación iniciada! ¿En qué te puedo ayudar?",
                    }])
                    setConversacionId(null)
                    setShowHistorial(false)
                  }}
                >
                  Nueva conversación
                </Button>
              </div>
            </div>
          )}

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`rounded-2xl px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-purple-600 text-white"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-3 py-2">
                  <div className="flex gap-1 items-center h-4">
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                    <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Sugerencias */}
          {messages.length <= 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1">
              {sugerencias.map(s => (
                <Badge
                  key={s}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs"
                  onClick={() => { setInput(s); }}
                >
                  {s}
                </Badge>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t p-2 flex gap-2">
            <Input
              className="flex-1 text-sm"
              placeholder="Escribí tu consulta..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            />
            <Button size="icon" onClick={handleSend} disabled={!input.trim() || loading}
              className="bg-purple-600 hover:bg-purple-700 shrink-0">
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
