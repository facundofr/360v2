import * as React from "react"
import { toast } from "sonner"
import axios from "axios"

import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form"
import ThemeToggle from "@/components/common/theme-toggle"
import Logo from "@/components/ui/logo"
import { ENDPOINTS } from "@/lib/config"

export default function ForgotPasswordPage() {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const email = (e.currentTarget.elements.namedItem("email") as HTMLInputElement)?.value ?? ""
    try {
      const { data } = await axios.post(`${ENDPOINTS.AUTH}/request-password-reset`, { email })
      toast.success(data.message ?? "Se envió un enlace de recuperación a tu email.")
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : undefined
      toast.error(msg ?? "Error al procesar la solicitud")
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
            <ForgotPasswordForm onSubmit={handleSubmit} />
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
