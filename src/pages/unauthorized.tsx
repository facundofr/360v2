import { useLocation, useNavigate } from "react-router-dom"
import { ShieldOffIcon, LayoutDashboard, ArrowLeft, LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
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
      <ShieldOffIcon className="size-14 text-primary opacity-70" />

      <div className="space-y-2 text-center">
        <h1 className="text-[21px] font-bold tracking-[-0.025em]">Acceso denegado</h1>
        <p className="max-w-[46ch] text-[12.5px] text-muted-foreground">
          No tenés permisos para ver esta sección. Contactá a un administrador si creés que es un error.
        </p>
      </div>

      {/* Detalle, igual que `AccessDenied.jsx` de producción: sin esto el
          usuario no sabe con qué rol entró ni qué ruta le fue negada. */}
      <dl className="w-full max-w-sm divide-y divide-rule border-y border-rule-firm text-[12.5px]">
        <div className="flex justify-between gap-3 py-2">
          <dt className="shrink-0 text-muted-foreground">Tu rol actual</dt>
          <dd className="font-semibold">{user ? ROLE_LABELS[user.role] : "Desconocido"}</dd>
        </div>
        <div className="flex justify-between gap-3 py-2">
          <dt className="shrink-0 text-muted-foreground">Ruta solicitada</dt>
          <dd className="text-right text-[11.5px] break-all">{rutaIntentada}</dd>
        </div>
        {rolesRequeridos.length > 0 && (
          <div className="flex justify-between gap-3 py-2">
            <dt className="shrink-0 text-muted-foreground">Requiere</dt>
            <dd className="text-right">
              {rolesRequeridos
                .map(r => ROLE_LABELS[r as keyof typeof ROLE_LABELS] ?? r)
                .join(", ")}
            </dd>
          </div>
        )}
      </dl>

      <div className="flex flex-wrap gap-3 justify-center">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4 mr-1" />Volver
        </Button>
        {user && (
          <Button onClick={() => navigate(getDashboardRoute())}>
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
