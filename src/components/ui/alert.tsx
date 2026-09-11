import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * EL PADRÓN — el aviso.
 *
 * Una tira reglada, no un bloque de color. El filete y el fondo apenas teñido
 * la separan del papel; el color fuerte queda para el ícono y la línea guía
 * —el `<b>`—, mientras la explicación sigue en tinta y se lee normal. Un
 * párrafo entero en rojo se vuelve ruido y deja de señalar nada.
 *
 * El ícono es un hijo directo: `<Alert variant="destructive"><AlertTriangle />
 * <AlertDescription>…</AlertDescription></Alert>`. Dibujado, nunca un emoji.
 */
interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive"
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[12.5px]",
        "[&>svg]:mt-px [&>svg]:size-3.5 [&>svg]:shrink-0",
        "[&_b]:block [&_strong]:block",
        variant === "destructive"
          ? [
              "border-[color-mix(in_oklch,var(--destructive)_34%,var(--rule))]",
              "bg-[color-mix(in_oklch,var(--destructive)_7%,transparent)]",
              "text-foreground [&>svg]:text-destructive [&_b]:text-destructive [&_strong]:text-destructive",
            ]
          : "border-rule-firm bg-paper-sunk text-foreground [&>svg]:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
)
Alert.displayName = "Alert"

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("min-w-0 leading-[1.55]", className)} {...props} />
  )
)
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertDescription }
