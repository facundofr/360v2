import { useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import axios from "axios"
import { toast } from "sonner"
import { Eye, EyeOff, Check, X, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pista } from "@/components/common/Medidor"
import { Compuerta } from "@/features/auth/components/Compuerta"
import { ENDPOINTS } from "@/lib/config"

function getPasswordRequirements(password: string) {
  return {
    length: password.length >= 8 && password.length <= 128,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  }
}

type Tono = "muted" | "ok" | "warn" | "risk"

/** Devuelve el tono del sistema, no una clase de fondo suelta. */
function getStrength(password: string): { level: number; text: string; tono: Tono } {
  const met = Object.values(getPasswordRequirements(password)).filter(Boolean).length
  if (met === 0) return { level: 0, text: "", tono: "muted" }
  if (met <= 2) return { level: 1, text: "Débil", tono: "risk" }
  if (met <= 3) return { level: 2, text: "Regular", tono: "warn" }
  if (met <= 4) return { level: 3, text: "Buena", tono: "ok" }
  return { level: 4, text: "Muy fuerte", tono: "ok" }
}

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ password: "", confirmPassword: "" })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const reqs = getPasswordRequirements(formData.password)
  const strength = getStrength(formData.password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.password !== formData.confirmPassword) {
      toast.error("Las contraseñas no coinciden")
      return
    }
    if (!Object.values(reqs).every(Boolean)) {
      toast.error("La contraseña no cumple todos los requisitos")
      return
    }
    setLoading(true)
    try {
      await axios.post(`${ENDPOINTS.AUTH}/reset-password/${token}`, {
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      })
      toast.success("Contraseña actualizada correctamente")
      setTimeout(() => navigate("/login"), 2000)
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message
        : undefined
      toast.error(msg ?? "Error al restablecer la contraseña")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Compuerta icono={Lock} titulo="Nueva contraseña" descripcion="Elegí una contraseña y confirmala.">
      <form onSubmit={handleSubmit} className="grid gap-3.5">
        <div className="grid gap-1.5">
          <Label htmlFor="password">Nueva contraseña</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {formData.password && (
          <div className="grid gap-2">
            {/* La pista del sistema: se anima con `transform: scaleX`, no con
                `width`, que fuerza relayout en cada tecla. */}
            <Pista porcentaje={(strength.level / 4) * 100} tono={strength.tono} />
            {strength.text && (
              <p className="text-[11.5px] text-muted-foreground">
                Fortaleza: <b className="font-semibold text-foreground">{strength.text}</b>
              </p>
            )}
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px]">
              {[
                { met: reqs.length, text: "8-128 caracteres" },
                { met: reqs.lowercase, text: "Minúscula" },
                { met: reqs.uppercase, text: "Mayúscula" },
                { met: reqs.number, text: "Número" },
                { met: reqs.special, text: "Carácter especial" },
              ].map(({ met, text }) => (
                <li key={text} className="flex items-center gap-1">
                  {met
                    ? <Check className="size-3 shrink-0 text-state-ok-text" aria-hidden="true" />
                    : <X className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />}
                  <span className={met ? "text-state-ok-text" : "text-muted-foreground"}>{text}</span>
                  <span className="sr-only">{met ? " (cumple)" : " (falta)"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="pr-10"
              aria-invalid={!!formData.confirmPassword && formData.password !== formData.confirmPassword}
              aria-describedby="err-confirm"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {formData.confirmPassword && formData.password !== formData.confirmPassword && (
            <p id="err-confirm" className="text-[11.5px] font-semibold text-destructive">
              Las contraseñas no coinciden
            </p>
          )}
        </div>

        <Button type="submit" className="h-9 w-full" disabled={loading}>
          {loading ? "Actualizando…" : "Actualizar contraseña"}
        </Button>

        <p className="text-center text-[12px] text-muted-foreground">
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Volver al inicio de sesión
          </Link>
        </p>
      </form>
    </Compuerta>
  )
}