import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Users, UserCheck, TrendingUp, FileText,
  LogOut, ShieldCheck, ChevronRight, LayoutDashboard,
  Tag, Archive, ArrowLeftRight, DollarSign, Building2,
  Calculator, Activity, Sun, Moon, MessageCircle
} from "lucide-react"
import { useTheme } from "@/components/common/theme-provider"

import DashboardMetricasAdmin from "../components/DashboardMetricasAdmin"
import UsuariosAdmin from "../components/UsuariosAdmin"
import VendedoresAdmin from "../components/VendedoresAdmin"
import SupervisoresAdmin from "../components/SupervisoresAdmin"
import ProspectosAdmin from "../components/ProspectosAdmin"
import PolizasAdmin from "../components/PolizasAdmin"
import PromocionesAdmin from "../components/PromocionesAdmin"
import RefritosAdmin from "../components/RefritosAdmin"
import ReasignacionAutomaticaAdmin from "../components/ReasignacionAutomaticaAdmin"
import MonotributoAdmin from "../components/MonotributoAdmin"
import ListaPreciosAdmin from "../components/ListaPreciosAdmin"
import PrestadoresAdmin from "../components/PrestadoresAdmin"
import ActiveUsersMonitor from "../components/ActiveUsersMonitor"
import GestionCategorias from "../components/GestionCategorias"
import ValidacionWhatsappAdmin from "../components/ValidacionWhatsappAdmin"
import SecurityDashboard from "../components/SecurityDashboard"
import MetricasAvanzadas from "../components/MetricasAvanzadas"
import MonitoringDashboard from "../components/MonitoringDashboard"

import {
  SidebarProvider, Sidebar, SidebarContent, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger,
  SidebarInset, SidebarFooter
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/AuthContext"
import { useSidebar } from "@/components/ui/sidebar"
import { X as XIcon } from "lucide-react"
import { AppVersion } from "@/components/common/AppVersion"
import Logo from "@/components/ui/logo"

function AdminMobileControls() {
  const { setOpenMobile } = useSidebar()
  return (
    <div className="flex flex-col items-end">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpenMobile(false)} aria-label="Cerrar menú"><XIcon className="size-4"/></Button>
    </div>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      title={resolvedTheme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}

type Vista =
  | "dashboard-metricas"
  | "usuarios"
  | "vendedores"
  | "supervisores"
  | "prospectos"
  | "polizas"
  | "promociones"
  | "refritos"
  | "reasignaciones"
  | "monotributo"
  | "precios"
  | "prestadores"
  | "categorias"
  | "monitor-usuarios"
  | "metricas-avanzadas"
  | "monitoring"
  | "seguridad"
  | "validacion-whatsapp"

export default function AdminDashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [vista, setVista] = useState<Vista>("dashboard-metricas")

  const menuItems: { id: Vista; label: string; icon: React.ElementType; desc: string }[] = [
    { id: "dashboard-metricas", label: "Dashboard",         icon: LayoutDashboard, desc: "KPIs y tendencias" },
    { id: "usuarios",           label: "Usuarios",          icon: Users,           desc: "Gestión de cuentas" },
    { id: "vendedores",         label: "Vendedores",        icon: UserCheck,       desc: "Fuerza de ventas" },
    { id: "supervisores",       label: "Supervisores",      icon: ShieldCheck,     desc: "Panel de control" },
    { id: "prospectos",         label: "Prospectos",        icon: TrendingUp,      desc: "Leads y seguimiento" },
    { id: "polizas",            label: "Pólizas",           icon: FileText,        desc: "Contratos emitidos" },
    { id: "promociones",        label: "Promociones",       icon: Tag,             desc: "Descuentos activos" },
    { id: "refritos",           label: "Refritos",          icon: Archive,         desc: "Prospectos reciclados" },
    { id: "reasignaciones",     label: "Reasignaciones",    icon: ArrowLeftRight,  desc: "Asignación automática" },
    { id: "prestadores",        label: "Prestadores",       icon: Building2,       desc: "Red de salud" },
    { id: "precios",            label: "Lista de Precios",  icon: DollarSign,      desc: "Precios por año" },
    { id: "monotributo",        label: "Monotributo",       icon: Calculator,      desc: "Categorías y aportes" },
    { id: "categorias",         label: "Categorías",        icon: Tag,             desc: "Asignación round-robin" },
    { id: "validacion-whatsapp", label: "Validador WhatsApp", icon: MessageCircle,  desc: "Validación de prospectos" },
    { id: "monitor-usuarios",   label: "Monitor",           icon: Activity,        desc: "Usuarios en línea" },
    { id: "metricas-avanzadas", label: "Métricas Avanzadas",  icon: TrendingUp,      desc: "KPIs y gráficos" },
    { id: "monitoring",         label: "Sistema",            icon: Activity,        desc: "CPU, RAM, disco" },
    { id: "seguridad",          label: "Seguridad",          icon: ShieldCheck,     desc: "Panel de seguridad" },
  ]

  function SidebarNavContent() {
    const { setOpenMobile } = useSidebar()
    return (
      <SidebarContent className="pt-3">
        <SidebarMenu>
          {menuItems.map(v => {
            const Icon = v.icon
            const active = vista === v.id
            return (
              <SidebarMenuItem key={v.id}>
                <SidebarMenuButton
                  isActive={active}
                  onClick={() => { setVista(v.id); setOpenMobile(false) }}
                  className="h-auto py-2 px-3 group"
                >
                  <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    active
                      ? "bg-primary text-white"
                      : "bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary dark:group-hover:bg-primary/20 dark:group-hover:text-purple-300"
                  }`}>
                    <Icon className="size-3.5" />
                  </div>
                  <div className="flex flex-1 flex-col items-start min-w-0">
                    <span className={`text-sm font-medium leading-tight ${
                      active ? "text-primary dark:text-purple-400" : ""
                    }`}>{v.label}</span>
                    <span className="text-xs text-muted-foreground leading-tight truncate">{v.desc}</span>
                  </div>
                  {active && <ChevronRight className="size-3.5 shrink-0 text-primary" />}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>
    )
  }

  return (
    <SidebarProvider>
      <Sidebar variant="inset" className="border-r-0">
        {/* Header: gradiente brand #78358b */}
        <SidebarHeader className="pb-0">
          <div className="relative overflow-hidden rounded-t-lg bg-gradient-to-br from-primary via-primary to-[#3d1a4d] px-4 pt-5 pb-4">
            {/* Círculos decorativos */}
            <div className="pointer-events-none absolute -top-6 -right-6 size-24 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-4 -left-4 size-16 rounded-full bg-white/8" />
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-2 ring-white/30 backdrop-blur-sm overflow-hidden">
                  <Logo className="h-9 w-9" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight text-white">Admin</p>
                  <p className="text-[11px] leading-tight text-[#d4a8e0]">{user?.name ?? "Panel"}</p>
                </div>
              </div>
              <AdminMobileControls />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Badge className="bg-white/20 text-white border-0 text-[10px] font-semibold hover:bg-white/30">
                Administrador
              </Badge>
            </div>
          </div>
        </SidebarHeader>

        <SidebarNavContent />

        <SidebarFooter className="border-t p-3">
          <div className="flex items-center gap-2 px-1 py-1.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 dark:bg-primary/25">
              <span className="text-xs font-bold text-primary dark:text-purple-300">
                {(user?.name ?? "A").charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.name ?? "Admin"}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email ?? ""}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => logout().then(() => navigate("/login"))}
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
          <SidebarTrigger />
          <h1 className="font-semibold flex-1">{menuItems.find(m => m.id === vista)?.label ?? "Admin"}</h1>
          <ThemeToggle />
        </header>

        <div className="p-4 space-y-4">
          {/* DASHBOARD METRICAS */}
          {vista === "dashboard-metricas" && <DashboardMetricasAdmin />}

          {/* USUARIOS */}
          {vista === "usuarios" && <UsuariosAdmin />}

          {/* VENDEDORES */}
          {vista === "vendedores" && <VendedoresAdmin />}

          {/* SUPERVISORES */}
          {vista === "supervisores" && <SupervisoresAdmin />}

          {/* PROSPECTOS */}
          {vista === "prospectos" && <ProspectosAdmin />}

          {/* POLIZAS */}
          {vista === "polizas" && <PolizasAdmin />}

          {/* PROMOCIONES */}
          {vista === "promociones" && <PromocionesAdmin />}

          {/* REFRITOS */}
          {vista === "refritos" && <RefritosAdmin />}

          {/* REASIGNACIONES */}
          {vista === "reasignaciones" && <ReasignacionAutomaticaAdmin />}

          {/* LISTA DE PRECIOS */}
          {vista === "precios" && <ListaPreciosAdmin />}

          {/* PRESTADORES */}
          {vista === "prestadores" && <PrestadoresAdmin />}

          {/* CATEGORIAS */}
          {vista === "categorias" && <GestionCategorias />}

          {/* MONOTRIBUTO */}
          {vista === "monotributo" && <MonotributoAdmin />}

          {/* MONITOR USUARIOS */}
          {vista === "monitor-usuarios" && <ActiveUsersMonitor />}

          {/* METRICAS AVANZADAS */}
          {vista === "metricas-avanzadas" && <MetricasAvanzadas />}

          {/* MONITORING SISTEMA */}
          {vista === "monitoring" && <MonitoringDashboard />}

          {/* SEGURIDAD */}
          {vista === "seguridad" && <SecurityDashboard />}
          {vista === "validacion-whatsapp" && <ValidacionWhatsappAdmin />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

