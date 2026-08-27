import { z } from "zod"

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "El email es obligatorio.")
    .email("Ingresá un email válido."),
  password: z
    .string()
    .min(1, "La contraseña es obligatoria.")
    .min(6, "La contraseña debe tener al menos 6 caracteres."),
})
export type LoginValues = z.infer<typeof loginSchema>

export const signupSchema = z
  .object({
    firstName: z.string().trim().min(1, "El nombre es obligatorio."),
    lastName: z.string().trim().min(1, "El apellido es obligatorio."),
    email: z
      .string()
      .trim()
      .min(1, "El email es obligatorio.")
      .email("Ingresá un email válido."),
    phone: z.string().trim().optional(),
    password: z.string().min(8, "Debe tener al menos 8 caracteres."),
    passwordConfirmation: z.string().min(1, "Confirmá tu contraseña."),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Las contraseñas no coinciden.",
    path: ["passwordConfirmation"],
  })
export type SignupValues = z.infer<typeof signupSchema>

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "El email es obligatorio.")
    .email("Ingresá un email válido."),
})
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
