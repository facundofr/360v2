import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Send, CheckCircle, Clock, Mail, Phone, X, Check, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { BadgeEstadoFirma } from "@/components/badges/BadgeEstadoFirma"
import { BotonDescargarPolizaFirmada } from "@/components/buttons/BotonDescargarPolizaFirmada"
import { useEnviarPolizaFirma } from "@/hooks/useEnviarPolizaFirma"

interface Poliza {
  id: number
  numero_poliza?: string
  numero_poliza_oficial?: string
  prospecto_nombre?: string
  prospecto_apellido?: string
  prospecto_email?: string
  prospecto_telefono?: string
  estado_firma?: "pending" | "signed" | "rejected" | "expired" | null
  fecha_envio_firma?: string
  fecha_firma?: string
}

interface BotonEnviarFirmaProps {
  poliza: Poliza
  onExito?: () => void
  userRole?: "vendedor" | "supervisor" | "backoffice" | null
  disabled?: boolean
}

const validarEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const validarTelefono = (v: string) => v.replace(/\D/g, "").length >= 10

export function BotonEnviarFirma({ poliza, onExito, userRole, disabled = false }: BotonEnviarFirmaProps) {
  const [showModal, setShowModal] = useState(false)
  const [email, setEmail] = useState("")
  const [telefono, setTelefono] = useState("")
  const [validacionError, setValidacionError] = useState("")
  const { enviarAFirma, loading } = useEnviarPolizaFirma()

  // Sincronizar datos del prospecto cada vez que se abre el modal
  useEffect(() => {
    if (showModal && poliza) {
      setEmail(poliza.prospecto_email ?? "")
      setTelefono(poliza.prospecto_telefono ?? "")
      setValidacionError("")
    }
  }, [showModal, poliza])

  const fueEnviada = !!(poliza?.fecha_envio_firma || poliza?.estado_firma === "pending" || poliza?.estado_firma === "signed")
  const estaFirmada = poliza?.estado_firma === "signed" || !!poliza?.fecha_firma

  const puedeEnviarFirma = (userRole === "supervisor" || userRole === "backoffice") && !fueEnviada && !disabled

  const handleEnviar = async () => {
    setValidacionError("")

    if (!email.trim()) { setValidacionError("El email del prospecto es requerido"); return }
    if (!validarEmail(email)) { setValidacionError("El email no es válido"); return }
    if (!telefono.trim()) { setValidacionError("El teléfono del prospecto es requerido"); return }
    if (!validarTelefono(telefono)) { setValidacionError("El teléfono debe tener al menos 10 dígitos"); return }

    // Limpiar el "+" al inicio igual que el frontend
    const telefonoLimpio = telefono.replace(/^\+/, "").trim()

    const resultado = await enviarAFirma({ id: poliza.id, pdf_hash: undefined }, email, telefonoLimpio)
    if (resultado?.success) {
      toast.success("Póliza enviada a firma exitosamente")
      setShowModal(false)
      onExito?.()
    } else {
      toast.error(resultado?.error ?? "Error al enviar a firma")
    }
  }

  // Para vendedor: solo mostrar badge de estado
  if (userRole === "vendedor") {
    if (estaFirmada) return <BadgeEstadoFirma estado="signed" />
    if (fueEnviada) return <BadgeEstadoFirma estado="pending" />
    return null
  }

  // Para supervisor/backoffice: botón de acción
  if (!poliza?.id) return null

  return (
    <>
      {estaFirmada ? (
        <div className="flex items-center gap-1.5">
          <BadgeEstadoFirma estado="signed" />
          <BotonDescargarPolizaFirmada polizaId={poliza.id} showLabel={false} />
        </div>
      ) : fueEnviada ? (
        <div className="flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400">
          <Clock className="size-3.5" />
          <span>Pendiente de firma</span>
        </div>
      ) : puedeEnviarFirma ? (
        <Button size="icon" variant="outline" className="size-7" title="Enviar a Firma" onClick={() => setShowModal(true)} disabled={disabled || loading}>
          <Send className="size-3.5" aria-hidden="true" />
        </Button>
      ) : null}

      <Dialog open={showModal} onOpenChange={v => { if (!loading) setShowModal(v) }}>
        <DialogContent className="sm:max-w-xl lg:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="size-5 text-blue-500" />
              Confirmar Datos del Prospecto
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Info de la póliza */}
            <div className="rounded-lg bg-muted/60 p-3 grid grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Prospecto</p>
                <p className="font-semibold text-sm">
                  {[poliza.prospecto_nombre, poliza.prospecto_apellido].filter(Boolean).join(" ") || "Sin nombre"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Póliza N°</p>
                <p className="font-semibold text-sm">{poliza.numero_poliza_oficial ?? poliza.numero_poliza ?? "—"}</p>
              </div>
            </div>

            {/* Error de validación */}
            {validacionError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <X className="size-3.5 shrink-0" />
                {validacionError}
              </div>
            )}

            {/* Encabezado sección */}
            <div className="flex items-center gap-2 text-sm font-medium">
              <Mail className="size-4 text-primary" />
              Por favor confirmá los datos de contacto:
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide flex items-center gap-1.5">
                <Mail className="size-3.5 text-primary" />
                Email del Prospecto
              </Label>
              <Input
                type="email"
                placeholder="email@ejemplo.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setValidacionError("") }}
                disabled={loading}
                className={validacionError && !validarEmail(email) ? "border-destructive" : ""}
              />
              <p className="text-xs text-muted-foreground">Este email recibirá el enlace para firmar la póliza</p>
            </div>

            {/* Teléfono */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide flex items-center gap-1.5">
                <Phone className="size-3.5 text-green-600" />
                Teléfono del Prospecto
              </Label>
              <Input
                type="tel"
                placeholder="+54 9 11 ..."
                value={telefono}
                onChange={e => { setTelefono(e.target.value); setValidacionError("") }}
                disabled={loading}
                className={validacionError && !validarTelefono(telefono) ? "border-destructive" : ""}
              />
              <p className="text-xs text-muted-foreground">Requerido para validación de identidad (al menos 10 dígitos)</p>
            </div>

            {/* Sección importante */}
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 px-4 py-3 text-sm">
              <p className="font-semibold flex items-center gap-1.5 mb-2">
                <AlertTriangle className="size-4 text-amber-600" />
                Importante:
              </p>
              <ul className="space-y-1 text-muted-foreground text-xs list-none pl-0">
                <li>• Se solicitará validación facial (foto del rostro)</li>
                <li>• Se requiere un documento de identidad</li>
                <li>• El prospecto recibirá instrucciones claras por email</li>
                <li>• El proceso es seguro y rápido (~5 minutos)</li>
              </ul>
            </div>

            {/* Botones */}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowModal(false)} disabled={loading}>
                <X className="size-3.5 mr-1.5" />
                Cancelar
              </Button>
              <Button onClick={handleEnviar} disabled={loading}>
                {loading ? (
                  "Enviando..."
                ) : (
                  <>
                    <Check className="size-3.5 mr-1.5" />
                    Enviar a Firma
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
