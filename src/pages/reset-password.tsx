import { useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import axios from "axios"
import { toast } from "sonner"
import { Eye, EyeOff, Check, X, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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

function getStrength(password: string): { level: number; text: string; color: string } {
  const met = Object.values(getPasswordRequirements(password)).filter(Boolean).length
  if (met === 0) return { level: 0, text: "", color: "" }
  if (met <= 2) return { level: 1, text: "Débil", color: "bg-state-risk" }
  if (met <= 3) return { level: 2, text: "Regular", color: "bg-state-warn" }
  if (met <= 4) return { level: 3, text: "Buena", color: "bg-state-ok" }
  return { level: 4, text: "Muy fuerte", color: "bg-state-ok" }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="bg-primary text-primary-foreground rounded-t-lg text-center space-y-2 p-6">
          <div className="flex justify-center">
            <Lock className="size-10 opacity-90" />
          </div>
          <CardTitle className="text-xl">Nueva Contraseña</CardTitle>
          <CardDescription className="text-primary-foreground/80">
            Ingresa y confirma tu nueva contraseña
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="password">Nueva contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {formData.password && (
              <div className="space-y-2 text-sm">
                {/* Barra de fortaleza */}
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${strength.color}`}
                    style={{ width: `${(strength.level / 4) * 100}%` }}
                  />
                </div>
                {strength.text && (
                  <p className="text-muted-foreground text-xs">Fortaleza: <strong>{strength.text}</strong></p>
                )}
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { met: reqs.length, text: "8-128 caracteres" },
                    { met: reqs.lowercase, text: "Minúscula" },
                    { met: reqs.uppercase, text: "Mayúscula" },
                    { met: reqs.number, text: "Número" },
                    { met: reqs.special, text: "Carácter especial" },
                  ].map(({ met, text }) => (
                    <div key={text} className="flex items-center gap-1">
                      {met ? (
                        <Check className="size-3 text-state-ok-text" />
                      ) : (
                        <X className="size-3 text-muted-foreground" />
                      )}
                      <span className={met ? "text-state-ok-text" : "text-muted-foreground"}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-destructive text-xs">Las contraseñas no coinciden</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Actualizando..." : "Actualizar contraseña"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <Link to="/login" className="text-primary hover:underline">
                Volver al inicio de sesión
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
