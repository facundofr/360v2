import { LogOut, X as XIcon } from "lucide-react"

import {
  SidebarProvider, Sidebar, SidebarHeader,
  SidebarTrigger, SidebarInset, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AppVersion } from "@/components/common/AppVersion"
import ThemeToggle from "@/components/common/theme-toggle"
import Logo from "@/components/ui/logo"

function ShellMobileClose() {
  const { setOpenMobile } = useSidebar()
  return (
    <Button
      variant="ghost"
      size="icon"
      className="md:hidden"
      onClick={() => setOpenMobile(false)}
      aria-label="Cerrar menú"
    >
      <XIcon className="size-4" />
    </Button>
  )
}

interface DashboardShellProps {
  /** Nombre corto del rol, mostrado grande en el header ("Admin", "Supervisor"). */
  roleLabel: string
  /** Texto del badge bajo el header ("Administrador", "Supervisión"). */
  roleBadgeLabel: string
  logoClassName?: string
  userName?: string
  userEmail?: string
  onLogout: () => void
  /** Contenido del sidebar (menú), armado por cada página porque su forma varía por rol. */
  navContent: React.ReactNode
  headerTitle: string
  /** Acciones extra en el header de contenido, antes del ThemeToggle (ej. refresh). */
  headerActions?: React.ReactNode
  children: React.ReactNode
}

/**
 * Shell compartido de sidebar+header+footer para los dashboards de admin,
 * supervisor y backoffice — los tres reimplementaban el mismo gradiente,
 * footer con logout y wiring de SidebarProvider. El menú (navContent) y la
 * lógica de cada vista quedan en cada página porque sí varían por rol.
 *
 * El dashboard de vendedor no usa este shell: su sidebar es estructuralmente
 * distinto (sin gradiente, pensado para uso rápido "en la calle").
 */
export function DashboardShell({
  roleLabel,
  roleBadgeLabel,
  logoClassName = "h-8",
  userName,
  userEmail,
  onLogout,
  navContent,
  headerTitle,
  headerActions,
  children,
}: DashboardShellProps) {
  return (
    <SidebarProvider>
      <Sidebar variant="inset" className="border-r-0">
        <SidebarHeader className="pb-0">
          <div className="relative overflow-hidden rounded-t-lg bg-gradient-to-br from-primary via-primary to-[#3d1a4d] px-4 pt-5 pb-4">
            <div className="pointer-events-none absolute -top-6 -right-6 size-24 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-4 -left-4 size-16 rounded-full bg-white/8" />
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-2 ring-white/30 backdrop-blur-sm overflow-hidden">
                  <Logo className={logoClassName} />
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight text-white">{roleLabel}</p>
                  <p className="text-[11px] leading-tight text-white/70">{userName ?? "Panel"}</p>
                </div>
              </div>
              <ShellMobileClose />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Badge className="bg-white/20 text-white border-0 text-[10px] font-semibold hover:bg-white/30">
                {roleBadgeLabel}
              </Badge>
            </div>
          </div>
        </SidebarHeader>

        {navContent}

        <SidebarFooter className="border-t p-3">
          <div className="flex items-center gap-2 px-1 py-1.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 dark:bg-primary/25">
              {/* dark:text-purple-300: --primary pierde contraste sobre fondo oscuro neutro; el
                  gradiente del header no tiene este problema porque su fondo ya es violeta sólido. */}
              <span className="text-xs font-bold text-primary dark:text-purple-300">
                {(userName ?? roleLabel).charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{userName ?? roleLabel}</p>
              <p className="text-[10px] text-muted-foreground truncate">{userEmail ?? ""}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={onLogout}
              title="Cerrar sesión"
            >
              <LogOut className="size-3.5" />
            </Button>
          </div>
          <AppVersion className="px-1 pt-1 group-data-[collapsible=icon]:hidden" />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 overflow-x-hidden">
        <header className="flex items-center gap-3 border-b px-4 py-3 sticky top-0 bg-background z-10">
          <SidebarTrigger aria-label="Alternar menú lateral" />
          <h1 className="font-semibold flex-1 truncate">{headerTitle}</h1>
          {headerActions}
          <ThemeToggle className="shrink-0 size-8 text-muted-foreground hover:text-foreground" />
        </header>

        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
