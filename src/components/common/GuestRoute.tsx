import { Navigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"

export default function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  if (user) {
    const dashboardMap: Record<string, string> = {
      vendedor: "/vendedor/prospectos",
      supervisor: "/supervisor/dashboard",
      admin: "/admin/dashboard",
      backoffice: "/backoffice/dashboard",
    }
    return <Navigate to={dashboardMap[user.role] || "/login"} replace />
  }

  return <>{children}</>
}
