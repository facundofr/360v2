import { useEffect, useState, useCallback, startTransition } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { toast } from "sonner"
import {
  Users, DollarSign, FileText,
  Search, X, UserCheck, RefreshCw,
  ArrowRightLeft, Tag, FolderOpen,
  LayoutDashboard,
  ChevronRight, Download, Eye, MessageCircle, Loader2, Receipt, ClipboardList
} from "lucide-react"
import { SupervisorPolizasView } from "../components/SupervisorPolizasView"
import { SupervisorChatView } from "../components/SupervisorChatView"
import { SupervisorResumenView } from "../components/SupervisorResumenView"
import { SupervisorCotizacionesPorUsuario } from "../components/SupervisorCotizacionesPorUsuario"
import { SupervisorDocumentosView } from "../components/SupervisorDocumentosView"
import { SupervisorPromocionesView } from "../components/SupervisorPromocionesView"
import { SupervisorVendedoresView } from "../components/SupervisorVendedoresView"
import MetricasVendedorView from "../components/MetricasVendedorView"
import { TendenciasChart } from "@/components/common/TendenciasChart"
import CargaMultipleDocumentos from "@/components/supervisor/CargaMultipleDocumentos"
import ModalExportacion from "@/components/modals/ModalExportacion"

import {
  SidebarContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import { DashboardShell } from "@/components/common/DashboardShell"
import { StatCard } from "@/components/common/StatCard"
import { getBadgeEstado } from "@/utils/estadosHelper"
import { ENDPOINTS, API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

const ESTADOS = [
  "Lead","1 Contacto","Calificado Cotizacion","Calificado Poliza",
  "Calificado Pago","Venta","Fuera de zona","Fuera de edad",
  "No contesta","No le interesa (economico)","Telefono erroneo","Ya es socio",
  "Busca otra Cobertura","Preexistencia","Reafiliacion"
]

interface Prospecto {
  id: number
  nombre: string
  apellido: string
  estado: string
  asignacion_estado?: string
  comentario?: string
  vendedor_nombre?: string
  vendedor_id?: number
  updated_at?: string
  edad?: number
  dni?: string
  numero_contacto?: string
  localidad?: string
  correo?: string
}

interface Estadisticas {
  total_prospectos?: number
  totalProspectos?: number
  total_vendedores?: number
  totalVendedores?: number
  vendedoresActivos?: number
  total_ventas?: number
  ventasConfirmadas?: number
  total_polizas?: number
  totalPolizas?: number
  cambioProspectosMes?: number
  cambioVendedores?: number
  cambioVentas?: number
  cambioPolizas?: number
}

interface DatoGrafica {
  mes: string
  nuevosProspectos?: number
  vendedores?: number
  ventas?: number
  polizasGeneradas?: number
}

interface Vendedor {
  id: number
  nombre?: string
  first_name?: string
  last_name?: string
  email?: string
  total_prospectos?: number
  ventas?: number
}

type VistaType = "dashboard" | "prospectos" | "vendedores" | "polizas" | "documentos" | "promociones" | "metricas" | "chat" | "resumen" | "cotizaciones"

function SidebarNavContent({
  vista,
  setVista,
  setExportarModal,
}: {
  vista: VistaType
  setVista: React.Dispatch<React.SetStateAction<VistaType>>
  setExportarModal: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarContent className="pt-3">
      <SidebarMenu>
        {[
          { id: "dashboard",    label: "Dashboard",    icon: LayoutDashboard, desc: "Métricas generales" },
          { id: "prospectos",   label: "Prospectos",   icon: Users,            desc: "Gestión de leads" },
          { id: "vendedores",   label: "Vendedores",   icon: UserCheck,        desc: "Mi equipo" },
          { id: "polizas",      label: "Pólizas",      icon: FileText,         desc: "Contratos emitidos" },
          { id: "documentos",   label: "Documentos",   icon: FolderOpen,       desc: "Archivos y firmas" },
          { id: "chat",         label: "Chat",         icon: MessageCircle,    desc: "Conversaciones del equipo" },
          { id: "cotizaciones", label: "Cotizaciones", icon: Receipt,          desc: "Por prospecto" },
          { id: "resumen",      label: "Resumen",      icon: ClipboardList,    desc: "Resumen del equipo" },
          { id: "promociones",  label: "Promociones",  icon: Tag,              desc: "Ofertas activas" },
        ].map(v => {
          const Icon = v.icon
          const active = vista === v.id
          return (
            <SidebarMenuItem key={v.id}>
              <SidebarMenuButton
                isActive={active}
                onClick={() => { setVista(v.id as typeof vista); setOpenMobile(false) }}
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
      <div className="px-3 mt-2 space-y-1">
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs gap-1.5 justify-start"
          onClick={() => setExportarModal(true)}
        >
          <Download className="size-3.5" />Exportar datos
        </Button>
      </div>
    </SidebarContent>
  )
}

interface SupervisorDashboardPageProps {
  /** Vista con la que abre la página. `/supervisor-resumen` entra en "resumen". */
  vistaInicial?: VistaType
}

export default function SupervisorDashboardPage({ vistaInicial = "dashboard" }: SupervisorDashboardPageProps = {}) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [vista, setVista] = useState<VistaType>(vistaInicial)
  const [prospectos, setProspectos] = useState<Prospecto[]>([])
  const [estadisticas, setEstadisticas] = useState<Estadisticas>({})
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [datosGrafica, setDatosGrafica] = useState<DatoGrafica[]>([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({ busqueda: "", estado: "", vendedor: "", nombre: "", apellido: "", edad: "" })

  // Modal reasignar
  const [modalReasignar, setModalReasignar] = useState<{ open: boolean; prospecto: Prospecto | null }>({ open: false, prospecto: null })
  const [vendedorDestino, setVendedorDestino] = useState("")
  const [reasignando, setReasignando] = useState(false)

  // Modal cambio estado
  const [modalEstado, setModalEstado] = useState<{ open: boolean; prospecto: Prospecto | null }>({ open: false, prospecto: null })
  const [nuevoEstado, setNuevoEstado] = useState("")
  const [comentarioEstado, setComentarioEstado] = useState("")
  const [guardandoEstado, setGuardandoEstado] = useState(false)

  // Modal historial
  const [modalHistorial, setModalHistorial] = useState<{ open: boolean; prospecto: Prospecto | null; items: unknown[] }>({ open: false, prospecto: null, items: [] })

  // Modales: Carga documentos y exportación
  const [cargaDocumentosModal, setCargaDocumentosModal] = useState<{ open: boolean; polizaId: number | null }>({ open: false, polizaId: null })
  const [exportarModal, setExportarModal] = useState(false)

  // Modal detalle y cotizaciones
  const [modalDetalle, setModalDetalle] = useState<{ open: boolean; prospecto: Prospecto | null }>({ open: false, prospecto: null })
  const [modalCotizacion, setModalCotizacion] = useState<{ open: boolean; prospecto: Prospecto | null }>({ open: false, prospecto: null })
  const [cotizaciones, setCotizaciones] = useState<unknown[]>([])
  const [loadingCotizaciones, setLoadingCotizaciones] = useState(false)

  // Spinner por botón: "<prospectoId>-<accion>"
  const [loadingBtn, setLoadingBtn] = useState<Record<string, boolean>>({})
  const setBtnLoading = (id: number, action: string, val: boolean) =>
    setLoadingBtn(prev => ({ ...prev, [`${id}-${action}`]: val }))
  const isBtnLoading = (id: number, action: string) => !!loadingBtn[`${id}-${action}`]

  const authHeaders = { Authorization: `Bearer ${getAuthToken()}` }

  const fetchData = useCallback(async () => {
    setLoading(true)
    const MOCK_GRAFICA: DatoGrafica[] = [
      { mes: "Ene", nuevosProspectos: 280, vendedores: 12, ventas: 45, polizasGeneradas: 35 },
      { mes: "Feb", nuevosProspectos: 320, vendedores: 14, ventas: 52, polizasGeneradas: 42 },
      { mes: "Mar", nuevosProspectos: 380, vendedores: 15, ventas: 68, polizasGeneradas: 58 },
      { mes: "Abr", nuevosProspectos: 200, vendedores: 13, ventas: 35, polizasGeneradas: 28 },
      { mes: "May", nuevosProspectos: 190, vendedores: 12, ventas: 42, polizasGeneradas: 35 },
      { mes: "Jun", nuevosProspectos: 220, vendedores: 14, ventas: 48, polizasGeneradas: 40 },
      { mes: "Jul", nuevosProspectos: 350, vendedores: 16, ventas: 75, polizasGeneradas: 62 },
      { mes: "Ago", nuevosProspectos: 380, vendedores: 17, ventas: 82, polizasGeneradas: 70 },
      { mes: "Sep", nuevosProspectos: 320, vendedores: 16, ventas: 68, polizasGeneradas: 55 },
      { mes: "Oct", nuevosProspectos: 290, vendedores: 15, ventas: 55, polizasGeneradas: 45 },
      { mes: "Nov", nuevosProspectos: 250, vendedores: 14, ventas: 48, polizasGeneradas: 38 },
      { mes: "Dic", nuevosProspectos: 200, vendedores: 13, ventas: 38, polizasGeneradas: 30 },
    ]
    try {
      const [{ data: p }, statsRes, vendRes, graficaRes] = await Promise.all([
        axios.get(`${API_URL}/supervisor/prospectos`, { headers: authHeaders }),
        axios.get(`${API_URL}/supervisor/estadisticas`, { headers: authHeaders }).catch(() => ({ data: {} })),
        axios.get(`${API_URL}/supervisor/vendedores`, { headers: authHeaders }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/supervisor/datos-grafica`, { headers: authHeaders }).catch(() => ({ data: null })),
      ])
      setProspectos(p ?? [])
      // Normalizar estadísticas
      const rawStats = statsRes.data
      const statsData = rawStats?.success ? rawStats.data : rawStats
      setEstadisticas({
        cambioProspectosMes: 12.5,
        cambioVendedores: 5.2,
        cambioVentas: -2.1,
        cambioPolizas: 3.4,
        ...(statsData ?? {}),
      })
      setVendedores(vendRes.data ?? [])
      // Gráfica
      const graficaData = graficaRes.data
      if (graficaData?.success && Array.isArray(graficaData.data)) {
        setDatosGrafica(graficaData.data)
      } else if (Array.isArray(graficaData)) {
        setDatosGrafica(graficaData)
      } else {
        setDatosGrafica(MOCK_GRAFICA)
      }
    } catch {
      toast.error("Error al cargar datos")
      setDatosGrafica(MOCK_GRAFICA)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { startTransition(() => { fetchData() }) }, [fetchData])

  const prospectosFiltrados = prospectos.filter(p => {
    const texto = `${p.nombre} ${p.apellido}`.toLowerCase()
    if (filtros.busqueda && !texto.includes(filtros.busqueda.toLowerCase())) return false
    if (filtros.nombre && !p.nombre?.toLowerCase().includes(filtros.nombre.toLowerCase())) return false
    if (filtros.apellido && !p.apellido?.toLowerCase().includes(filtros.apellido.toLowerCase())) return false
    if (filtros.edad && String(p.edad) !== filtros.edad) return false
    if (filtros.estado && filtros.estado !== "todos" && (p.asignacion_estado ?? p.estado) !== filtros.estado) return false
    if (filtros.vendedor && filtros.vendedor !== "todos" && String(p.vendedor_id) !== filtros.vendedor) return false
    return true
  })

  const verHistorial = async (p: Prospecto) => {
    setBtnLoading(p.id, "historial", true)
    try {
      const { data } = await axios.get(`${ENDPOINTS.PROSPECTOS}/${p.id}/historial`, { headers: authHeaders })
      setModalHistorial({ open: true, prospecto: p, items: data ?? [] })
    } catch {
      toast.error("Error al cargar historial")
    } finally {
      setBtnLoading(p.id, "historial", false)
    }
  }

  const reasignar = async () => {
    if (!modalReasignar.prospecto || !vendedorDestino) return
    setReasignando(true)
    try {
      await axios.post(
        `${API_URL}/supervisor/reasignar-prospectos`,
        { prospecto_ids: [modalReasignar.prospecto.id], vendedor_id: Number(vendedorDestino) },
        { headers: authHeaders }
      )
      toast.success("Prospecto reasignado")
      setModalReasignar({ open: false, prospecto: null })
      setVendedorDestino("")
      await fetchData()
    } catch {
      toast.error("Error al reasignar")
    } finally {
      setReasignando(false)
    }
  }

  const cambiarEstado = async () => {
    if (!modalEstado.prospecto) return
    setGuardandoEstado(true)
    try {
      await axios.patch(
        `${API_URL}/supervisor/prospectos/${modalEstado.prospecto.id}/estado`,
        { estado: nuevoEstado, comentario: comentarioEstado },
        { headers: authHeaders }
      )
      toast.success("Estado actualizado")
      setModalEstado({ open: false, prospecto: null })
      setNuevoEstado("")
      setComentarioEstado("")
      await fetchData()
    } catch {
      toast.error("Error al cambiar estado")
    } finally {
      setGuardandoEstado(false)
    }
  }

  const verDetalle = (p: Prospecto) => {
    setBtnLoading(p.id, "detalle", true)
    setModalDetalle({ open: true, prospecto: p })
    // El modal se abre de inmediato; apagamos el spinner en el siguiente tick
    requestAnimationFrame(() => setBtnLoading(p.id, "detalle", false))
  }

  const verCotizaciones = async (p: Prospecto) => {
    setBtnLoading(p.id, "cotizaciones", true)
    setModalCotizacion({ open: true, prospecto: p })
    setLoadingCotizaciones(true)
    try {
      const { data } = await axios.get(`${API_URL}/lead/${p.id}/cotizaciones?detalles=1`, { headers: authHeaders })
      setCotizaciones(Array.isArray(data) ? data : [])
    } catch {
      setCotizaciones([])
    } finally {
      setLoadingCotizaciones(false)
      setBtnLoading(p.id, "cotizaciones", false)
    }
  }

  const abrirWhatsApp = (p: Prospecto) => {
    setBtnLoading(p.id, "whatsapp", true)
    const tel = p.numero_contacto
    if (tel) {
      const cleaned = tel.replace(/\D/g, "")
      window.open(`https://wa.me/${cleaned}`, "_blank", "noopener,noreferrer")
    } else {
      toast.info("Este prospecto no tiene número de contacto registrado")
    }
    requestAnimationFrame(() => setBtnLoading(p.id, "whatsapp", false))
  }

  const hayFiltros = filtros.busqueda || filtros.estado || filtros.vendedor || filtros.nombre || filtros.apellido || filtros.edad

  const getEstadoColor = (estado: string): string => {
    const pct: Record<string, number> = {
      "Lead": 10, "1 Contacto": 25, "Calificado Cotizacion": 50,
      "Calificado Poliza": 75, "Calificado Pago": 90, "Venta": 100
    }
    const p = pct[estado] ?? 0
    if (p === 100) return "#16a34a"
    if (p > 50)  return "#2563eb"
    if (p > 0)   return "#d97706"
    return "#dc2626"
  }

  const headerTitle =
    vista === "dashboard" ? "Dashboard Supervisor"
      : vista === "prospectos" ? "Gestión de Prospectos"
      : vista === "vendedores" ? "Mis Vendedores"
      : vista === "polizas" ? "Pólizas"
      : vista === "documentos" ? "Documentos"
      : vista === "chat" ? "Chat del equipo"
      : vista === "resumen" ? "Resumen del equipo"
      : vista === "cotizaciones" ? "Cotizaciones"
      : vista === "metricas" ? "Métricas por vendedor"
      : "Promociones"

  return (
    <DashboardShell
      roleLabel="Supervisor"
      roleBadgeLabel="Supervisión"
      logoClassName="h-7"
      userName={user?.name}
      userEmail={user?.email}
      onLogout={() => logout().then(() => navigate("/login"))}
      navContent={<SidebarNavContent vista={vista} setVista={setVista} setExportarModal={setExportarModal} />}
      headerTitle={headerTitle}
      headerActions={
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchData} aria-label="Actualizar">
          <RefreshCw className="size-4" />
        </Button>
      }
    >
        <div className="p-4 space-y-4">
          {/* DASHBOARD */}
          {vista === "dashboard" && (
            <>
              {/* Stats cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: "Total Prospectos",
                    value: estadisticas.totalProspectos ?? estadisticas.total_prospectos ?? prospectos.length,
                    icon: Users,
                    cambio: estadisticas.cambioProspectosMes,
                  },
                  {
                    label: "Vendedores Activos",
                    value: estadisticas.vendedoresActivos ?? estadisticas.totalVendedores ?? estadisticas.total_vendedores ?? vendedores.filter(v => (v as unknown as Record<string,unknown>).is_enabled !== false).length,
                    icon: UserCheck,
                    cambio: estadisticas.cambioVendedores,
                  },
                  {
                    label: "Ventas Confirmadas",
                    value: estadisticas.ventasConfirmadas ?? estadisticas.total_ventas ?? prospectos.filter(p => p.estado === "Venta").length,
                    icon: DollarSign,
                    cambio: estadisticas.cambioVentas,
                  },
                  {
                    label: "Pólizas Generadas",
                    value: estadisticas.totalPolizas ?? estadisticas.total_polizas ?? 0,
                    icon: FileText,
                    cambio: estadisticas.cambioPolizas,
                  },
                ].map(({ label, value, icon, cambio }) => (
                  <StatCard
                    key={label}
                    icon={icon}
                    label={label}
                    value={loading ? "…" : value}
                    subtitle={cambio !== undefined ? "vs. mes anterior" : undefined}
                    trend={cambio !== undefined ? { value: cambio, positive: cambio >= 0 } : null}
                  />
                ))}
              </div>

              {/* Gráfico Tendencias Mensuales */}
              <TendenciasChart
                data={datosGrafica}
                loading={loading}
                title="Tendencias Mensuales"
                description="Evolución de prospectos, vendedores, ventas y pólizas"
              />

              {/* Distribucion por estado */}
              <Card>
                <CardHeader className="pb-3">                <CardTitle className="text-base">Distribución por estado</CardTitle></CardHeader>
                <CardContent>
                  {loading ? <Skeleton className="h-32 w-full" /> : (
                    <div className="flex flex-wrap gap-2">
                      {ESTADOS.map(estado => {
                        const count = prospectos.filter(p => p.estado === estado).length
                        if (!count) return null
                        return (
                          <div key={estado} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full">
                            {getBadgeEstado(estado)}
                            <span className="text-xs font-bold">{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top vendedores */}
              {vendedores.length > 0 && (
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Rendimiento vendedores</CardTitle></CardHeader>
                  <CardContent>
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vendedor</TableHead>
                            <TableHead className="text-right">Prospectos</TableHead>
                            <TableHead className="text-right">Ventas</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {vendedores.slice(0,10).map(v => (
                            <TableRow key={v.id}>
                              <TableCell className="font-medium text-sm">
                                {v.nombre ?? `${v.first_name ?? ""} ${v.last_name ?? ""}`.trim()}
                              </TableCell>
                              <TableCell className="text-right text-sm">{v.total_prospectos ?? "-"}</TableCell>
                              <TableCell className="text-right text-sm font-semibold">{v.ventas ?? "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* PROSPECTOS */}
          {vista === "prospectos" && (
            <>
              {/* Filtros */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-end">
                <div className="relative col-span-2 sm:col-span-3 lg:flex-1 lg:min-w-[140px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Buscar..." value={filtros.busqueda} onChange={e => setFiltros({...filtros, busqueda: e.target.value})} />
                </div>
                <Input placeholder="Nombre" value={filtros.nombre} onChange={e => setFiltros({...filtros, nombre: e.target.value})} className="text-sm" />
                <Input placeholder="Apellido" value={filtros.apellido} onChange={e => setFiltros({...filtros, apellido: e.target.value})} className="text-sm" />
                <Input placeholder="Edad" type="number" min="0" value={filtros.edad} onChange={e => setFiltros({...filtros, edad: e.target.value})} className="text-sm w-24" />
                <Select value={filtros.estado} onValueChange={v => setFiltros({...filtros, estado: v})}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todos los estados" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    {ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
                {vendedores.length > 0 && (
                  <Select value={filtros.vendedor} onValueChange={v => setFiltros({...filtros, vendedor: v})}>
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder="Todos los vendedores" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {vendedores.map(v => (
                        <SelectItem key={v.id} value={String(v.id)}>
                          {v.nombre ?? `${v.first_name ?? ""} ${v.last_name ?? ""}`.trim()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {hayFiltros && (
                  <Button variant="ghost" size="sm" onClick={() => setFiltros({ busqueda:"", estado:"", vendedor:"", nombre:"", apellido:"", edad:"" })}>
                    <X className="size-4 mr-1" />Limpiar
                  </Button>
                )}
              </div>

              <p className="text-sm text-muted-foreground">{prospectosFiltrados.length} prospectos</p>

              {loading ? <Skeleton className="h-64 w-full rounded-xl" /> : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">ID</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="hidden lg:table-cell">Contacto</TableHead>
                        <TableHead className="hidden xl:table-cell">Edad</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="hidden md:table-cell">Vendedor</TableHead>
                        <TableHead className="w-40">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prospectosFiltrados.map(p => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs font-bold">{p.id}</Badge>
                          </TableCell>
                          <TableCell>
                            <p className="font-semibold text-sm">{p.nombre} {p.apellido}</p>
                            {p.correo && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{p.correo}</p>}
                            <p className="text-xs text-muted-foreground md:hidden">{p.vendedor_nombre ?? ""}</p>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {p.numero_contacto && <p className="font-medium text-sm">{p.numero_contacto}</p>}
                            {p.localidad && <p className="text-xs text-muted-foreground">{p.localidad}</p>}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {p.edad ? <Badge variant="secondary">{p.edad} años</Badge> : "-"}
                          </TableCell>
                          <TableCell>
                            <button
                              className="text-xs font-medium px-2 py-1 rounded border border-current hover:opacity-80 transition-opacity whitespace-nowrap"
                              style={{ color: getEstadoColor(p.asignacion_estado ?? p.estado) }}
                              onClick={() => { setModalEstado({ open: true, prospecto: p }); setNuevoEstado(p.asignacion_estado ?? p.estado) }}
                            >
                              {p.asignacion_estado ?? p.estado}
                            </button>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {p.vendedor_nombre ?? "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              <Button variant="outline" size="icon" className="h-7 w-7"
                                title="Ver detalle" disabled={isBtnLoading(p.id, "detalle")} onClick={() => verDetalle(p)}>
                                {isBtnLoading(p.id, "detalle") ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
                              </Button>
                              <Button variant="outline" size="icon" className="h-7 w-7 hidden lg:inline-flex"
                                title="Ver historial" disabled={isBtnLoading(p.id, "historial")} onClick={() => verHistorial(p)}>
                                {isBtnLoading(p.id, "historial") ? <Loader2 className="size-3.5 animate-spin" /> : <UserCheck className="size-3.5" />}
                              </Button>
                              <Button variant="outline" size="icon" className="h-7 w-7 hidden xl:inline-flex"
                                title="Ver cotizaciones" disabled={isBtnLoading(p.id, "cotizaciones")} onClick={() => verCotizaciones(p)}>
                                {isBtnLoading(p.id, "cotizaciones") ? <Loader2 className="size-3.5 animate-spin" /> : <DollarSign className="size-3.5" />}
                              </Button>
                              <Button variant="outline" size="icon" className="h-7 w-7"
                                title="Reasignar vendedor" onClick={() => setModalReasignar({ open: true, prospecto: p })}>
                                <ArrowRightLeft className="size-3.5" />
                              </Button>
                              <Button variant="outline" size="icon" className="h-7 w-7 text-green-600 hover:bg-green-50 hidden lg:inline-flex"
                                title="WhatsApp" disabled={isBtnLoading(p.id, "whatsapp")} onClick={() => abrirWhatsApp(p)}>
                                {isBtnLoading(p.id, "whatsapp") ? <Loader2 className="size-3.5 animate-spin" /> : <MessageCircle className="size-3.5" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {prospectosFiltrados.length === 0 && (
                    <div className="text-center py-12 text-sm text-muted-foreground">Sin prospectos</div>
                  )}
                </div>
              )}
            </>
          )}

          {/* VENDEDORES */}
          {vista === "vendedores" && <SupervisorVendedoresView />}
          {vista === "metricas" && <MetricasVendedorView />}

          {vista === "polizas" && <SupervisorPolizasView />}
          {vista === "documentos" && <SupervisorDocumentosView onIrAPolizas={() => setVista("polizas")} />}
          {vista === "chat" && <SupervisorChatView />}
          {vista === "resumen" && <SupervisorResumenView />}
          {vista === "cotizaciones" && <SupervisorCotizacionesPorUsuario />}
          {vista === "promociones" && <SupervisorPromocionesView />}
        </div>

      {/* Modal reasignar */}
      <Dialog open={modalReasignar.open} onOpenChange={(open: boolean) => setModalReasignar({ open, prospecto: open ? modalReasignar.prospecto : null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reasignar prospecto</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {modalReasignar.prospecto?.nombre} {modalReasignar.prospecto?.apellido}
          </p>
          <div className="space-y-1">
            <Label>Nuevo vendedor</Label>
            <Select value={vendedorDestino} onValueChange={setVendedorDestino}>
              <SelectTrigger><SelectValue placeholder="Seleccionar vendedor" /></SelectTrigger>
              <SelectContent>
                {vendedores.map(v => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.nombre ?? `${v.first_name ?? ""} ${v.last_name ?? ""}`.trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalReasignar({ open: false, prospecto: null })}>Cancelar</Button>
            <Button onClick={reasignar} disabled={!vendedorDestino || reasignando}>
              {reasignando ? "Reasignando..." : "Reasignar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal cambiar estado */}
      <Dialog open={modalEstado.open} onOpenChange={(open: boolean) => setModalEstado({ open, prospecto: open ? modalEstado.prospecto : null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar estado</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {modalEstado.prospecto?.nombre} {modalEstado.prospecto?.apellido}
          </p>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nuevo estado</Label>
              <Select value={nuevoEstado} onValueChange={setNuevoEstado}>
                <SelectTrigger><SelectValue placeholder="Seleccionar estado" /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Comentario</Label>
              <Textarea value={comentarioEstado} onChange={e => setComentarioEstado(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEstado({ open: false, prospecto: null })}>Cancelar</Button>
            <Button onClick={cambiarEstado} disabled={!nuevoEstado || guardandoEstado}>
              {guardandoEstado ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal historial */}
      <Dialog open={modalHistorial.open} onOpenChange={(open: boolean) => setModalHistorial(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-xl lg:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Historial - {modalHistorial.prospecto?.nombre} {modalHistorial.prospecto?.apellido}
            </DialogTitle>
          </DialogHeader>
          {modalHistorial.items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin historial</p>
          ) : (
            <div className="space-y-2">
              {(modalHistorial.items as Record<string, unknown>[]).map((h, i) => (
                <div key={i} className="p-3 border rounded-lg text-sm">
                  <p className="font-medium">{h.accion as string ?? h.descripcion as string ?? "Accion"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {h.usuario as string ? `${h.usuario} - ` : ""}
                    {h.created_at ? new Date(h.created_at as string).toLocaleString("es-AR") : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal carga múltiple documentos (autocontenido con Dialog interno) */}
      <CargaMultipleDocumentos
        polizaId={cargaDocumentosModal.polizaId ?? 0}
        open={cargaDocumentosModal.open}
        onOpenChange={(open) => { if (!open) setCargaDocumentosModal({ open: false, polizaId: null }) }}
      />

      {/* Modal detalle prospecto */}
      <Dialog open={modalDetalle.open} onOpenChange={open => setModalDetalle(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modalDetalle.prospecto?.nombre} {modalDetalle.prospecto?.apellido}</DialogTitle>
          </DialogHeader>
          {modalDetalle.prospecto && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {([
                { label: "ID", value: modalDetalle.prospecto.id },
                { label: "Estado", value: modalDetalle.prospecto.asignacion_estado ?? modalDetalle.prospecto.estado },
                { label: "Edad", value: modalDetalle.prospecto.edad ? `${modalDetalle.prospecto.edad} años` : "-" },
                { label: "DNI", value: modalDetalle.prospecto.dni ?? "-" },
                { label: "Teléfono", value: modalDetalle.prospecto.numero_contacto ?? "-" },
                { label: "Localidad", value: modalDetalle.prospecto.localidad ?? "-" },
                { label: "Email", value: modalDetalle.prospecto.correo ?? "-" },
                { label: "Vendedor", value: modalDetalle.prospecto.vendedor_nombre ?? "-" },
              ] as { label: string; value: string | number }[]).map(({ label, value }) => (
                <div key={label} className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-medium">{String(value)}</p>
                </div>
              ))}
              {modalDetalle.prospecto.comentario && (
                <div className="col-span-2 space-y-0.5">
                  <p className="text-xs text-muted-foreground">Comentario</p>
                  <p className="text-sm">{modalDetalle.prospecto.comentario}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalDetalle({ open: false, prospecto: null })}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal cotizaciones */}
      <Dialog open={modalCotizacion.open} onOpenChange={open => setModalCotizacion(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cotizaciones - {modalCotizacion.prospecto?.nombre} {modalCotizacion.prospecto?.apellido}</DialogTitle>
          </DialogHeader>
          {loadingCotizaciones ? (
            <Skeleton className="h-32 w-full" />
          ) : cotizaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin cotizaciones registradas</p>
          ) : (
            <div className="space-y-3">
              {(cotizaciones as Record<string, unknown>[]).map((c, i) => {
                const planNombre = c.plan_nombre as string | undefined
                const tipoAfil = c.tipo_afiliacion_nombre as string | undefined
                const totalFinal = c.total_final as number | undefined
                const fecha = c.fecha as string | undefined
                return (
                  <div key={i} className="border rounded-lg p-3 text-sm space-y-1">
                    <p className="font-semibold">{planNombre ?? `Plan ${i + 1}`}</p>
                    {tipoAfil && <p className="text-muted-foreground">{tipoAfil}</p>}
                    {totalFinal != null && (
                      <p className="font-bold">
                        ${totalFinal.toLocaleString("es-AR")} / mes
                      </p>
                    )}
                    {fecha && <p className="text-xs text-muted-foreground">{new Date(fecha).toLocaleDateString("es-AR")}</p>}
                  </div>
                )
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalCotizacion({ open: false, prospecto: null })}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal exportación */}
      <ModalExportacion
        open={exportarModal}
        onOpenChange={setExportarModal}
        userRole="supervisor"
      />
    </DashboardShell>
  )
}
