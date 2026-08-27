import { useState, useRef, useEffect } from "react"
import axios from "axios"
import { HelpCircle, X, BookOpen, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { API_URL } from "@/lib/config"
import { getAuthHeaders, getStoredUserId } from "@/lib/auth"
import { useAuth } from "@/contexts/AuthContext"

interface Mensaje {
  rol: "user" | "assistant"
  texto: string
}

// Sugerencias rápidas por rol, igual que producción (`ManualWidget.jsx:195-210`).
// Prod sólo las define para supervisor y vendedor — admin/backoffice no
// muestran el bloque, así que acá tampoco.
const SUGERENCIAS_POR_ROL: Partial<Record<string, string[]>> = {
  supervisor: [
    "¿Cómo ver las métricas de un vendedor?",
    "¿Cómo reasignar prospectos?",
    "¿Cómo interpretar el dashboard?",
    "¿Cómo deshabilitar un vendedor?",
    "¿Qué significan los estados de póliza?",
  ],
  vendedor: [
    "¿Cómo crear un nuevo prospecto?",
    "¿Cómo funciona el panel de prospectos?",
    "¿Cómo enviar una cotización por WhatsApp?",
    "¿Cómo usar el módulo Mis Pólizas?",
    "¿Qué significan los estados de póliza?",
  ],
}

export function ManualWidget() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { rol: "assistant", texto: "¡Hola! Soy el asistente de COBER. ¿En qué puedo ayudarte?" },
  ])
  const [pregunta, setPregunta] = useState("")
  const [cargando, setCargando] = useState(false)
  const [conversacionId, setConversacionId] = useState<string | number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensajes, cargando])

  async function enviar(textoSugerido?: string) {
    const texto = (textoSugerido ?? pregunta).trim()
    if (!texto || cargando) return

    setMensajes((prev) => [...prev, { rol: "user", texto }])
    setPregunta("")
    setCargando(true)

    try {
      // El asistente se consulta SIEMPRE a través del backend, que actúa de proxy
      // y guarda la clave del servicio del lado del servidor. Nunca desde el navegador.
      const rol = user?.role ?? "vendedor"
      const { data } = await axios.post(
        `${API_URL}/chatbot/mensaje`,
        {
          mensaje: texto,
          conversacionId,
          usuarioId: getStoredUserId() ?? user?.id ?? 1,
          tipo: "manual_interactivo",
          rol,
          contexto: `Manual Cober360 - Rol: ${rol}. Responde de forma práctica y concisa.`,
        },
        { headers: getAuthHeaders(), timeout: 10000 }
      )

      const respuesta: string =
        data?.mensaje ?? data?.respuesta ?? "Lo siento, no pude procesar tu consulta."
      setMensajes((prev) => [...prev, { rol: "assistant", texto: respuesta }])

      if (data?.conversacionId && !conversacionId) setConversacionId(data.conversacionId)
    } catch {
      setMensajes((prev) => [
        ...prev,
        { rol: "assistant", texto: "Ocurrió un error al consultar el asistente. Intentá de nuevo." },
      ])
    } finally {
      setCargando(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") enviar()
  }

  function handleSugerenciaClick(sugerencia: string) {
    setPregunta(sugerencia)
    enviar(sugerencia)
  }

  const sugerencias = SUGERENCIAS_POR_ROL[user?.role ?? "vendedor"]

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <Card className="mb-3 w-80 shadow-xl flex flex-col" style={{ height: "420px" }}>
          <CardHeader className="pb-2 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="size-4" />Asistente COBER
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
                <X className="size-3" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col flex-1 overflow-hidden p-3 gap-2">
            {/* Lista de mensajes */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {mensajes.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.rol === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                      m.rol === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {m.texto}
                  </div>
                </div>
              ))}
              {cargando && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="size-3 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Sugerencias rápidas por rol */}
            {sugerencias && (
              <div className="shrink-0 space-y-1">
                <p className="text-[11px] text-muted-foreground">💡 Sugerencias rápidas:</p>
                <div className="flex flex-wrap gap-1">
                  {sugerencias.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={cargando}
                      onClick={() => handleSugerenciaClick(s)}
                      className="rounded-full border bg-muted px-2 py-1 text-[11px] leading-tight text-foreground hover:bg-accent disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="flex gap-2 shrink-0">
              <Input
                value={pregunta}
                onChange={(e) => setPregunta(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribí tu consulta..."
                className="text-xs h-8"
                disabled={cargando}
              />
              <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => enviar()} disabled={cargando || !pregunta.trim()}>
                <Send className="size-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Button
        size="icon"
        variant="outline"
        className="h-12 w-12 rounded-full shadow-lg"
        onClick={() => setOpen(!open)}
        aria-label="Asistente COBER"
      >
        {open ? <X className="size-5" /> : <HelpCircle className="size-5" />}
      </Button>
    </div>
  )
}
