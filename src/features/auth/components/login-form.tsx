import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Link } from "react-router-dom"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { loginSchema, type LoginValues } from "@/features/auth/schemas"

type LoginErrors = {
  email?: string
  password?: string
  general?: string
}

export function LoginForm({
  className,
  submitting = false,
  errors = {},
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  submitting?: boolean
  errors?: LoginErrors
  onSubmit: (values: LoginValues) => void
}) {
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  // Errores que vienen de la respuesta del backend (credenciales inválidas, cuenta
  // deshabilitada, etc.) se aplican a los campos del form igual que los de zod.
  useEffect(() => {
    if (errors.email) form.setError("email", { message: errors.email })
    if (errors.password) form.setError("password", { message: errors.password })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors.email, errors.password])

  return (
    <Form {...form}>
      <form
        className={cn("flex flex-col", className)}
        onSubmit={form.handleSubmit(onSubmit)}
        {...props}
      >
        {/* Headline del escalonado: 21px/700/−0.025em. Antes eran 24px, fuera
            de la escala tipográfica del sistema. */}
        <h1 className="mb-[22px] text-center text-[21px] font-bold tracking-[-0.025em]">
          Iniciar sesión
        </h1>

        {/* El error general es un aviso reglado, no un bloque rojo entero: la
            causa va en la línea guía y la salida, en tinta, se lee normal. */}
        {errors.general && (
          <Alert variant="destructive" className="mb-[18px]">
            <AlertTriangle aria-hidden="true" />
            <AlertDescription>
              <b>{errors.general}</b>
              Si el problema sigue, probá recuperar la contraseña o escribí a soporte.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3.5">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="username" placeholder="m@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                {/* La etiqueta y el enlace de recuperación comparten renglón y
                    se alinean por la línea de base, como en el mockup. */}
                <div className="flex items-baseline justify-between gap-3">
                  <FormLabel>Contraseña</FormLabel>
                  <Link
                    to="/forgot-password"
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <FormControl>
                  <Input type="password" autoComplete="current-password" placeholder="Ingresa tu contraseña" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="h-9 w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Iniciando…
              </>
            ) : (
              "Iniciar sesión"
            )}
          </Button>
        </div>

        <p className="mt-[22px] text-center text-[12px] text-muted-foreground">
          ¿No tenés una cuenta?{" "}
          <Link to="/signup" className="font-semibold text-primary hover:underline">
            Crear cuenta
          </Link>
        </p>
      </form>
    </Form>
  )
}
