import { cn } from "@/lib/utils"

/**
 * Versión de la app, inyectada desde `package.json` por vite (`__APP_VERSION__`).
 * Producción la muestra en el NavBar; acá va en el pie de cada sidebar.
 */
export function AppVersion({ className }: { className?: string }) {
  const version = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev"
  return (
    <span className={cn("text-[10.5px] text-muted-foreground", className)}>
      v{version}
    </span>
  )
}

export default AppVersion
