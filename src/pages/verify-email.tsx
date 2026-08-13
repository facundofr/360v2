import { useState } from "react"
import { useSearchParams, Link } from "react-router-dom"
import axios from "axios"
import { toast } from "sonner"
import { MailCheck, MailWarning, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ENDPOINTS } from "@/lib/config"

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") ?? ""
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader
          className={`rounded-t-lg text-center space-y-2 p-6 text-white ${
            status === "success"
              ? "bg-green-600"
              : status === "error"
                ? "bg-destructive"
                : "bg-primary"
          }`}
        >
          <div className="flex justify-center">
            {status === "loading" ? (
              <Loader2 className="size-10 animate-spin opacity-90" />
            ) : status === "success" ? (
              <MailCheck className="size-10 opacity-90" />
            ) : status === "error" ? (
              <MailWarning className="size-10 opacity-90" />
            ) : (
              <MailCheck className="size-10 opacity-90" />
            )}
          </div>
          <CardTitle className="text-xl">Verificación de Email</CardTitle>
          <CardDescription className="text-white/80">
            {status === "idle" && "Haz clic en el botón para verificar tu cuenta"}
            {status === "loading" && "Verificando..."}
            {status === "success" && message}
            {status === "error" && message}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-4 text-center">
          {status === "idle" && (
            <Button onClick={handleVerification} className="w-full">
              Verificar cuenta
            </Button>
          )}

          {status === "loading" && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>Procesando verificación...</span>
            </div>
          )}

          {status === "success" && (
            <p className="text-sm text-muted-foreground">
              Serás redirigido automáticamente al{" "}
              <Link to="/login" className="text-primary hover:underline">
                inicio de sesión
              </Link>
              .
            </p>
          )}

          {status === "error" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                El enlace puede haber expirado. Solicita uno nuevo desde la pantalla de registro.
              </p>
              <Button variant="outline" asChild>
                <Link to="/signup">Ir al registro</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
