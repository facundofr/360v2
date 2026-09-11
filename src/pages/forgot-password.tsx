import { toast } from "sonner"
import axios from "axios"

import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form"
import { Compuerta } from "@/features/auth/components/Compuerta"
import { ENDPOINTS } from "@/lib/config"
import type { ForgotPasswordValues } from "@/features/auth/schemas"

export default function ForgotPasswordPage() {
  const handleSubmit = async ({ email }: ForgotPasswordValues) => {
    try {
      const { data } = await axios.post(`${ENDPOINTS.AUTH}/request-password-reset`, { email })
      toast.success(data.message ?? "Se envió un enlace de recuperación a tu email.")
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : undefined
      toast.error(msg ?? "Error al procesar la solicitud")
    }
  }

  return (
    <Compuerta>
      <ForgotPasswordForm onSubmit={handleSubmit} />
    </Compuerta>
  )
}
