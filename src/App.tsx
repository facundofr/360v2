import { useLocation } from "react-router-dom"
import AppRoutes from "@/app/routes"
import { SessionManager } from "@/components/common/SessionManager"
import NotificationsInitializer from "@/components/common/NotificationsInitializer"
import { ManualWidget } from "@/components/common/ManualWidget"
import PWAStatus from "@/components/common/PWAStatus"

const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset", "/verify-email", "/unauthorized"]

export function App() {
  const location = useLocation()
  const isAuthPage = AUTH_ROUTES.some(r => location.pathname.startsWith(r))

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-gradient-to-r from-red-500 via-orange-400 via-yellow-400 via-green-400 via-teal-400 via-blue-500 to-purple-600" />
      <AppRoutes />
      {/* Indicador de estado PWA (online/offline, instalación), igual que App.jsx */}
      <PWAStatus />
      <SessionManager />
      <NotificationsInitializer />
      {!isAuthPage && <ManualWidget />}
    </>
  )
}

export default App
