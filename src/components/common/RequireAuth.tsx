import { Navigate, useLocation } from "react-router-dom"
import { useAuth, type Role } from "@/contexts/AuthContext"
import { usePreventBackNavigation } from "@/hooks/useNavigationProtection"

interface RequireAuthProps {
  children: React.ReactNode
  allowedRoles?: Role[]
}

export default function RequireAuth({ children, allowedRoles = [] }: RequireAuthProps) {
  const { user } = useAuth()
  const location = useLocation()

  // Prevenir que el usuario autenticado vuelva al login con el botón atrás
  usePreventBackNavigation(!!user)

  // No autenticado → redirigir a login guardando la ruta de origen
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Autenticado pero sin permiso para este rol.
  // Pasamos el detalle para que /unauthorized pueda mostrar rol, ruta y
  // roles requeridos, como hace `AccessDenied.jsx` en producción.
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <Navigate
        to="/unauthorized"
        replace
        state={{ rutaIntentada: location.pathname, rolesRequeridos: allowedRoles }}
      />
    )
  }

  return <>{children}</>
}
