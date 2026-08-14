import { useState, useEffect, startTransition } from "react"
import axios from "axios"
import { MessageCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Cotizacion {
  id?: number
  plan_nombre?: string
  total_final?: number
  detalles?: { vinculo?: string }[]
}

interface Prospecto {
  id?: number
  nombre?: string
  apellido?: string
  numero_contacto?: string
  telefono?: string
}

interface EnviarCotizacionModalProps {
  open: boolean
  onClose: () => void
  cotizacion: Cotizacion | null
  prospecto: Prospecto | null
}

function maskPhone(phone: string): string {
  if (!phone) return ""
  const cleaned = phone.replace(/\D/g, "")
  if (cleaned.length < 4) return phone
  return "*".repeat(Math.max(0, cleaned.length - 4)) + cleaned.slice(-4)
}

function formatCurrency(amount?: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(amount ?? 0)
}

export function EnviarCotizacionModal({ open, onClose, cotizacion, prospecto }: EnviarCotizacionModalProps) {
  const [telefonoReal, setTelefonoReal] = useState("")
  const [telefonoMostrado, setTelefonoMostrado] = useState("")
  const [telefonoEditado, setTelefonoEditado] = useState("")
  const [modoEdicion, setModoEdicion] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: "success" | "error" | "info" } | null>(null)

  useEffect(() => {
    startTransition(() => {
      if (open && prospecto) {
        const tel = prospecto.numero_contacto ?? prospecto.telefono ?? ""
        setTelefonoReal(tel)
        setTelefonoMostrado(maskPhone(tel))
        setTelefonoEditado("")
        setModoEdicion(false)
        setMensaje(null)
      }
      if (!open) {
        setTelefonoReal("")
        setTelefonoMostrado("")
        setTelefonoEditado("")
        setModoEdicion(false)
        setMensaje(null)
      }
    })
  }, [open, prospecto])

  const getNumeroEnvio = () =>
    modoEdicion && telefonoEditado.trim() !== "" ? telefonoEditado.trim() : telefonoReal

  const handleEnviar = async () => {
    const numero = getNumeroEnvio()
    if (!numero) {
      setMensaje({ texto: "Por favor ingresá un número de teléfono", tipo: "error" })
      return
    }
    setEnviando(true)
    setMensaje(null)
    try {
      await axios.post(
        `${API_URL}/prospectos/enviar-whatsapp`,
        { telefono: numero, cotizacion, prospecto },
        { headers: { Authorization: `Bearer ${getAuthToken()}` } }
      )
      setMensaje({ texto: "¡Cotización enviada por WhatsApp exitosamente! 📱", tipo: "success" })
      setTimeout(() => {
        setMensaje({ texto: "✅ Cotización enviada. Para continuar la conversación, usá la sección de WhatsApp.", tipo: "info" })
      }, 2000)
      setTimeout(() => {
        onClose()
      }, 6000)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } }
      setMensaje({
        texto: error.response?.data?.error ?? "Error al enviar. Intentá nuevamente.",
        tipo: "error",
      })
    } finally {
      setEnviando(false)
    }
  }

  const mensajeClasses = {
    success: "bg-state-ok-soft border-state-ok/30 text-state-ok-text",
    error: "bg-state-risk-soft border-state-risk/30 text-state-risk-text",
    info: "bg-muted text-muted-foreground",
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && !enviando && onClose()}>
      <DialogContent className="sm:max-w-lg lg:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-5 text-green-600" />Enviar Cotización por WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {cotizacion && (
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <p className="font-semibold mb-1">Resumen de la cotización:</p>
              <p><span className="text-muted-foreground">Plan:</span> <strong>{cotizacion.plan_nombre}</strong></p>
              <p>
                <span className="text-muted-foreground">Grupo familiar:</span>{" "}
                {cotizacion.detalles?.length
                  ? cotizacion.detalles.map(d => d.vinculo).join(", ")
                  : "Individual"}
              </p>
              <p>
                <span className="text-muted-foreground">Total:</span>{" "}
                <strong>{formatCurrency(cotizacion.total_final)}</strong>
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Número de WhatsApp</Label>
            {!modoEdicion ? (
              <div className="flex gap-2">
                <Input
                  value={telefonoMostrado}
                  readOnly
                  placeholder="Sin número registrado"
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={() => setModoEdicion(true)}>
                  Editar
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                <Input
                  value={telefonoEditado}
                  onChange={e => setTelefonoEditado(e.target.value)}
                  placeholder="Ej: 5491155550000"
                  autoFocus
                />
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                  onClick={() => setModoEdicion(false)}
                >
                  Usar número original
                </button>
              </div>
            )}
          </div>

          {mensaje && (
            <div className={`rounded-lg border p-3 text-sm ${mensajeClasses[mensaje.tipo]}`}>
              {mensaje.texto}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button onClick={handleEnviar} disabled={enviando} className="bg-green-600 hover:bg-green-700">
            <MessageCircle className="size-4 mr-2" />
            {enviando ? "Enviando..." : "Enviar por WhatsApp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
