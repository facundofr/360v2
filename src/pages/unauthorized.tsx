import { useLocation, useNavigate } from "react-router-dom"
import { ShieldOffIcon, LayoutDashboard, ArrowLeft, LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/contexts/AuthContext"
import { ROLE_LABELS } from "@/lib/auth"

interface LocationState {
  /** Roles que exigía la ruta, si `RequireAuth` los pasó. */
  rolesRequeridos?: string[]
  /** Ruta que el usuario intentó abrir. */
  rutaIntentada?: string
}

export default function UnauthorizedPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, getDashboardRoute } = useAuth()

  const state = (location.state ?? {}) as LocationState
  const rutaIntentada = state.rutaIntentada ?? "—"
  const rolesRequeridos = state.rolesRequeridos ?? []

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6">
      <ShieldOffIcon className="size-14 text-purple-400 opacity-70" />

      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Acceso denegado</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          No tenés permisos para ver esta sección. Contactá a un administrador si creés que es un error.
        </p>
      </div>

      {/* Detalle, igual que `AccessDenied.jsx` de producción: sin esto el
          usuario no sabe con qué rol entró ni qué ruta le fue negada. */}
      <Card className="w-full max-w-sm">
        <CardContent className="p-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Tu rol actual</span>
            <span className="font-medium">
              {user ? ROLE_LABELS[user.role] : "Desconocido"}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground shrink-0">Ruta solicitada</span>
            <code className="text-xs break-all text-right">{rutaIntentada}</code>
          </div>
          {rolesRequeridos.length > 0 && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground shrink-0">Requiere</span>
              <span className="text-right">
                {rolesRequeridos
                  .map(r => ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r)
                  .join(", ")}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3 justify-center">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4 mr-1" />Volver
        </Button>
        {user && (
          <Button
            className="bg-muted text-foreground border hover:bg-accent"
            onClick={() => navigate(getDashboardRoute())}
          >
            <LayoutDashboard className="size-4 mr-1" />Ir a mi dashboard
          </Button>
        )}
        <Button variant="ghost" onClick={() => { logout(); navigate("/login") }}>
          <LogOut className="size-4 mr-1" />Cerrar sesión
        </Button>
      </div>
    </div>
  )
}
