import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Link } from "react-router-dom"

type LoginErrors = {
  email?: string
  password?: string
  general?: string
}

export function LoginForm({
  className,
  submitting = false,
  errors = {},
  ...props
}: React.ComponentProps<"form"> & { submitting?: boolean; errors?: LoginErrors }) {
  return (
    <form className={cn("flex flex-col gap-6", className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Iniciar Sesión</h1>
        </div>

        {errors.general && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errors.general}
          </div>
        )}
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="m@example.com"
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <FieldDescription className="text-destructive">{errors.email}</FieldDescription>
          )}
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Contraseña</FieldLabel>
            <Link
              to="/forgot-password"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Ingresa tu contraseña"
            aria-invalid={!!errors.password}
          />
          {errors.password && (
            <FieldDescription className="text-destructive">{errors.password}</FieldDescription>
          )}
        </Field>
        <Field>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin mr-1" />
                Iniciando...
              </>
            ) : (
              "Iniciar Sesión"
            )}
          </Button>
        </Field>
        <Field>
          <FieldDescription className="text-center">
            ¿No tienes una cuenta?{" "}
            <Link to="/signup" className="underline underline-offset-4">
              Crear Cuenta
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
