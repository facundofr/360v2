import * as React from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import axios from "axios"

import { LoginForm } from "@/features/auth/components/login-form"
import ThemeToggle from "@/components/common/theme-toggle"
import Logo from "@/components/ui/logo"
import { useAuth, type Role } from "@/contexts/AuthContext"
import type { LoginValues } from "@/features/auth/schemas"

const ROLE_REDIRECT: Record<Role, string> = {
  vendedor:   "/vendedor/prospectos",
  supervisor: "/supervisor/dashboard",
  admin:      "/admin/dashboard",
  backoffice: "/backoffice/dashboard",
}

type FieldErrors = {
  email?: string
  password?: string
  general?: string
}

function mapApiError(err: unknown): FieldErrors {
  if (!axios.isAxiosError(err)) return { general: "Ocurrió un error inesperado. Intenta nuevamente." }
  const status = err.response?.status
  const msg: string | undefined = err.response?.data?.message
  if (status === 401 || status === 400) {
    return { general: msg ?? "Email o contraseña incorrectos." }
  }
  if (status === 403) {
    return { general: msg ?? "Tu cuenta no está habilitada. Revisá tu correo o contactá soporte." }
  }
  if (status === 404) {
    return { email: "No existe una cuenta con ese email." }
  }
  if (status === 429) {
    return { general: "Demasiados intentos. Esperá unos minutos antes de volver a intentar." }
  }
  if (!err.response) {
    return { general: "No se pudo conectar al servidor. Verificá tu conexión a internet." }
  }
  return { general: msg ?? "No se pudo iniciar sesión. Intenta nuevamente." }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, loading, user } = useAuth()
  const [errors, setErrors] = React.useState<FieldErrors>({})

  // Si ya está autenticado, redirigir a su dashboard
  React.useEffect(() => {
    if (user) {
      navigate(ROLE_REDIRECT[user.role], { replace: true })
    }
  }, [user, navigate])

  const handleSubmit = async ({ email, password }: LoginValues) => {
    setErrors({})
    try {
      const user = await login(email, password)
      toast.success(`¡Bienvenido, ${user.name}!`)
      navigate(ROLE_REDIRECT[user.role])
    } catch (err: unknown) {
      const apiErrors = mapApiError(err)
      setErrors(apiErrors)
    }
  }

  return (
    <div className="flex min-h-svh flex-col">
      {/* El cambio de tema queda fuera del camino del formulario */}
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      {/*
        Login centrado en una sola columna.
        El `pb-16` sube un poco el bloque respecto del centro exacto: el centro
        óptico queda por encima del geométrico y así no se ve "caído".
      */}
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <Logo className="mx-auto h-16" />
          <LoginForm onSubmit={handleSubmit} submitting={loading} errors={errors} />
        </div>
      </main>
    </div>
  )
}
