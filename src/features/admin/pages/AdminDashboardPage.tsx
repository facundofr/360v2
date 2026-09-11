import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Users, UserCheck, TrendingUp, FileText,
  ShieldCheck, ChevronRight, LayoutDashboard,
  Tag, Archive, ArrowLeftRight, DollarSign, Building2,
  Calculator, Activity, MessageCircle, Scale
} from "lucide-react"
import { DashboardShell } from "@/components/common/DashboardShell"

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
import CompensadorAdmin from "../components/CompensadorAdmin"

import {
  SidebarContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/AuthContext"

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
  | "compensador"

interface MenuItem { id: Vista; label: string; icon: React.ElementType; desc: string }

// Extraído fuera del componente de página: declarar un componente dentro del
// cuerpo de render de otro hace que React Compiler cree un tipo de componente
// nuevo en cada render (error real de `react-hooks/static-components`, no solo
// estilo) — acá recibe por props lo que antes capturaba por clausura.
function SidebarNavContent({ menuItems, vista, setVista }: { menuItems: MenuItem[]; vista: Vista; setVista: (v: Vista) => void }) {
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
                    ? "bg-primary text-primary-foreground"
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
    { id: "compensador",        label: "Compensador",       icon: Scale,           desc: "Balanceo entre unidades" },
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

  return (
    <DashboardShell
      roleLabel="Admin"
      roleBadgeLabel="Administrador"
      logoClassName="h-9 w-9"
      userName={user?.name}
      userEmail={user?.email}
      onLogout={() => logout().then(() => navigate("/login"))}
      navContent={<SidebarNavContent menuItems={menuItems} vista={vista} setVista={setVista} />}
      headerTitle={menuItems.find(m => m.id === vista)?.label ?? "Admin"}
    >
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

          {/* COMPENSADOR DE LEADS */}
          {vista === "compensador" && <CompensadorAdmin />}

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
    </DashboardShell>
  )
}

