import { lazy, Suspense } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import LoginPage from "@/pages/login-page"
import SignupPage from "@/pages/signup-page"
import ForgotPasswordPage from "@/pages/forgot-password"
import UnauthorizedPage from "@/pages/unauthorized"
import ResetPasswordPage from "@/pages/reset-password"
import VerifyEmailPage from "@/pages/verify-email"
import FormularioLeadPage from "@/pages/formulario-lead"
import RequireAuth from "@/components/common/RequireAuth"
import GuestRoute from "@/components/common/GuestRoute"
import ErrorBoundary from "@/components/common/ErrorBoundary"

const ProspectosDashboardPage = lazy(() => import("@/features/vendedor/pages/ProspectosDashboardPage"))
const ProspectoDetallePage = lazy(() => import("@/features/vendedor/pages/ProspectoDetallePage"))
const SupervisorDashboardPage = lazy(() => import("@/features/supervisor/pages/SupervisorDashboardPage"))
const AdminDashboardPage = lazy(() => import("@/features/admin/pages/AdminDashboardPage"))
const BackofficeDashboardPage = lazy(() => import("@/features/backoffice/pages/BackofficeDashboardPage"))
const DetalleSupervisorView = lazy(() => import("@/features/backoffice/components/DetalleSupervisorView"))

function Lazy({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" /></div>}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </Suspense>
  )
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* -- Raíz: Login como en cober360-main -- */}
      <Route path="/" element={<GuestRoute><LoginPage /></GuestRoute>} />

      {/* -- Rutas públicas (protegidas con GuestRoute: redirigen si ya autenticado) -- */}
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/signup" element={<GuestRoute><SignupPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><SignupPage /></GuestRoute>} />
      <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
      <Route path="/reset" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
      <Route path="/reset/:token" element={<GuestRoute><ResetPasswordPage /></GuestRoute>} />
      <Route path="/reset-password/:token" element={<GuestRoute><ResetPasswordPage /></GuestRoute>} />
      <Route path="/verify-email" element={<GuestRoute><VerifyEmailPage /></GuestRoute>} />
      <Route path="/verify-email/:token" element={<GuestRoute><VerifyEmailPage /></GuestRoute>} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/access-denied" element={<UnauthorizedPage />} />
      <Route path="/unknown-role" element={<UnauthorizedPage />} />
      <Route path="/lead" element={<FormularioLeadPage />} />
      <Route path="/formulario-lead" element={<FormularioLeadPage />} />

      {/* -- VENDEDOR (roles 1, 2, 3) -- */}
      <Route path="/vendedor" element={<RequireAuth allowedRoles={["vendedor", "supervisor", "admin"]}><Navigate to="/vendedor/prospectos" replace /></RequireAuth>} />
      <Route path="/vendedor/prospectos" element={<RequireAuth allowedRoles={["vendedor", "supervisor", "admin"]}><Lazy><ProspectosDashboardPage /></Lazy></RequireAuth>} />
      <Route path="/vendedor/prospecto/:id" element={<RequireAuth allowedRoles={["vendedor", "supervisor", "admin"]}><Lazy><ProspectoDetallePage /></Lazy></RequireAuth>} />
      {/* Legacy vendedor routes from cober360-main */}
      <Route path="/prospectos-dashboard" element={<RequireAuth allowedRoles={["vendedor", "supervisor", "admin"]}><Lazy><ProspectosDashboardPage /></Lazy></RequireAuth>} />
      <Route path="/prospectos" element={<RequireAuth allowedRoles={["vendedor", "supervisor", "admin"]}><Lazy><ProspectosDashboardPage /></Lazy></RequireAuth>} />
      <Route path="/prospectos/:id" element={<RequireAuth allowedRoles={["vendedor", "supervisor", "admin"]}><Lazy><ProspectoDetallePage /></Lazy></RequireAuth>} />

      {/* -- SUPERVISOR (roles 2, 3) -- */}
      <Route path="/supervisor" element={<RequireAuth allowedRoles={["supervisor", "admin"]}><Navigate to="/supervisor/dashboard" replace /></RequireAuth>} />
      <Route path="/supervisor/dashboard" element={<RequireAuth allowedRoles={["supervisor", "admin"]}><Lazy><SupervisorDashboardPage /></Lazy></RequireAuth>} />
      <Route path="/supervisor-dashboard" element={<RequireAuth allowedRoles={["supervisor", "admin"]}><Lazy><SupervisorDashboardPage /></Lazy></RequireAuth>} />
      {/* Abre directo en la vista de resumen, como `/supervisor-resumen` de prod */}
      <Route path="/supervisor-resumen" element={<RequireAuth allowedRoles={["supervisor", "admin"]}><Lazy><SupervisorDashboardPage vistaInicial="resumen" /></Lazy></RequireAuth>} />

      {/* -- ADMIN (rol 3) -- */}
      <Route path="/admin" element={<RequireAuth allowedRoles={["admin"]}><Navigate to="/admin/dashboard" replace /></RequireAuth>} />
      <Route path="/admin/dashboard" element={<RequireAuth allowedRoles={["admin"]}><Lazy><AdminDashboardPage /></Lazy></RequireAuth>} />
      <Route path="/admin-dashboard" element={<RequireAuth allowedRoles={["admin"]}><Lazy><AdminDashboardPage /></Lazy></RequireAuth>} />

      {/* -- BACKOFFICE (SÓLO rol 4) --
           Igual que producción (`ProtectedRoute.jsx` → `BackOfficeRoute` = [4]).
           No agregar "admin": parte de las rutas del backend usan
           `authenticateBackOffice` (role !== 4 → 403), así que un admin vería
           una UI que carga a medias y dispara 403 dispersos. */}
      <Route path="/backoffice" element={<RequireAuth allowedRoles={["backoffice"]}><Navigate to="/backoffice/dashboard" replace /></RequireAuth>} />
      <Route path="/backoffice/dashboard" element={<RequireAuth allowedRoles={["backoffice"]}><Lazy><BackofficeDashboardPage /></Lazy></RequireAuth>} />
      <Route path="/backoffice/supervisor/:id" element={<RequireAuth allowedRoles={["backoffice"]}><Lazy><DetalleSupervisorView /></Lazy></RequireAuth>} />
      <Route path="/backoffice/supervisores" element={<RequireAuth allowedRoles={["backoffice"]}><Lazy><BackofficeDashboardPage /></Lazy></RequireAuth>} />
      <Route path="/backoffice/supervisores/:id" element={<RequireAuth allowedRoles={["backoffice"]}><Lazy><DetalleSupervisorView /></Lazy></RequireAuth>} />
      <Route path="/backoffice/vendedores" element={<RequireAuth allowedRoles={["backoffice"]}><Lazy><BackofficeDashboardPage /></Lazy></RequireAuth>} />

      {/* -- 404 catch-all -- */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
