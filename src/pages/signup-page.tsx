import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import axios from "axios"

import { SignupForm } from "@/features/auth/components/signup-form"
import ThemeToggle from "@/components/common/theme-toggle"
import Logo from "@/components/ui/logo"
import { ENDPOINTS } from "@/lib/config"
import type { SignupValues } from "@/features/auth/schemas"

export default function SignupPage() {
  const navigate = useNavigate()

  const handleSubmit = async (values: SignupValues) => {
    const data = {
      first_name: values.firstName,
      last_name: values.lastName,
      email: values.email,
      phone_number: values.phone ?? "",
      password: values.password,
      password_confirmation: values.passwordConfirmation,
    }
    try {
      const res = await axios.post(`${ENDPOINTS.AUTH}/register`, data)
      const msg = (res.data as { message?: string })?.message
      toast.success(msg ?? "Cuenta creada. Revisá tu email para verificarla.")
      navigate("/verify-email")
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        const d = err.response?.data as Record<string, unknown> | undefined

        if (status === 429) {
          toast.error("Demasiados intentos de registro. Esperá unos minutos antes de volver a intentar.")
          return
        }

        // El backend puede mandar errores de validación en varios formatos
        const errores = (d?.errores ?? d?.errors ?? d?.details) as { message?: string; msg?: string; field?: string }[] | undefined
        if (Array.isArray(errores) && errores.length) {
          toast.error(errores.map(e => e.message ?? e.msg ?? "").filter(Boolean).join(" · "))
        } else {
          toast.error((d?.message as string) ?? "Error al crear la cuenta")
        }
      } else {
        toast.error("Error al crear la cuenta")
      }
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex w-full items-center justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <Logo className="h-16" />
          </a>
          <ThemeToggle className="ml-auto" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <SignupForm onSubmit={handleSubmit} />
          </div>
        </div>
      </div>
    <div className="relative hidden bg-muted lg:block">
        <img
          src={new URL('../assets/C3601.webp', import.meta.url).href}
          alt="Cober background"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.7] "
        />
      </div>
    </div>
  )
}
