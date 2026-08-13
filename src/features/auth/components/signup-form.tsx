import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Link } from "react-router-dom"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  return (
    <form className={cn("flex flex-col gap-6", className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Crear tu cuenta</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Completa los campos para crear tu cuenta
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="first-name">Nombre</FieldLabel>
            <Input
              id="first-name"
              name="firstName"
              type="text"
              placeholder="Tu nombre"
              required
              className="bg-background"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="last-name">Apellido</FieldLabel>
            <Input
              id="last-name"
              name="lastName"
              type="text"
              placeholder="Tu apellido"
              required
              className="bg-background"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="email">Correo</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="ejemplo@correo.com"
              required
              className="bg-background"
            />
          
          </Field>

          <Field>
            <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="Número de teléfono"
              className="bg-background"
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            required
            placeholder="Contraseña segura"
            className="bg-background"
          />
          <FieldDescription>
            Debe tener al menos 8 caracteres.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="confirm-password">Confirmar contraseña</FieldLabel>
          <Input
            id="confirm-password"
            name="passwordConfirmation"
            type="password"
            required
            placeholder="Repite tu contraseña"
            className="bg-background"
          />
          <FieldDescription>Por favor confirma tu contraseña.</FieldDescription>
        </Field>

        <Field>
          <Button type="submit">Registrarse</Button>
        </Field>


        <Field>
          
          <FieldDescription className="px-6 text-center">
            ¿Ya tienes una cuenta? <Link to="/login">Iniciar sesión</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
