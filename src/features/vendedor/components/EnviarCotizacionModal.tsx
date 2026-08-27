import { useState, useEffect, startTransition } from "react"
import { MessageCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { maskPhone } from "@/lib/mask"

interface Cotizacion {
  id?: number
  plan_nombre?: string
  tipo_afiliacion_nombre?: string
  total_bruto?: number
  total_descuento_aporte?: number
  total_descuento_promocion?: number
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
        // `enviando` nunca se resetea después de un envío (no hay ningún
        // `setEnviando(false)` en todo el archivo) — sin esto, Cancelar y
        // Enviar quedan deshabilitados para siempre en el resto de la sesión.
        setEnviando(false)
      }
      if (!open) {
        setTelefonoReal("")
        setTelefonoMostrado("")
        setTelefonoEditado("")
        setModoEdicion(false)
        setMensaje(null)
        setEnviando(false)
      }
    })
  }, [open, prospecto])

  const getNumeroEnvio = () =>
    modoEdicion && telefonoEditado.trim() !== "" ? telefonoEditado.trim() : telefonoReal

  // Réplica de la implementación VIGENTE de prod
  // (`EnviarCotizacionModal.jsx:89-135`): abre un deep-link `wa.me` con la
  // cotización precargada, sin backend. El POST a `/prospectos/enviar-whatsapp`
  // que llamaba esta función antes es la versión anterior (vía Twilio) que
  // prod dejó comentada como "Reemplazada por el envío directo a wa.me".
  function numeroWhatsApp(telefono: string): string {
    let limpio = telefono.replace(/\D/g, "")
    if (limpio.startsWith("00")) limpio = limpio.slice(2)
    if (limpio.startsWith("0")) limpio = limpio.slice(1)
    if (limpio.startsWith("54")) return limpio.startsWith("549") ? limpio : `549${limpio.slice(2)}`
    return `549${limpio}`
  }

  const handleEnviar = () => {
    const numeroIngresado = getNumeroEnvio().trim()
    if (!numeroIngresado) {
      setMensaje({ texto: "Por favor ingresá un número de teléfono", tipo: "error" })
      return
    }
    const numero = numeroWhatsApp(numeroIngresado)
    if (numero.length < 12 || numero.length > 15) {
      setMensaje({ texto: "El número de WhatsApp ingresado no es válido", tipo: "error" })
      return
    }

    const nombreCliente = `${prospecto?.nombre ?? ""} ${prospecto?.apellido ?? ""}`.trim() || "Cliente"
    const grupoFamiliar = cotizacion?.detalles?.length
      ? cotizacion.detalles.map(d => d.vinculo).join(", ")
      : "Individual"

    const mensajeWhatsapp = `COBER - Cotización de Plan

Hola ${nombreCliente}, te compartimos los detalles de tu cotización:

Plan: ${cotizacion?.plan_nombre ?? "Plan seleccionado"}
Grupo Familiar: ${grupoFamiliar}
Tipo de Afiliación: ${cotizacion?.tipo_afiliacion_nombre ?? "Particular"}

Detalle de precios:
* Total Bruto: ${formatCurrency(cotizacion?.total_bruto)}
* Descuento Aporte: ${formatCurrency(cotizacion?.total_descuento_aporte)}
* Descuento Promoción: ${formatCurrency(cotizacion?.total_descuento_promocion)}

TOTAL FINAL: ${formatCurrency(cotizacion?.total_final)}

Para más información o para avanzar con la contratación, podés responder a este mensaje.`

    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensajeWhatsapp)}`, "_blank", "noopener,noreferrer")

    setEnviando(true)
    setMensaje({ texto: "Se abrió WhatsApp con la cotización precargada. Presioná Enviar en WhatsApp para completar el envío.", tipo: "success" })
    setTimeout(() => onClose(), 3000)
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
