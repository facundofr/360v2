import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { toast } from "sonner"
import {
  UserCheck, TrendingUp, DollarSign, FileText,
  RefreshCw, Filter,
  ShieldCheck, Tag, Users, Activity,
  Percent, ChevronRight, LayoutDashboard
} from "lucide-react"
import { TendenciasChart } from "@/components/common/TendenciasChart"

import {
  SidebarContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarGroup, SidebarGroupLabel, useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import { API_URL } from "@/lib/config"
import { BackofficeProspectosView } from "../components/BackofficeProspectosView"
import { BackofficePolizasView } from "../components/BackofficePolizasView"
import { BackofficeSupervisoresView } from "../components/BackofficeSupervisoresView"
import { BackofficeVendedoresView } from "../components/BackofficeVendedoresView"
import { BackofficePromocionesView } from "../components/BackofficePromocionesView"
import { BackofficeMetricasView } from "../components/BackofficeMetricasView"
import { DashboardShell } from "@/components/common/DashboardShell"
import { StatCard } from "@/components/common/StatCard"
import { getAuthToken } from "@/lib/auth"

type Vista = "dashboard" | "prospectos" | "polizas" | "supervisores" | "vendedores" | "promociones" | "metricas"

interface Estadisticas {
  total_prospectos?: number
  total_vendedores?: number
  total_supervisores?: number
  total_polizas?: number
  ventas_mes?: number
  ingresos_mes?: number
  prospectos_hoy?: number
  conversion_rate?: number
  // Datos históricos para gráfico
  labels?: string[]
  prospectos_historico?: number[]
  ventas_historico?: number[]
  polizas_historico?: number[]
  generales?: {
    total_prospectos?: number
    total_vendedores_activos?: number
    vendedores_activos?: number
    polizas_generadas_total?: number
    polizas_mes?: number
    ventas_mes?: number
    ingresos_mes?: number
    conversion_rate?: number
    prospectos_historico?: number[]
    ventas_historico?: number[]
    polizas_historico?: number[]
    labels?: string[]
  }
}

interface MenuItem { id: Vista; label: string; icon: React.ElementType; group?: string; desc: string }

// Extraído fuera del componente de página: declarar un componente dentro del
// cuerpo de render de otro hace que React Compiler cree un tipo de componente
// nuevo en cada render (error real de `react-hooks/static-components`, no solo
// estilo) — acá recibe por props lo que antes capturaba por clausura.
function SidebarNavContent({ menuItems, vista, setVista }: { menuItems: MenuItem[]; vista: Vista; setVista: (v: Vista) => void }) {
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarContent className="pt-3">
      {["Principal", "Gestión", "Equipo", "Comercial"].map(group => {
        const items = menuItems.filter(m => m.group === group)
        return (
          <SidebarGroup key={group}>
            <SidebarGroupLabel className="text-[10.5px] uppercase tracking-widest text-muted-foreground/60 px-3">
              {group}
            </SidebarGroupLabel>
            <SidebarMenu>
              {items.map(v => {
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
          </SidebarGroup>
        )
      })}
    </SidebarContent>
  )
}

export default function BackofficeDashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [vista, setVista] = useState<Vista>("dashboard")
  const [estadisticas, setEstadisticas] = useState<Estadisticas>({})
  const [tendencias, setTendencias] = useState<{ fecha: string; nuevos_prospectos: number; ventas_cerradas: number; polizas_creadas: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [periodType, setPeriodType] = useState("month")
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, "0"))

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ periodType, year: selectedYear })
      if (periodType === "month") params.set("month", selectedMonth)
      const headers = { Authorization: `Bearer ${getAuthToken()}` }
      // Días a pedir según período
      const dias = periodType === "all" ? 365 : periodType === "year" ? 365 : 30
      const [dashRes, tendRes] = await Promise.all([
        axios.get(`${API_URL}/backoffice/dashboard?${params}`, { headers }),
        axios.get(`${API_URL}/backoffice/tendencias?dias=${dias}`, { headers }),
      ])
      // Normalizar estructura: el backend puede devolver data.data, data.estadisticas, o data directamente
      const payload = dashRes.data?.data ?? dashRes.data?.estadisticas ?? dashRes.data ?? {}
      setEstadisticas(payload)
      setTendencias(tendRes.data?.data ?? [])
    } catch {
      toast.error("Error al cargar el dashboard")
    } finally {
      setLoading(false)
    }
  }, [periodType, selectedYear, selectedMonth])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  // Construir datos del gráfico desde tendencias (endpoint confiable)
  const buildChartData = () => {
    if (tendencias.length > 0) {
      const vendCount = totalVendedores ?? 0
      return [...tendencias]
        .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
        .map(t => ({
          mes: new Date(t.fecha + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" }),
          Prospectos: t.nuevos_prospectos ?? 0,
          Vendedores: vendCount,
          Ventas: t.ventas_cerradas ?? 0,
          Polizas: t.polizas_creadas ?? 0,
        }))
    }
    // Fallback: datos históricos del endpoint dashboard
    const src = estadisticas.generales ?? estadisticas
    const labels: string[] = src.labels ?? []
    const prospectos: number[] = src.prospectos_historico ?? []
    const ventas: number[] = src.ventas_historico ?? []
    const polizas: number[] = src.polizas_historico ?? []
    const len = Math.max(labels.length, prospectos.length, ventas.length, polizas.length, 6)
    if (len === 0) return []
    const meses = labels.length >= len ? labels : Array.from({ length: len }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (len - 1 - i))
      return d.toLocaleString("es", { month: "short" })
    })
    const vendCount = totalVendedores ?? 0
    return meses.map((mes, i) => ({
      mes,
      Prospectos: prospectos[i] ?? 0,
      Vendedores: vendCount,
      Ventas: ventas[i] ?? 0,
      Polizas: polizas[i] ?? 0,
    }))
  }

  const menuItems: { id: Vista; label: string; icon: React.ElementType; group?: string; desc: string }[] = [
    { id: "dashboard",    label: "Dashboard",          icon: LayoutDashboard, group: "Principal",  desc: "Resumen general" },
    { id: "metricas",     label: "Métricas Avanzadas",  icon: Activity,        group: "Principal",  desc: "KPIs y tendencias" },
    { id: "prospectos",   label: "Prospectos",          icon: TrendingUp,      group: "Gestión",    desc: "Leads y seguimiento" },
    { id: "polizas",      label: "Pólizas",             icon: FileText,        group: "Gestión",    desc: "Contratos emitidos" },
    { id: "supervisores", label: "Supervisores",         icon: ShieldCheck,     group: "Equipo",     desc: "Panel de control" },
    { id: "vendedores",   label: "Vendedores",           icon: UserCheck,       group: "Equipo",     desc: "Fuerza de ventas" },
    { id: "promociones",  label: "Promociones",          icon: Tag,             group: "Comercial",  desc: "Ofertas activas" },
  ]

  const MESES = [
    { value: "01", label: "Enero" }, { value: "02", label: "Febrero" }, { value: "03", label: "Marzo" },
    { value: "04", label: "Abril" }, { value: "05", label: "Mayo" }, { value: "06", label: "Junio" },
    { value: "07", label: "Julio" }, { value: "08", label: "Agosto" }, { value: "09", label: "Septiembre" },
    { value: "10", label: "Octubre" }, { value: "11", label: "Noviembre" }, { value: "12", label: "Diciembre" },
  ]

  const generales = (estadisticas.generales ?? estadisticas) as Record<string, unknown>

  const totalProspectos = (generales.total_prospectos ?? generales.prospectos_activos_total ?? estadisticas.total_prospectos) as number | undefined
  const totalVendedores = (generales.total_vendedores_activos ?? generales.vendedores_activos ?? estadisticas.total_vendedores) as number | undefined
  const totalPolizas = (generales.polizas_generadas_total ?? generales.polizas_mes ?? estadisticas.total_polizas) as number | undefined
  const ventasMes = (generales.ventas_mes ?? estadisticas.ventas_mes) as number | undefined
  const ingresosMes = (generales.ingresos_mes ?? estadisticas.ingresos_mes) as number | undefined
  const conversionRate = (generales.conversion_rate ?? estadisticas.conversion_rate) as number | undefined

  const chartData = buildChartData()

  return (
    <DashboardShell
      roleLabel="Backoffice"
      roleBadgeLabel="Administración"
      logoClassName="h-7"
      userName={user?.name}
      userEmail={user?.email}
      onLogout={() => logout().then(() => navigate("/login"))}
      navContent={<SidebarNavContent menuItems={menuItems} vista={vista} setVista={setVista} />}
      headerTitle={menuItems.find(m => m.id === vista)?.label ?? "Backoffice"}
      headerActions={
        vista === "dashboard" ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Actualizar dashboard" onClick={fetchDashboard}>
            <RefreshCw className="size-4" aria-hidden="true" />
          </Button>
        ) : undefined
      }
    >
        <div className="p-4 sm:p-6 flex flex-col gap-5">
          {/* -- DASHBOARD PRINCIPAL -- */}
          {vista === "dashboard" && (
            <>
              {/* Header del dashboard */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Resumen general</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Vista rápida del rendimiento del equipo comercial</p>
                </div>
              </div>

              {/* Filtros de periodo */}
              <div className="flex flex-wrap gap-2 items-center p-3 bg-paper-sunk rounded-lg border">
                <Filter className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium text-muted-foreground hidden sm:inline">Periodo:</span>
                <Select value={periodType} onValueChange={setPeriodType}>
                  <SelectTrigger className="w-[130px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Por mes</SelectItem>
                    <SelectItem value="year">Por año</SelectItem>
                    <SelectItem value="all">Todo</SelectItem>
                  </SelectContent>
                </Select>
                {periodType !== "all" && (
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[100px] h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 2 + i)).map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {periodType === "month" && (
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[130px] h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Stats cards */}
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    {
                      label: "Total Prospectos", value: totalProspectos,
                      icon: Users,
                      trend: 5.2, desc: "vs. periodo anterior", action: () => setVista("prospectos")
                    },
                    {
                      label: "Vendedores Activos", value: totalVendedores,
                      icon: UserCheck,
                      trend: undefined, desc: "en el equipo", action: () => setVista("vendedores")
                    },
                    {
                      label: "Pólizas Generadas", value: totalPolizas,
                      icon: FileText,
                      trend: 8.1, desc: "vs. periodo anterior", action: () => setVista("polizas")
                    },
                    {
                      label: "Ventas del periodo", value: ventasMes,
                      icon: DollarSign,
                      trend: conversionRate, desc: conversionRate !== undefined ? `${Number(conversionRate).toFixed(1)}% conversión` : undefined, action: undefined
                    },
                  ].map(({ label, value, icon, trend, desc, action }) => (
                    <StatCard
                      key={label}
                      icon={icon}
                      label={label}
                      value={value !== undefined ? Number(value).toLocaleString("es-AR") : "-"}
                      subtitle={desc}
                      trend={trend !== undefined ? { value: Number(trend.toFixed(1)), positive: trend >= 0 } : null}
                      onClick={action}
                    />
                  ))}
                </div>
              )}

              {/* Ingresos y conversión */}
              {!loading && (ingresosMes !== undefined || conversionRate !== undefined) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ingresosMes !== undefined && (
                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="rounded-lg bg-muted p-3">
                          <DollarSign className="size-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Ingresos del periodo</p>
                          <p className="text-xl font-bold">
                            {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(ingresosMes)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {conversionRate !== undefined && (
                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="rounded-lg bg-muted p-3">
                          <Percent className="size-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Tasa de conversión</p>
                          <p className="text-xl font-bold">{Number(conversionRate).toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">prospectos → pólizas</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Gráfico de tendencias */}
              {!loading && chartData.length > 0 && (
                <TendenciasChart
                  data={chartData}
                  title="Tendencias"
                  description="Evolución de prospectos, ventas y pólizas en el tiempo"
                  accion={
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hidden sm:flex sm:ml-auto"
                      onClick={() => setVista("metricas")}>
                      Ver métricas avanzadas <ChevronRight className="size-3 ml-1" />
                    </Button>
                  }
                />
              )}
            </>
          )}

          {/* -- SUB-VISTAS -- */}
          {vista === "prospectos" && <BackofficeProspectosView />}
          {vista === "polizas" && <BackofficePolizasView />}
          {vista === "supervisores" && <BackofficeSupervisoresView />}
          {vista === "vendedores" && <BackofficeVendedoresView />}
          {vista === "promociones" && <BackofficePromocionesView />}
          {vista === "metricas" && <BackofficeMetricasView />}
        </div>
    </DashboardShell>
  )
}