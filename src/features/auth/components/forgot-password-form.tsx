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

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  return (
    <form className={cn("flex flex-col gap-6", className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold whitespace-nowrap">¿Olvidaste tu contraseña?</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            required
            className="bg-background"
          />
        </Field>
        <Field>
          <Button type="submit">Enviar</Button>
        </Field>
        <FieldDescription className="text-center">
          ¿Recordaste tu contraseña? {" "}
          <Link to="/login" className="underline underline-offset-4">
            Iniciar sesión
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  )
}

export default ForgotPasswordForm
