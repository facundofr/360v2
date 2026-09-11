import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link } from "react-router-dom"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/features/auth/schemas"

export function ForgotPasswordForm({
  className,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  onSubmit: (values: ForgotPasswordValues) => void
}) {
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  return (
    <Form {...form}>
      <form
        className={cn("flex flex-col gap-6", className)}
        onSubmit={form.handleSubmit(onSubmit)}
        {...props}
      >
        <FieldGroup>
          <div className="flex flex-col items-center gap-1.5 text-center">
            {/* Sin `whitespace-nowrap`: a 336px de panel, este título en una
                sola línea se sale del papel. */}
            <h1 className="text-[21px] font-bold tracking-[-0.025em]">¿Olvidaste tu contraseña?</h1>
            <p className="text-[12.5px] text-balance text-muted-foreground">
              Ingresá tu correo electrónico y te enviamos un enlace para restablecer la contraseña.
            </p>
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correo electrónico</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="m@example.com" className="bg-background" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="h-9 w-full">Enviar enlace</Button>

          <p className="text-center text-[12px] text-muted-foreground">
            ¿Recordaste tu contraseña?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </FieldGroup>
      </form>
    </Form>
  )
}

export default ForgotPasswordForm
