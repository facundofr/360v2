import { useState } from "react"
import { useParams, useSearchParams, Link } from "react-router-dom"
import axios from "axios"
import { toast } from "sonner"
import { AlertTriangle, MailCheck, MailWarning, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Compuerta } from "@/features/auth/components/Compuerta"
import { ENDPOINTS } from "@/lib/config"

export default function VerifyEmailPage() {
  // El mail real (`emailService.js`) arma el link como /verify-email/:token
  // (path param, ruta registrada en routes.tsx) — leerlo de la query string
  // dejaba el token siempre vacío y la verificación fallaba para todo el mundo.
  const { token: tokenParam } = useParams<{ token?: string }>()
  const [searchParams] = useSearchParams()
  const token = tokenParam ?? searchParams.get("token") ?? ""
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")

  const handleVerification = async () => {
    setStatus("loading")
    try {
      const { data } = await axios.get(`${ENDPOINTS.AUTH}/verify/${token}`)
      setStatus("success")
      setMessage(data.message ?? "Tu cuenta ha sido verificada correctamente.")
      toast.success("¡Verificación exitosa!")
      setTimeout(() => (window.location.href = "/login"), 3000)
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message
        : undefined
      setStatus("error")
      setMessage(msg ?? "No se pudo verificar tu cuenta. El enlace podría haber expirado.")
      toast.error(msg ?? "Error de verificación")
    }
  }

  /* El ícono es el estado. Antes el estado se decía pintando toda la cabecera
     de la tarjeta —verde, rojo o violeta— con el texto en blanco encima: un
     plano de color del tamaño de un tercio de la pantalla para comunicar una
     palabra, y además gastaba el violeta, que en esta app significa ACCIÓN. */
  const Icono = status === "loading" ? Loader2 : status === "error" ? MailWarning : MailCheck

  return (
    <Compuerta
      icono={Icono}
      titulo="Verificación de email"
      descripcion={
        status === "idle" ? "Confirmá tu cuenta para poder entrar."
          : status === "loading" ? "Verificando…"
          : status === "success" ? message
          : undefined
      }
    >
      {status === "idle" && (
        <Button className="h-9 w-full" onClick={handleVerification}>
          Verificar cuenta
        </Button>
      )}

      {status === "loading" && (
        <p className="flex items-center justify-center gap-2 text-[12.5px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Procesando verificación…
        </p>
      )}

      {status === "success" && (
        <p className="text-center text-[12px] text-muted-foreground">
          Te llevamos al{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            inicio de sesión
          </Link>{" "}
          en unos segundos.
        </p>
      )}

      {status === "error" && (
        <div className="grid gap-3.5">
          <Alert variant="destructive">
            <AlertTriangle aria-hidden="true" />
            <AlertDescription>
              <b>{message}</b>
              Los enlaces de verificación caducan. Pedí uno nuevo desde el registro.
            </AlertDescription>
          </Alert>
          <Button variant="outline" className="h-9 w-full" asChild>
            <Link to="/signup">Ir al registro</Link>
          </Button>
        </div>
      )}
    </Compuerta>
  )
}
