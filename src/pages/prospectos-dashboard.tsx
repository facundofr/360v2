import * as React from "react"
import { useEffect, useState, useMemo, useCallback, startTransition, lazy } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import axios from "axios"
import { toast } from "sonner"
import ThemeToggle from "@/components/common/theme-toggle"
import { useConfirm } from "@/components/common/confirm-dialog"
import { useSidebar } from "@/components/ui/sidebar"
import Logo from "@/components/ui/logo"
import {
  PlusIcon, LayoutListIcon, LayoutGridIcon, UserIcon,
  Search, Eye, LogOut, TrendingUp, DollarSign, FileText,
  Trophy, Flame, Star, ChevronRight, MessageSquare, RefreshCw, MessageCircle,
  Phone, History, Tag, X as XIcon, Loader2,
  CheckCircle2, AlertTriangle,
  ClipboardList
} from "lucide-react"
import { ChatVendedor } from "@/features/vendedor/components/ChatVendedor"
import CargaDocumentosModal from "@/components/modals/CargaDocumentosModal"

const WhatsAppVista = lazy(() => import("@/features/vendedor/components/WhatsAppVista").then(m => ({ default: m.WhatsAppVista })))
const EditarPolizaModal = lazy(() => import("@/features/vendedor/components/EditarPolizaModal").then(m => ({ default: m.EditarPolizaModal })))
const PromocionesModal = lazy(() => import("@/features/vendedor/components/PromocionesModal").then(m => ({ default: m.PromocionesModal })))
const DocumentosPolizaModal = lazy(() => import("@/features/vendedor/components/DocumentosPolizaModal").then(m => ({ default: m.DocumentosPolizaModal })))
const SubirDocumentosLibresModal = lazy(() => import("@/features/vendedor/components/SubirDocumentosLibresModal").then(m => ({ default: m.SubirDocumentosLibresModal })))
const PolizasDashboard = lazy(() => import("@/features/vendedor/components/PolizasDashboard"))
import {
  SidebarProvider, Sidebar, SidebarContent, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger,
  SidebarInset, SidebarFooter
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatCard } from "@/components/common/StatCard"
import { useTecladoRegistro } from "@/hooks/useTecladoRegistro"
import { Trabado } from "@/components/common/Trabado"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/ui/data-table"
import type { ColumnDef } from "@tanstack/react-table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { useNotifications } from "@/contexts/NotificationContext"
import { getBadgeEstado } from "@/utils/estadosHelper"
import { estadosConfig, etapaDe, trabadoEn, ETAPAS, type Etapa } from "@/utils/estados"
import { ENDPOINTS, API_URL } from "@/lib/config"
import ModalExportacion from "@/components/modals/ModalExportacion"
import { getAuthToken } from "@/lib/auth"
import { maskPhone, maskEmail } from "@/lib/mask"

// --- Constantes ---------------------------------------------------------------

// Antes tenía 17 valores, 7 sin tilde/ordinal (ej. "Calificado Cotizacion")
// contra el whitelist real de 27 de `prospectoController.js` (vendedor) — el
// PUT de estado devolvía 400 para esos 7, y el filtro de estado nunca
// matcheaba contra el valor real acentuado. También faltaban 10 estados reales.
const ESTADOS = [...Object.keys(estadosConfig), "prueba interna"]

const CATEGORIAS_MONOTRIBUTO = ["A","B","C","D","E","F","G","H","I","J","K","A exento","B exento"]

const VINCULOS = [
  { value: "pareja/conyuge", label: "Pareja/Conyuge" },
  { value: "hijo/a", label: "Hijo/a" },
  { value: "familiar a cargo", label: "Familiar a cargo" },
]

const ESTADO_PROGRESO: Record<string, number> = {
  "Lead": 10, "1º Contacto": 25, "Calificado Cotización": 50,
  "Calificado Póliza": 75, "Calificado Pago": 90, "Venta": 100,
}

// --- Tipos --------------------------------------------------------------------

interface Prospecto {
  id: number
  nombre: string
  apellido: string
  dni?: string
  edad: number
  tipo_afiliacion_id?: number
  sueldo_bruto?: string
  categoria_monotributo?: string
  estado: string
  comentario?: string
  numero_contacto?: string
  correo?: string
  localidad?: string
  updated_at?: string
  created_at?: string
  gecros_estado?: string
  es_reciclado?: number
  visible_refrito?: number
  preferencia_contacto?: string
  origen?: string
  validado?: number
  fecha_hora_registro?: string
  fecha_registro?: string
}

interface TipoAfiliacion {
  id: number
  etiqueta: string
  requiere_sueldo: number
  requiere_categoria: number
}

interface Familiar {
  vinculo: string
  nombre: string
  edad: string
  tipo_afiliacion_id: string
  sueldo_bruto: string
  categoria_monotributo: string
}

/** Columnas reales de `historial_acciones` (`historialModel.js`): no existen
 * `usuario`/`created_at`/`estado_anterior`/`estado_nuevo` — el autor sale del
 * JOIN con `users` como `first_name`/`last_name`, y la fecha es `fecha`. */
interface HistorialItem {
  id?: number
  accion?: string
  descripcion?: string
  first_name?: string
  last_name?: string
  fecha?: string
}

interface Poliza {
  id: number
  numero_poliza_oficial?: string
  numero_poliza?: string
  prospecto_nombre?: string
  prospecto_apellido?: string
  plan_nombre?: string
  total_final?: number
  estado?: string
  created_at?: string
  pdf_hash?: string
  requiere_auditoria_medica?: boolean
  prospecto_telefono?: string
  prospecto_email?: string
  prospecto_localidad?: string
  prospecto_edad?: number
}

// --- Helpers ------------------------------------------------------------------


/** Prospectos por página en el listado (igual que producción). */
const PROSPECTOS_POR_PAGINA = 20

const FILTROS_VACIOS = {
  nombre: "", apellido: "", edad: "", estado: "",
  origen: "", fechaDesde: "", fechaHasta: "", horaDesde: "", horaHasta: "",
}

/** Fecha/hora de llegada real del prospecto. */
function getFechaLlegada(p: Prospecto): Date | null {
  const fecha = p.fecha_hora_registro ?? p.fecha_registro
  if (!fecha) return null
  const d = new Date(fecha)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Orden de la cola de trabajo del vendedor. Réplica exacta de producción
 * (`ProspectosDashboard.jsx:445-466`). NO reemplazar por un sort por id:
 * el orden es una regla de negocio, no una preferencia de presentación.
 *
 *   1. Refrito visible en cola (reciclado + visible + estado "Lead")
 *   2. Prioridad: Super Lead (origen "flujo-wss") + validado por WhatsApp
 *   3. Fecha real de registro, descendente
 *   4. Id descendente como desempate
 */
function ordenarProspectos(prospectos: Prospecto[]): Prospecto[] {
  return [...prospectos].sort((a, b) => {
    const aEsRefritoVisible = a.es_reciclado === 1 && a.visible_refrito === 1 && a.estado === "Lead"
    const bEsRefritoVisible = b.es_reciclado === 1 && b.visible_refrito === 1 && b.estado === "Lead"
    if (aEsRefritoVisible && !bEsRefritoVisible) return -1
    if (!aEsRefritoVisible && bEsRefritoVisible) return 1

    const aPrioridad = (a.origen === "flujo-wss" ? 1 : 0) + (a.validado === 1 ? 1 : 0)
    const bPrioridad = (b.origen === "flujo-wss" ? 1 : 0) + (b.validado === 1 ? 1 : 0)
    if (bPrioridad !== aPrioridad) return bPrioridad - aPrioridad

    const fechaA = new Date(a.fecha_hora_registro ?? a.fecha_registro ?? 0).getTime()
    const fechaB = new Date(b.fecha_hora_registro ?? b.fecha_registro ?? 0).getTime()
    if (fechaA !== fechaB) return fechaB - fechaA

    return (b.id ?? 0) - (a.id ?? 0)
  })
}

function calcGamingStats(prospectos: Prospecto[]) {
  const hoy = new Date().toDateString()
  const inicioSemana = new Date()
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())
  const inicioMes = new Date()
  inicioMes.setDate(1)

  const ventas = prospectos.filter(p => p.estado === "Venta")
  const ventasHoy = ventas.filter(p => p.updated_at && new Date(p.updated_at).toDateString() === hoy).length
  const ventasSemana = ventas.filter(p => p.updated_at && new Date(p.updated_at) >= inicioSemana).length
  const ventasMes = ventas.filter(p => p.updated_at && new Date(p.updated_at) >= inicioMes).length

  let puntuacion = 0
  prospectos.forEach(p => {
    const pts: Record<string, number> = {
      "Venta": 100, "Calificado Pago": 75, "Calificado Póliza": 50,
      "Calificado Cotización": 25, "1º Contacto": 10
    }
    puntuacion += pts[p.estado] ?? 5
  })

  const nivel = Math.floor(puntuacion / 500) + 1
  const experiencia = puntuacion % 500

  const ventasPorDia: Record<string, number> = {}
  ventas.forEach(p => {
    if (!p.updated_at) return
    const fecha = new Date(p.updated_at).toDateString()
    ventasPorDia[fecha] = (ventasPorDia[fecha] ?? 0) + 1
  })
  const fechas = Object.keys(ventasPorDia).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  let streakActual = 0, mejorStreak = 0, racha = 0
  for (let i = 0; i < fechas.length; i++) {
    const curr = new Date(fechas[i]).getTime()
    const prev = i > 0 ? new Date(fechas[i - 1]).getTime() : null
    if (prev === null || (prev - curr) / 86400000 === 1) {
      racha++
      if (i === 0) streakActual = racha
    } else {
      mejorStreak = Math.max(mejorStreak, racha)
      racha = 1
    }
  }
  mejorStreak = Math.max(mejorStreak, racha)

  const totalVentas = ventas.length
  const totalProspectos = prospectos.length
  const logros: string[] = []
  if (totalVentas >= 1) logros.push("Primera Venta")
  if (totalVentas >= 5) logros.push("Vendedor Junior")
  if (totalVentas >= 10) logros.push("Vendedor Experto")
  if (totalVentas >= 25) logros.push("Vendedor Master")
  if (totalVentas >= 50) logros.push("Vendedor Legendario")
  if (mejorStreak >= 3) logros.push("En Racha")
  if (mejorStreak >= 7) logros.push("Imparable")
  if (totalProspectos >= 50) logros.push("Gran Prospector")
  if (totalProspectos >= 100) logros.push("Super Prospector")

  return { nivel, experiencia, ventasHoy, ventasSemana, ventasMes, streakActual, mejorStreak, puntuacion, logros, totalVentas, totalProspectos }
}

const getHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` })

// --- Mobile controls ---------------------------------------------------------

function VendedorMobileControls() {
  const { setOpenMobile } = useSidebar()
  return (
    <div className="flex flex-col items-end gap-1">
      <ThemeToggle size="icon" variant="ghost" className="shrink-0 size-7" />
      <Button variant="ghost" size="icon" className="md:hidden size-7" onClick={() => setOpenMobile(false)} aria-label="Cerrar">
        <XIcon className="size-4" />
      </Button>
    </div>
  )
}

interface SidebarNavContentProps {
  vistaActual: "prospectos" | "polizas" | "whatsapp"
  setVistaActual: React.Dispatch<React.SetStateAction<"prospectos" | "polizas" | "whatsapp">>
  gaming: ReturnType<typeof calcGamingStats>
  setExportarModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowNuevo: React.Dispatch<React.SetStateAction<boolean>>
}

function SidebarNavContent({ vistaActual, setVistaActual, gaming, setExportarModal, setShowNuevo }: SidebarNavContentProps) {
  const { setOpenMobile } = useSidebar()
  const { whatsappUnread } = useNotifications()
  return (
    <SidebarContent className="pt-2">
      <SidebarMenu>
        {([
          { id: "prospectos", label: "Dashboard Prospectos", icon: UserIcon,               desc: "Gestión de leads" },
          { id: "polizas", label: "Mis Pólizas", icon: FileText, desc: "Pólizas generadas" },
          { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, desc: "Chat con prospectos" },
        ] as { id: string; label: string; icon: React.ElementType; desc: string }[]).map(v => {
          const Icon = v.icon
          const active = vistaActual === v.id
          const isWhatsapp = v.id === "whatsapp"
          return (
            <SidebarMenuItem key={v.id}>
              <SidebarMenuButton
                isActive={active}
                onClick={() => { setVistaActual(v.id as typeof vistaActual); setOpenMobile(false) }}
                className="h-auto py-2 px-3 group"
              >
                <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary")}>
                  <Icon className="size-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-tight">{v.label}</p>
                  <p className="text-[10.5px] text-muted-foreground">{v.desc}</p>
                </div>
                {isWhatsapp && whatsappUnread > 0 && (
                  <Badge variant="destructive" className="text-[10.5px] h-4 min-w-4 px-1 rounded-full">
                    {whatsappUnread > 99 ? "99+" : whatsappUnread}
                  </Badge>
                )}
                {active && !isWhatsapp && <ChevronRight className="size-3 text-muted-foreground" />}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>

      <Separator className="my-3" />

      {/* Exportar - acción rápida */}
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => setExportarModal(true)}
            className="h-auto py-2 px-3 group"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary transition-colors">
              <FileText className="size-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium leading-tight">Exportar</p>
              <p className="text-[10.5px] text-muted-foreground">Descargar datos</p>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <Separator className="my-3" />

      {/* Nuevo Prospecto - acción rápida */}
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => setShowNuevo(true)}
            className="h-auto py-2 px-3 group"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <PlusIcon className="size-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium leading-tight">Nuevo Prospecto</p>
              <p className="text-[10.5px] text-muted-foreground">Registrar lead</p>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <Separator className="my-3" />

      {/* Gaming stats */}
      <div className="px-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Mis metricas</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Hoy", value: gaming.ventasHoy, icon: <TrendingUp className="size-3" /> },
            { label: "Este mes", value: gaming.ventasMes, icon: <Star className="size-3" /> },
            { label: "Nivel", value: gaming.nivel, icon: <Trophy className="size-3" /> },
            { label: "Puntos", value: gaming.puntuacion, icon: <Flame className="size-3" /> },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-muted rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                {icon}<span className="text-[10.5px]">{label}</span>
              </div>
              <p className="font-bold text-sm">{value}</p>
            </div>
          ))}
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Nivel {gaming.nivel}</span>
            <span>{gaming.experiencia}/500 XP</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${(gaming.experiencia / 500) * 100}%` }} />
          </div>
        </div>
        {gaming.streakActual > 0 && (
          <div className="rounded-lg bg-state-ok-soft border border-state-ok/30 p-2 text-center">
            <p className="text-xs text-state-ok-text">Racha: {gaming.streakActual} dias</p>
          </div>
        )}
        {gaming.logros.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10.5px] font-semibold text-muted-foreground uppercase">Logros</p>
            <div className="flex flex-wrap gap-1">
              {gaming.logros.slice(-3).map((l, i) => (
                <span key={i} className="text-[10.5px] bg-state-ok-soft text-state-ok-text rounded px-1.5 py-0.5">{l}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </SidebarContent>
  )
}

// --- Pagina principal ---------------------------------------------------------

export default function ProspectosDashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const confirmar = useConfirm()

  const [prospectos, setProspectos] = useState<Prospecto[]>([])
  const [tiposAfiliacion, setTiposAfiliacion] = useState<TipoAfiliacion[]>([])
  const [localidades, setLocalidades] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [vistaActual, setVistaActual] = useState<"prospectos" | "polizas" | "whatsapp">("prospectos")
  const [tipoVista, setTipoVista] = useState<"tabla" | "tarjetas">("tarjetas")
  const [filtros, setFiltrosState] = useState(FILTROS_VACIOS)
  const [ordenLeads, setOrdenLeadsState] = useState<"llegada_asc" | "llegada_desc">("llegada_asc")
  const [paginaActual, setPaginaActual] = useState(1)

  // Cambiar filtros u orden siempre vuelve a la página 1: si el usuario está en
  // la página 5 y filtra a 12 resultados, quedaría mirando una página vacía.
  const setFiltros = useCallback((nuevos: typeof FILTROS_VACIOS) => {
    setFiltrosState(nuevos)
    setPaginaActual(1)
  }, [])
  const setOrdenLeads = useCallback((orden: "llegada_asc" | "llegada_desc") => {
    setOrdenLeadsState(orden)
    setPaginaActual(1)
  }, [])

  // Polizas
  const [polizas, setPolizas] = useState<Poliza[]>([])
  const [loadingPolizas, setLoadingPolizas] = useState(false)
  const [editarPolizaId, setEditarPolizaId] = useState<number | null>(null)
  const [cargaDocModal, setCargaDocModal] = useState<{ open: boolean; polizaId: number | null }>({ open: false, polizaId: null })
  const [documentosModal, setDocumentosModal] = useState<{ open: boolean; poliza: Poliza | null }>({ open: false, poliza: null })
  const [docLibresModal, setDocLibresModal] = useState<{ open: boolean; poliza: Poliza | null }>({ open: false, poliza: null })
  const [exportarModal, setExportarModal] = useState(false)

  // Modal crear prospecto
  const [showNuevo, setShowNuevo] = useState(false)
  const [resultadoAlta, setResultadoAlta] = useState<{
    open: boolean
    tipo: "reasignado" | "en-gestion"
    prospectoId?: number
    diasEstancado?: number
    estadoActual?: string
    vendedores: string[]
  }>({ open: false, tipo: "reasignado", vendedores: [] })
  const [formNuevo, setFormNuevo] = useState({
    nombre: "", apellido: "", dni: "", edad: "",
    tipo_afiliacion_id: "", sueldo_bruto: "", categoria_monotributo: "",
    numero_contacto: "", correo: "", localidad: "",
    estado: "Lead", comentario: ""
  })
  const [familiares, setFamiliares] = useState<Familiar[]>([])
  const [nuevoFamiliar, setNuevoFamiliar] = useState<Familiar>({
    vinculo: "", nombre: "", edad: "", tipo_afiliacion_id: "", sueldo_bruto: "", categoria_monotributo: ""
  })
  const [guardando, setGuardando] = useState(false)

  // Modal historial
  const [historialModal, setHistorialModal] = useState<{
    open: boolean; prospecto: Prospecto | null; items: HistorialItem[]; loading: boolean
  }>({ open: false, prospecto: null, items: [], loading: false })

  // Modal promociones
  const [promoModal, setPromoModal] = useState<{ open: boolean; prospectoId: number | null }>({ open: false, prospectoId: null })

  // --- Fetch --------------------------------------------------------------

  const fetchProspectos = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(ENDPOINTS.PROSPECTOS, { headers: getHeaders() })
      setProspectos(ordenarProspectos(data as Prospecto[]))
    } catch {
      toast.error("No se pudieron cargar los prospectos")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPolizas = useCallback(async () => {
    setLoadingPolizas(true)
    try {
      const { data } = await axios.get(`${API_URL}/polizas/vendedor/mis-polizas`, { headers: getHeaders() })
      setPolizas((data as { data?: Poliza[] })?.data ?? (data as Poliza[]) ?? [])
    } catch {
      toast.error("Error al cargar polizas")
    } finally {
      setLoadingPolizas(false)
    }
  }, [])

  useEffect(() => {
    startTransition(() => setLoading(true))
    const init = async () => {
      try {
        const { data } = await axios.get(ENDPOINTS.PROSPECTOS, { headers: getHeaders() })
        setProspectos(ordenarProspectos(data as Prospecto[]))
      } catch {
        toast.error("No se pudieron cargar los prospectos")
      } finally {
        setLoading(false)
      }
    }
    init()
    axios.get(ENDPOINTS.TIPOS_AFILIACION).then(r => setTiposAfiliacion(r.data as TipoAfiliacion[])).catch(() => {})
    axios.get(`${API_URL}/localidades/buenos-aires`).then(r => {
      const locs = (r.data as { nombre?: string; localidad?: string }[])
        .map(l => l.nombre ?? l.localidad ?? "")
        .filter(Boolean)
      setLocalidades(locs)
    }).catch(() => {})
  }, [])

  // Leer location.state para navegar a vista específica o abrir modal
  useEffect(() => {
    const state = location.state as { vista?: string; openNuevo?: boolean } | null
    startTransition(() => {
      if (state?.vista === "polizas") setVistaActual("polizas")
      else if (state?.vista === "whatsapp") setVistaActual("whatsapp")
      else if (state?.vista === "prospectos") setVistaActual("prospectos")
      if (state?.openNuevo) setShowNuevo(true)
    })
    // Limpiar state para evitar re-triggers al refrescar
    if (state) window.history.replaceState({}, "")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (vistaActual !== "polizas") return
    const doFetch = async () => {
      setLoadingPolizas(true)
      try {
        const { data } = await axios.get(`${API_URL}/polizas/vendedor/mis-polizas`, { headers: getHeaders() })
        setPolizas((data as { data?: Poliza[] })?.data ?? (data as Poliza[]) ?? [])
      } catch {
        toast.error("Error al cargar polizas")
      } finally {
        setLoadingPolizas(false)
      }
    }
    doFetch()
  }, [vistaActual])

  // --- Gaming -------------------------------------------------------------

  const gaming = useMemo(() => calcGamingStats(prospectos), [prospectos])

  // --- Filtros -------------------------------------------------------------

  const prospectosFiltrados = useMemo(() => {
    return prospectos.filter(p => {
      if (filtros.nombre && !p.nombre.toLowerCase().includes(filtros.nombre.toLowerCase())) return false
      if (filtros.apellido && !p.apellido.toLowerCase().includes(filtros.apellido.toLowerCase())) return false
      if (filtros.edad && String(p.edad) !== filtros.edad) return false
      if (filtros.estado && filtros.estado !== "todos" && !p.estado.toLowerCase().includes(filtros.estado.toLowerCase())) return false

      // Origen: "reciclado" / "nuevo" son casos especiales; el resto matchea
      // contra el campo `origen` por substring (igual que producción).
      if (filtros.origen && filtros.origen !== "todos") {
        if (filtros.origen === "reciclado") {
          if (p.es_reciclado !== 1) return false
        } else if (filtros.origen === "nuevo") {
          if (p.es_reciclado === 1) return false
        } else if (!(p.origen ?? "").toLowerCase().includes(filtros.origen.toLowerCase())) {
          return false
        }
      }

      // Rango de fecha y hora de llegada. Se compara en horario local para que
      // coincida con lo que muestran los inputs `date` y `time`.
      const llegada = getFechaLlegada(p)
      if (filtros.fechaDesde || filtros.fechaHasta) {
        if (!llegada) return false
        const fechaLocal = `${llegada.getFullYear()}-${String(llegada.getMonth() + 1).padStart(2, "0")}-${String(llegada.getDate()).padStart(2, "0")}`
        if (filtros.fechaDesde && fechaLocal < filtros.fechaDesde) return false
        if (filtros.fechaHasta && fechaLocal > filtros.fechaHasta) return false
      }
      if (filtros.horaDesde || filtros.horaHasta) {
        if (!llegada) return false
        const horaLocal = `${String(llegada.getHours()).padStart(2, "0")}:${String(llegada.getMinutes()).padStart(2, "0")}`
        if (filtros.horaDesde && horaLocal < filtros.horaDesde) return false
        if (filtros.horaHasta && horaLocal > filtros.horaHasta) return false
      }

      return true
    })
  }, [prospectos, filtros])

  /**
   * Orden de la vista: por fecha de llegada, ascendente por defecto (el lead
   * que más esperó, primero). Se aplica sobre los filtrados, igual que
   * `prospectosOrdenadosVista` en producción.
   */
  const prospectosOrdenados = useMemo(() => {
    return [...prospectosFiltrados].sort((a, b) => {
      const fa = getFechaLlegada(a)?.getTime() ?? 0
      const fb = getFechaLlegada(b)?.getTime() ?? 0
      return ordenLeads === "llegada_asc" ? fa - fb : fb - fa
    })
  }, [prospectosFiltrados, ordenLeads])

  const totalPaginas = Math.max(1, Math.ceil(prospectosOrdenados.length / PROSPECTOS_POR_PAGINA))
  const paginaSegura = Math.min(paginaActual, totalPaginas)
  const prospectosPaginados = useMemo(
    () => prospectosOrdenados.slice((paginaSegura - 1) * PROSPECTOS_POR_PAGINA, paginaSegura * PROSPECTOS_POR_PAGINA),
    [prospectosOrdenados, paginaSegura]
  )


  /* ── Selección y agrupación por etapa ─────────────────────────────────────
     El registro se agrupa por etapa del embudo: la posición en la lista
     codifica la posición en el embudo. La etapa ACTIVA es la primera con
     asientos que no sea "Descartado" — es donde el vendedor tiene trabajo
     vivo más temprano en el embudo, o sea por dónde empezar.               */

  const [marcados, setMarcados] = useState<Set<number>>(() => new Set())

  /* Al cambiar de página o de filtro, lo marcado deja de estar a la vista:
     mantenerlo sería actuar sobre asientos que el usuario ya no ve. */
  useEffect(() => { setMarcados(new Set()) }, [paginaSegura, prospectosFiltrados.length])

  const marcarUno = useCallback((id: number, marcado: boolean) => {
    setMarcados(prev => {
      const next = new Set(prev)
      if (marcado) next.add(id); else next.delete(id)
      return next
    })
  }, [])

  const marcarTodos = useCallback((marcado: boolean) => {
    setMarcados(marcado ? new Set(prospectosPaginados.map(p => p.id)) : new Set())
  }, [prospectosPaginados])

  const todosMarcados = prospectosPaginados.length > 0 && marcados.size === prospectosPaginados.length
  const algunoMarcado = marcados.size > 0 && !todosMarcados

  const gruposPorEtapa = useMemo(() => {
    const base = (paginaSegura - 1) * PROSPECTOS_POR_PAGINA
    const porEtapa = new Map<Etapa, { p: Prospecto; folio: number }[]>()
    prospectosPaginados.forEach((p, i) => {
      const etapa = etapaDe(p.estado)
      const lista = porEtapa.get(etapa) ?? []
      lista.push({ p, folio: base + i + 1 })
      porEtapa.set(etapa, lista)
    })
    return ETAPAS.filter(e => porEtapa.has(e)).map(e => ({ etapa: e, filas: porEtapa.get(e)! }))
  }, [prospectosPaginados, paginaSegura])

  const etapaActiva = gruposPorEtapa.find(g => g.etapa !== "Descartado")?.etapa

  /* El turno completo se trabaja sin mouse: `/` al buscador, J/K por asiento. */
  useTecladoRegistro(tipoVista === "tarjetas")

  const hayFiltros = Boolean(
    filtros.nombre || filtros.apellido || filtros.edad ||
    (filtros.estado && filtros.estado !== "todos") ||
    (filtros.origen && filtros.origen !== "todos") ||
    filtros.fechaDesde || filtros.fechaHasta || filtros.horaDesde || filtros.horaHasta
  )
  const limpiarFiltros = () => setFiltros(FILTROS_VACIOS)

  // --- Guardar cambio inline -----------------------------------------------

  const guardarCambioProspecto = useCallback(async (prospecto: Prospecto, campo: string, valor: string) => {
    const valorActual = (prospecto as unknown as Record<string, unknown>)[campo] ?? ""
    if (String(valor ?? "").trim() === String(valorActual ?? "").trim()) return
    try {
      await axios.put(
        `${ENDPOINTS.PROSPECTOS}/${prospecto.id}`,
        { ...prospecto, [campo]: valor },
        { headers: getHeaders() }
      )
      toast.success(`${campo === "estado" ? "Estado" : "Comentario"} actualizado`)
      await fetchProspectos()
    } catch {
      toast.error("Error al guardar el cambio")
    }
  }, [fetchProspectos])

  // --- Crear prospecto -----------------------------------------------------

  const crearProspecto = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    try {
      const payload = {
        ...formNuevo,
        familiares: familiares.map(f => ({
          vinculo: f.vinculo,
          nombre: f.nombre,
          edad: f.edad ? Number(f.edad) : null,
          tipo_afiliacion_id: f.tipo_afiliacion_id ? Number(f.tipo_afiliacion_id) : null,
          sueldo_bruto: f.sueldo_bruto ? Number(f.sueldo_bruto) : null,
          categoria_monotributo: f.categoria_monotributo || null,
        }))
      }
      const { data } = await axios.post(ENDPOINTS.PROSPECTOS, payload, { headers: getHeaders() })

      // El backend distingue tres desenlaces y el vendedor necesita saber cuál
      // fue: si se lo reasignaron, o si está en gestión de otro (y entonces
      // tiene que informar el ID al back office). Un toast genérico no alcanza.
      const r = data as {
        esProspectoExistente?: boolean
        reasignacionPermitida?: boolean
        prospectoId?: number
        diasEstancado?: number
        estadoActual?: string
        vendedoresAsignados?: string[]
      }

      if (r?.esProspectoExistente && r?.reasignacionPermitida) {
        setResultadoAlta({
          open: true,
          tipo: "reasignado",
          prospectoId: r.prospectoId,
          diasEstancado: r.diasEstancado,
          estadoActual: r.estadoActual,
          vendedores: [],
        })
      } else if (r?.esProspectoExistente) {
        setResultadoAlta({
          open: true,
          tipo: "en-gestion",
          prospectoId: r.prospectoId,
          vendedores: r.vendedoresAsignados ?? [],
        })
      } else {
        toast.success("Prospecto creado correctamente")
      }

      setShowNuevo(false)
      resetFormNuevo()
      await fetchProspectos()
    } catch (err: unknown) {
      const errores = (err as { response?: { data?: { errores?: string[] } } })?.response?.data?.errores
      if (errores?.length) {
        toast.error(errores.join(" - "))
      } else {
        toast.error("No se pudo guardar el prospecto")
      }
    } finally {
      setGuardando(false)
    }
  }

  const resetFormNuevo = () => {
    setFormNuevo({ nombre:"",apellido:"",dni:"",edad:"",tipo_afiliacion_id:"",sueldo_bruto:"",categoria_monotributo:"",numero_contacto:"",correo:"",localidad:"",estado:"Lead",comentario:"" })
    setFamiliares([])
    setNuevoFamiliar({ vinculo:"",nombre:"",edad:"",tipo_afiliacion_id:"",sueldo_bruto:"",categoria_monotributo:"" })
  }

  const agregarFamiliar = () => {
    if (!nuevoFamiliar.vinculo || !nuevoFamiliar.nombre || !nuevoFamiliar.edad) {
      toast.error("Completa los datos del familiar")
      return
    }
    setFamiliares(prev => [...prev, nuevoFamiliar])
    setNuevoFamiliar({ vinculo:"",nombre:"",edad:"",tipo_afiliacion_id:"",sueldo_bruto:"",categoria_monotributo:"" })
  }

  // --- Historial -----------------------------------------------------------

  const abrirHistorial = async (p: Prospecto) => {
    setHistorialModal({ open: true, prospecto: p, items: [], loading: true })
    try {
      const { data } = await axios.get(`${API_URL}/prospectos/${p.id}/historial`, { headers: getHeaders() })
      setHistorialModal(prev => ({ ...prev, items: data as HistorialItem[], loading: false }))
    } catch {
      setHistorialModal(prev => ({ ...prev, loading: false }))
    }
  }

  // --- Gecros (silencioso) -------------------------------------------------

  const consultarGecros = useCallback(async (prospectoId: number, dni: string) => {
    if (!dni || dni.trim().length < 7) return
    try {
      const { data } = await axios.get(
        `${API_URL}/gecros/consultar/dni/${dni}?prospectoId=${prospectoId}`,
        { headers: getHeaders() }
      )
      if ((data as { success?: boolean })?.success) {
        setProspectos(prev => prev.map(p =>
          p.id === prospectoId
            ? { ...p, gecros_estado: (data as { estado?: string }).estado }
            : p
        ))
      }
    } catch { /* silencioso */ }
  }, [])

  // --- WhatsApp primer contacto --------------------------------------------
  // Paridad con producción (`ProspectosDashboard.jsx:1169`): el envío es real y
  // pasa por el backend (`POST /prospectos/:id/primer-contacto-whatsapp`), que
  // manda el template aprobado por Meta/WhatsApp vía Twilio, crea la
  // conversación en la bandeja de chat y mueve el prospecto a "1º Contacto".
  // No es un deep-link `wa.me`: el mensaje queda registrado.

  const enviarPrimerContactoWhatsApp = async (p: Prospecto) => {
    if (!p.numero_contacto) {
      toast.error("Este prospecto no tiene número de contacto registrado")
      return
    }
    const ok = await confirmar({
      title: "¿Iniciar conversación por WhatsApp?",
      description:
        `Prospecto: ${p.nombre} ${p.apellido} — Teléfono: ${maskPhone(p.numero_contacto)}. ` +
        "Se enviará el mensaje de primer contacto (template aprobado por Meta/WhatsApp) " +
        "y la conversación quedará en tu bandeja de chat.",
      confirmText: "Enviar WhatsApp",
    })
    if (!ok) return
    const tid = toast.loading("Enviando mensaje por WhatsApp…")
    try {
      const { data } = await axios.post(
        `${API_URL}/prospectos/${p.id}/primer-contacto-whatsapp`,
        {},
        { headers: getHeaders() },
      )
      if (!(data as { success?: boolean })?.success) {
        throw new Error((data as { message?: string })?.message || "Error al enviar el mensaje")
      }
      const convId = (data as { data?: { conversacion_id?: number } })?.data?.conversacion_id
      toast.success(
        convId
          ? `Primer contacto enviado. Conversación #${convId} — cuando responda aparecerá en tu bandeja de chat.`
          : "Primer contacto enviado por WhatsApp.",
        { id: tid },
      )
      await fetchProspectos()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as { message?: string })?.message ||
        "Error al enviar el mensaje por WhatsApp"
      toast.error(msg, { id: tid })
    }
  }

  // --- Registrar llamada ---------------------------------------------------

  const registrarLlamada = async (p: Prospecto) => {
    if (!p.numero_contacto) { toast.error("El prospecto no tiene numero de contacto"); return }
    try {
      await axios.post(`${API_URL}/prospectos/${p.id}/registrar-llamada`, {}, { headers: getHeaders() })
      toast.success("Llamada registrada")
    } catch { /* abrir igualmente */ }
    window.location.assign(`tel:${p.numero_contacto}`)
  }

  const tipoAfiliacionNuevo = tiposAfiliacion.find(t => t.id === Number(formNuevo.tipo_afiliacion_id))
  const tipoAfiliacionFamiliar = tiposAfiliacion.find(t => t.id === Number(nuevoFamiliar.tipo_afiliacion_id))

  // Sin orden por columna a propósito: el orden de esta cola es una regla de
  // negocio (refrito/Super Lead primero, después por fecha real de llegada —
  // ver `ordenarProspectos`/`ordenLeads` más arriba) y el selector de "Llegada"
  // de la barra de filtros ya lo cubre. Dejar que se pueda resortear haciendo
  // click en un encabezado rompería esa priorización.
  const columnsProspectos = useMemo<ColumnDef<Prospecto>[]>(() => [
    { accessorKey: "id", header: "ID", enableSorting: false, meta: { className: "text-xs text-muted-foreground" } },
    { accessorKey: "nombre", header: "Nombre", enableSorting: false, meta: { className: "font-medium text-sm" } },
    { accessorKey: "apellido", header: "Apellido", enableSorting: false, meta: { className: "hidden sm:table-cell text-sm" } },
    { accessorKey: "edad", header: "Edad", enableSorting: false, meta: { className: "hidden md:table-cell text-sm" } },
    {
      accessorKey: "numero_contacto",
      header: "Contacto",
      enableSorting: false,
      meta: { className: "hidden md:table-cell text-xs text-muted-foreground" },
      cell: ({ row }) => maskPhone(row.original.numero_contacto),
    },
    {
      id: "afiliacion",
      header: "Afiliacion",
      enableSorting: false,
      meta: { className: "hidden lg:table-cell text-xs text-muted-foreground" },
      cell: ({ row }) => tiposAfiliacion.find(t => t.id === Number(row.original.tipo_afiliacion_id))?.etiqueta ?? "-",
    },
    {
      accessorKey: "estado",
      header: "Estado",
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original
        return (
          <Select value={p.estado} onValueChange={v => guardarCambioProspecto(p, "estado", v)}>
            <SelectTrigger className="h-7 text-xs w-[155px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ESTADOS.map(e => <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>)}
            </SelectContent>
          </Select>
        )
      },
    },
    {
      id: "progreso",
      header: "Progreso",
      enableSorting: false,
      meta: { className: "hidden md:table-cell" },
      cell: ({ row }) => {
        const progreso = ESTADO_PROGRESO[row.original.estado] ?? 0
        return (
          <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full", progreso === 100 ? "bg-state-ok" : progreso >= 75 ? "bg-primary/70" : progreso >= 50 ? "bg-state-warn" : "bg-muted-foreground/40")}
              style={{ width: `${progreso}%` }}
            />
          </div>
        )
      },
    },
    {
      id: "acciones",
      header: "Acciones",
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original
        return (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="size-7" title="Historial" onClick={() => abrirHistorial(p)}><History className="size-3" /></Button>
            <Button size="icon" variant="ghost" className="size-7 text-green-600" title="WhatsApp" onClick={() => enviarPrimerContactoWhatsApp(p)} disabled={!p.numero_contacto}><MessageCircle className="size-3" /></Button>
            <Button size="icon" variant="ghost" className="size-7" title="Llamada" onClick={() => registrarLlamada(p)} disabled={!p.numero_contacto}><Phone className="size-3" /></Button>
            <Button size="icon" variant="ghost" className="size-7" title="Ver detalle" onClick={() => navigate(`/vendedor/prospecto/${p.id}`)}><Eye className="size-3" /></Button>
          </div>
        )
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [tiposAfiliacion])

  /* SidebarNavContent is defined outside the component */

  // --- Render ---------------------------------------------------------------

  return (
    <SidebarProvider>
      <Sidebar variant="inset">
        <SidebarHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 flex items-center justify-center">
              <a href="#" aria-label="Inicio"><Logo className="h-8 w-auto mx-auto" /></a>
            </div>
            <VendedorMobileControls />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-sm">
              {user?.name?.charAt(0) ?? "V"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{user?.name ?? "Vendedor"}</p>
              <p className="text-[10.5px] text-muted-foreground">Panel Vendedor</p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarNavContent
          vistaActual={vistaActual}
          setVistaActual={setVistaActual}
          gaming={gaming}
          setExportarModal={setExportarModal}
          setShowNuevo={setShowNuevo}
        />

        <SidebarFooter className="border-t p-2">
          <Button
            variant="ghost" size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => logout().then(() => navigate("/login"))}
          >
            <LogOut className="size-4 mr-2" />Cerrar sesion
          </Button>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 overflow-x-hidden">
        {/* Header */}
        <header className="flex items-center gap-2 border-b px-4 py-3 sticky top-0 bg-background z-10">
          <SidebarTrigger />
          <h1 className="font-semibold flex-1 text-sm sm:text-base">
            {vistaActual === "prospectos" ? "Mis Prospectos" : vistaActual === "polizas" ? "Mis Polizas" : "WhatsApp"}
          </h1>
          {vistaActual === "prospectos" && (
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchProspectos} title="Refrescar">
                <RefreshCw className="size-3.5" />
              </Button>
              <div className="flex items-center rounded-md border overflow-hidden">
                <Button
                  variant={tipoVista === "tabla" ? "secondary" : "ghost"}
                  size="icon" className="h-8 w-8 rounded-none border-0"
                  onClick={() => setTipoVista("tabla")} title="Ver como tabla"
                >
                  <LayoutListIcon className="size-3.5" />
                </Button>
                <Button
                  variant={tipoVista === "tarjetas" ? "secondary" : "ghost"}
                  size="icon" className="h-8 w-8 rounded-none border-0 border-l"
                  onClick={() => setTipoVista("tarjetas")} title="Ver como padrón"
                >
                  <LayoutGridIcon className="size-3.5" />
                </Button>
              </div>
              <Button size="sm" className="h-8 gap-1.5" onClick={() => setShowNuevo(true)}>
                <PlusIcon className="size-3.5" /><span className="hidden sm:inline">Nuevo</span>
              </Button>
            </div>
          )}
          {vistaActual === "polizas" && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchPolizas} title="Refrescar">
              <RefreshCw className="size-3.5" />
            </Button>
          )}
        </header>

        <div className="p-4 space-y-4">

          {/* ===== VISTA PROSPECTOS ===== */}
          {vistaActual === "prospectos" && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total", value: prospectos.length, icon: UserIcon, tone: "neutral" as const },
                  { label: "Ventas", value: prospectos.filter(p => p.estado === "Venta").length, icon: DollarSign, tone: "ok" as const },
                  { label: "En proceso", value: prospectos.filter(p => ["1 Contacto","Calificado Cotizacion","Calificado Poliza","Calificado Pago"].includes(p.estado)).length, icon: TrendingUp, tone: "warn" as const },
                  { label: "Leads", value: prospectos.filter(p => p.estado === "Lead").length, icon: MessageSquare, tone: "neutral" as const },
                ].map(({ label, value, icon, tone }) => (
                  <StatCard key={label} icon={icon} label={label} value={value} tone={tone} />
                ))}
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    data-buscador
                    className="h-8 w-[148px] pl-8"
                    placeholder="Nombre…   /"
                    aria-keyshortcuts="/"
                    value={filtros.nombre}
                    onChange={e => setFiltros({ ...filtros, nombre: e.target.value })}
                  />
                </div>
                <Input className="h-8 w-[130px]" placeholder="Apellido..." value={filtros.apellido} onChange={e => setFiltros({ ...filtros, apellido: e.target.value })} />
                <Input className="h-8 w-[80px]" placeholder="Edad..." type="number" min="0" value={filtros.edad} onChange={e => setFiltros({ ...filtros, edad: e.target.value })} />
                <Select value={filtros.estado || "todos"} onValueChange={v => setFiltros({ ...filtros, estado: v === "todos" ? "" : v })}>
                  <SelectTrigger className="h-8 w-[170px]"><SelectValue placeholder="Todos los estados" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    {ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filtros.origen || "todos"} onValueChange={v => setFiltros({ ...filtros, origen: v === "todos" ? "" : v })}>
                  <SelectTrigger className="h-8 w-[150px]"><SelectValue placeholder="Todos los orígenes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los orígenes</SelectItem>
                    <SelectItem value="nuevo">Nuevos</SelectItem>
                    <SelectItem value="reciclado">Reciclados</SelectItem>
                    <SelectItem value="flujo-wss">Super Lead (WhatsApp)</SelectItem>
                    <SelectItem value="Vendedor-App">Alta manual</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={ordenLeads} onValueChange={v => setOrdenLeads(v as typeof ordenLeads)}>
                  <SelectTrigger className="h-8 w-[175px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="llegada_asc">Llegada: más antiguos</SelectItem>
                    <SelectItem value="llegada_desc">Llegada: más recientes</SelectItem>
                  </SelectContent>
                </Select>

                {hayFiltros && (
                  <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={limpiarFiltros}>
                    <XIcon className="size-3.5" />Limpiar
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">
                  {prospectosFiltrados.length}{hayFiltros ? " filtrados" : " prospectos"}
                </span>
              </div>

              {/* Rango de llegada */}
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="filtro-fecha-desde" className="text-xs text-muted-foreground">Llegada</Label>
                <Input id="filtro-fecha-desde" type="date" className="h-8 w-[150px]" aria-label="Fecha desde"
                  value={filtros.fechaDesde} onChange={e => setFiltros({ ...filtros, fechaDesde: e.target.value })} />
                <span className="text-xs text-muted-foreground">a</span>
                <Input type="date" className="h-8 w-[150px]" aria-label="Fecha hasta"
                  value={filtros.fechaHasta} onChange={e => setFiltros({ ...filtros, fechaHasta: e.target.value })} />
                <Input type="time" className="h-8 w-[110px]" aria-label="Hora desde"
                  value={filtros.horaDesde} onChange={e => setFiltros({ ...filtros, horaDesde: e.target.value })} />
                <span className="text-xs text-muted-foreground">a</span>
                <Input type="time" className="h-8 w-[110px]" aria-label="Hora hasta"
                  value={filtros.horaHasta} onChange={e => setFiltros({ ...filtros, horaHasta: e.target.value })} />
              </div>

              {/* Contenido */}
              {loading ? (
                /* El esqueleto toma la forma de la fila, no la de una tarjeta:
                   lo que se está cargando es un registro. */
                <div className="reg border-t-2 border-rule-heavy" aria-busy="true" aria-live="polite">
                  <span className="sr-only">Cargando prospectos…</span>
                  <RegistroHead todosMarcados={false} algunoMarcado={false} onMarcarTodos={() => {}} />
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="reg-row">
                      <Skeleton className="h-3 w-6 justify-self-end rounded-xs" />
                      <Skeleton className="h-3.5 w-20 rounded-xs" />
                      <Skeleton className="h-3.5 w-40 rounded-xs" />
                      <Skeleton className="h-3 w-16 rounded-xs" />
                      <Skeleton className="h-3 w-20 rounded-xs" />
                      <Skeleton className="h-[22px] w-28 rounded-stamp" />
                      <Skeleton className="h-3 w-32 rounded-xs" />
                      <span />
                    </div>
                  ))}
                </div>
              ) : prospectosFiltrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                  <UserIcon className="size-10 opacity-30" />
                  <p className="text-sm">No se encontraron prospectos</p>
                  {hayFiltros && <Button variant="ghost" size="sm" onClick={limpiarFiltros}>Limpiar filtros</Button>}
                </div>
              ) : tipoVista === "tarjetas" ? (
                <>
                  <div role="table" aria-label="Registro de prospectos" className="reg border-t-2 border-rule-heavy">
                    <div role="rowgroup">
                      <RegistroHead
                        todosMarcados={todosMarcados}
                        algunoMarcado={algunoMarcado}
                        onMarcarTodos={marcarTodos}
                      />
                    </div>

                    {gruposPorEtapa.map(grupo => (
                      <div role="rowgroup" aria-label={`Etapa: ${grupo.etapa}`} key={grupo.etapa}>
                        <BandaEtapa
                          etapa={grupo.etapa}
                          cantidad={grupo.filas.length}
                          activa={grupo.etapa === etapaActiva}
                        />
                        {grupo.filas.map(({ p, folio }) => (
                          <ProspectoRow
                            key={p.id}
                            prospecto={p}
                            folio={folio}
                            tiposAfiliacion={tiposAfiliacion}
                            marcado={marcados.has(p.id)}
                            onMarcar={m => marcarUno(p.id, m)}
                            onEstadoChange={estado => guardarCambioProspecto(p, "estado", estado)}
                            onComentarioBlur={comentario => guardarCambioProspecto(p, "comentario", comentario)}
                            onDniBlur={dni => {
                              guardarCambioProspecto(p, "dni", dni)
                              consultarGecros(p.id, dni)
                            }}
                            onGecros={() => consultarGecros(p.id, p.dni ?? "")}
                            onHistorial={() => abrirHistorial(p)}
                            onWhatsApp={() => enviarPrimerContactoWhatsApp(p)}
                            onLlamada={() => registrarLlamada(p)}
                            onPromociones={() => setPromoModal({ open: true, prospectoId: p.id })}
                            onVerDetalle={() => navigate(`/vendedor/prospecto/${p.id}`)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Barra de selección: aparece al marcar y dice cuántos hay. */}
                  {marcados.size > 0 && (
                    <div className="marked" aria-live="polite">
                      <b className="text-[12.5px] font-bold tabular-nums">
                        {marcados.size} {marcados.size === 1 ? "asiento marcado" : "asientos marcados"}
                      </b>
                      <span className="sep" aria-hidden="true" />
                      <Button variant="ghost" size="sm" onClick={() => setMarcados(new Set())}>
                        Desmarcar
                      </Button>
                      <div className="push">
                        <Button variant="outline" size="sm" onClick={() => setExportarModal(true)}>
                          Exportar selección
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <DataTable
                  columns={columnsProspectos}
                  data={prospectosPaginados}
                  hideColumnToggle
                  pageSize={PROSPECTOS_POR_PAGINA}
                />
              )}

              {/* Paginación: 20 por página, igual que producción */}
              {!loading && totalPaginas > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Mostrando {(paginaSegura - 1) * PROSPECTOS_POR_PAGINA + 1}–
                    {Math.min(paginaSegura * PROSPECTOS_POR_PAGINA, prospectosOrdenados.length)} de{" "}
                    {prospectosOrdenados.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline" size="sm" className="h-8"
                      onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                      disabled={paginaSegura === 1}
                    >
                      Anterior
                    </Button>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Página {paginaSegura} de {totalPaginas}
                    </span>
                    <Button
                      variant="outline" size="sm" className="h-8"
                      onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                      disabled={paginaSegura === totalPaginas}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== VISTA POLIZAS ===== */}
          {vistaActual === "polizas" && (
            <PolizasDashboard
              polizas={polizas}
              loadingPolizas={loadingPolizas}
              onVerDocumentos={p => setDocumentosModal({ open: true, poliza: p })}
              onAgregarDocumentos={p => setDocLibresModal({ open: true, poliza: p })}
              onEditarPoliza={p => setEditarPolizaId(p.id)}
              onRecargar={fetchPolizas}
            />
          )}
        </div>
      </SidebarInset>

      {/* WhatsApp fullscreen */}
      {vistaActual === "whatsapp" && (
        <div className="fixed inset-0 z-20 bg-background">
          <WhatsAppVista onVolver={() => setVistaActual("prospectos")} />
        </div>
      )}

      {/* Chat IA floating */}
      <ChatVendedor />

      {/* Modal editar poliza */}
      {editarPolizaId !== null && (
        <EditarPolizaModal
          polizaId={editarPolizaId}
          open={editarPolizaId !== null}
          onClose={() => setEditarPolizaId(null)}
          onActualizada={fetchPolizas}
        />
      )}

      {/* Modal gestión de documentos de la póliza (listar / ver / descargar / reemplazar) */}
      <DocumentosPolizaModal
        open={documentosModal.open}
        onOpenChange={open => { if (!open) setDocumentosModal({ open: false, poliza: null }) }}
        poliza={documentosModal.poliza}
        apiContext="vendedor"
        onCargarDocumentos={() => {
          if (documentosModal.poliza) setCargaDocModal({ open: true, polizaId: documentosModal.poliza.id })
        }}
      />

      {/* Modal carga documentos */}
      <CargaDocumentosModal
        polizaId={cargaDocModal.polizaId ?? 0}
        userRole="vendedor"
        open={cargaDocModal.open && cargaDocModal.polizaId !== null}
        onOpenChange={open => { if (!open) setCargaDocModal({ open: false, polizaId: null }) }}
      />

      {/* Modal documentos libres (adjuntar archivos sueltos a la póliza) */}
      {docLibresModal.poliza && (
        <SubirDocumentosLibresModal
          open={docLibresModal.open}
          onOpenChange={open => { if (!open) setDocLibresModal({ open: false, poliza: null }) }}
          poliza={docLibresModal.poliza}
          apiContext="vendedor"
          onDocumentosActualizados={fetchPolizas}
        />
      )}

      {/* Modal exportación */}
      <ModalExportacion
        open={exportarModal}
        onOpenChange={setExportarModal}
        userRole="vendedor"
      />

      {/* Modal Promociones */}
      {promoModal.prospectoId !== null && (
        <PromocionesModal
          open={promoModal.open}
          prospectoId={promoModal.prospectoId}
          onClose={() => setPromoModal({ open: false, prospectoId: null })}
          onPromocionAplicada={fetchProspectos}
        />
      )}

      {/* Modal crear prospecto */}
      <Dialog open={showNuevo} onOpenChange={open => { if (!open) { setShowNuevo(false); resetFormNuevo() } }}>
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuevo Prospecto</DialogTitle></DialogHeader>
          <form onSubmit={crearProspecto} className="space-y-4">
            {/* Datos personales */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="form-nombre">Nombre *</Label>
                <Input id="form-nombre" value={formNuevo.nombre} onChange={e => setFormNuevo({ ...formNuevo, nombre: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="form-apellido">Apellido *</Label>
                <Input id="form-apellido" value={formNuevo.apellido} onChange={e => setFormNuevo({ ...formNuevo, apellido: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="form-dni">DNI</Label>
                <Input id="form-dni" value={formNuevo.dni} onChange={e => setFormNuevo({ ...formNuevo, dni: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="form-edad">Edad *</Label>
                <Input id="form-edad" type="number" value={formNuevo.edad} onChange={e => setFormNuevo({ ...formNuevo, edad: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Estado</Label>
                <Select value={formNuevo.estado} onValueChange={v => setFormNuevo({ ...formNuevo, estado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {/* Contacto */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="form-tel">Telefono / WhatsApp</Label>
                <Input id="form-tel" type="tel" placeholder="5491123456789" value={formNuevo.numero_contacto} onChange={e => setFormNuevo({ ...formNuevo, numero_contacto: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="form-email">Email</Label>
                <Input id="form-email" type="email" value={formNuevo.correo} onChange={e => setFormNuevo({ ...formNuevo, correo: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="form-localidad">Localidad</Label>
              <Input
                id="form-localidad"
                list="localidades-list"
                value={formNuevo.localidad}
                onChange={e => setFormNuevo({ ...formNuevo, localidad: e.target.value })}
                placeholder="Ingrese o seleccione localidad"
              />
              <datalist id="localidades-list">
                {localidades.map(l => <option key={l} value={l} />)}
              </datalist>
            </div>
            {/* Afiliacion */}
            <div className="space-y-1">
              <Label>Tipo de afiliacion</Label>
              <Select value={formNuevo.tipo_afiliacion_id} onValueChange={v => setFormNuevo({ ...formNuevo, tipo_afiliacion_id: v, sueldo_bruto: "", categoria_monotributo: "" })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{tiposAfiliacion.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.etiqueta}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {tipoAfiliacionNuevo?.requiere_sueldo === 1 && (
              <div className="space-y-1">
                <Label htmlFor="form-sueldo">Sueldo bruto</Label>
                <Input id="form-sueldo" type="number" value={formNuevo.sueldo_bruto} onChange={e => setFormNuevo({ ...formNuevo, sueldo_bruto: e.target.value })} />
              </div>
            )}
            {tipoAfiliacionNuevo?.requiere_categoria === 1 && (
              <div className="space-y-1">
                <Label>Categoria monotributo</Label>
                <Select value={formNuevo.categoria_monotributo} onValueChange={v => setFormNuevo({ ...formNuevo, categoria_monotributo: v })}>
                  <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>{CATEGORIAS_MONOTRIBUTO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="form-comentario">Comentario</Label>
              <Textarea id="form-comentario" value={formNuevo.comentario} onChange={e => setFormNuevo({ ...formNuevo, comentario: e.target.value })} rows={2} placeholder="Notas..." />
            </div>

            {/* Familiares */}
            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-sm font-semibold">Familiares ({familiares.length})</p>
              {familiares.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-muted/40 rounded px-2 py-1.5">
                  <span>{f.vinculo} - {f.nombre}, {f.edad} anos</span>
                  <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => setFamiliares(prev => prev.filter((_, idx) => idx !== i))}>
                    <XIcon className="size-3" />
                  </Button>
                </div>
              ))}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Select value={nuevoFamiliar.vinculo} onValueChange={v => setNuevoFamiliar({ ...nuevoFamiliar, vinculo: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Vinculo" /></SelectTrigger>
                  <SelectContent>{VINCULOS.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="h-8 text-xs" placeholder="Nombre" value={nuevoFamiliar.nombre} onChange={e => setNuevoFamiliar({ ...nuevoFamiliar, nombre: e.target.value })} />
                <Input className="h-8 text-xs" type="number" placeholder="Edad" value={nuevoFamiliar.edad} onChange={e => setNuevoFamiliar({ ...nuevoFamiliar, edad: e.target.value })} />
                <Select value={nuevoFamiliar.tipo_afiliacion_id} onValueChange={v => setNuevoFamiliar({ ...nuevoFamiliar, tipo_afiliacion_id: v, sueldo_bruto: "", categoria_monotributo: "" })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Afiliacion" /></SelectTrigger>
                  <SelectContent>{tiposAfiliacion.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.etiqueta}</SelectItem>)}</SelectContent>
                </Select>
                {tipoAfiliacionFamiliar?.requiere_sueldo === 1 && (
                  <Input className="h-8 text-xs" type="number" placeholder="Sueldo bruto" value={nuevoFamiliar.sueldo_bruto} onChange={e => setNuevoFamiliar({ ...nuevoFamiliar, sueldo_bruto: e.target.value })} />
                )}
                {tipoAfiliacionFamiliar?.requiere_categoria === 1 && (
                  <Select value={nuevoFamiliar.categoria_monotributo} onValueChange={v => setNuevoFamiliar({ ...nuevoFamiliar, categoria_monotributo: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>{CATEGORIAS_MONOTRIBUTO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs" onClick={agregarFamiliar}>
                <PlusIcon className="size-3 mr-1" />Agregar familiar
              </Button>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowNuevo(false); resetFormNuevo() }}>Cancelar</Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? <><Loader2 className="size-4 mr-2 animate-spin" />Guardando...</> : "Crear prospecto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal historial */}
      <Dialog open={historialModal.open} onOpenChange={open => setHistorialModal(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Historial - {historialModal.prospecto?.nombre} {historialModal.prospecto?.apellido}
            </DialogTitle>
          </DialogHeader>
          {historialModal.loading ? (
            <Skeleton className="h-40 w-full" />
          ) : historialModal.items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin historial registrado</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {historialModal.items.map((item, i) => (
                <div key={i} className="flex gap-2 text-sm border-b pb-2 last:border-0">
                  <div className="flex-1">
                    <p className="font-medium text-xs">{item.accion ?? item.descripcion ?? "Accion"}</p>
                    {item.first_name && <p className="text-xs text-muted-foreground">Por: {item.first_name} {item.last_name ?? ""}</p>}
                  </div>
                  {item.fecha && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(item.fecha).toLocaleDateString("es-AR")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistorialModal(prev => ({ ...prev, open: false }))}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resultado del alta cuando el prospecto ya existía */}
      <Dialog
        open={resultadoAlta.open}
        onOpenChange={o => setResultadoAlta(r => ({ ...r, open: o }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {resultadoAlta.tipo === "reasignado" ? (
                <><CheckCircle2 className="size-5 text-state-ok-text" />Dato repetido reasignado a vos</>
              ) : (
                <><AlertTriangle className="size-5 text-state-warn-text" />Prospecto en gestión activa</>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            {resultadoAlta.tipo === "reasignado" ? (
              <div className="rounded-lg border border-state-ok/30 bg-state-ok-soft p-3 space-y-1">
                <p className="font-medium">
                  Este contacto ya estaba en el sistema, pero quedó estancado sin novedades.
                </p>
                {resultadoAlta.diasEstancado != null && (
                  <p className="text-xs text-muted-foreground">
                    Estuvo {resultadoAlta.diasEstancado} días sin novedades
                    {resultadoAlta.estadoActual ? ` en estado "${resultadoAlta.estadoActual}"` : ""}.
                  </p>
                )}
                <p className="text-xs">Se te asignó para que lo retomes.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-state-warn/30 bg-state-warn-soft p-3 space-y-1">
                <p className="font-medium">Este prospecto ya está registrado y asignado a:</p>
                {resultadoAlta.vendedores.length > 0 ? (
                  <ul className="list-disc list-inside text-xs">
                    {resultadoAlta.vendedores.map((v, i) => <li key={i}>{v}</li>)}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Otro vendedor lo está gestionando.</p>
                )}
              </div>
            )}

            {resultadoAlta.prospectoId != null && (
              <div className="rounded-lg border bg-paper-sunk p-3">
                <p className="flex items-center gap-1.5 font-semibold"><ClipboardList className="size-3.5 shrink-0" aria-hidden="true" />ID de referencia: #{resultadoAlta.prospectoId}</p>
                {resultadoAlta.tipo === "en-gestion" && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Informá este número al back office para localizarlo.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setResultadoAlta(r => ({ ...r, open: false }))}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}

// --- Tarjeta de prospecto -----------------------------------------------------

/* ═══════════════════════════════════════════════════════════════════════════
   EL PADRÓN — la fila del registro
   ───────────────────────────────────────────────────────────────────────────
   Reemplaza a ProspectoCard. La cola de prospectos es un registro nominal, no
   una grilla de tarjetas: una fila por persona, el documento como eje, el
   estado estampado en columna fija.

   Conserva TODA la función de la tarjeta: DNI editable con consulta a Gecros,
   cambio de estado en el lugar, comentario editable y las cinco acciones. La
   barra de progreso se retiró porque era la misma información que el grado de
   carga del sello, derivada del mismo estado.

   Semántica de tabla real (`role="row"` / `role="cell"`): un lector de
   pantalla anuncia fila y columna. Antes eran `div` sueltos y no anunciaban
   nada — la brecha que quedó anotada en la auditoría.
   ═══════════════════════════════════════════════════════════════════════════ */

interface ProspectoRowProps {
  prospecto: Prospecto
  folio: number
  tiposAfiliacion: TipoAfiliacion[]
  marcado: boolean
  onMarcar: (marcado: boolean) => void
  onEstadoChange: (estado: string) => void
  onComentarioBlur: (comentario: string) => void
  onDniBlur: (dni: string) => void
  onGecros: () => void
  onHistorial: () => void
  onWhatsApp: () => void
  onLlamada: () => void
  onPromociones: () => void
  onVerDetalle: () => void
}

function ProspectoRow({
  prospecto: p, folio, tiposAfiliacion, marcado, onMarcar,
  onEstadoChange, onComentarioBlur, onDniBlur,
  onGecros, onHistorial, onWhatsApp, onLlamada, onPromociones, onVerDetalle
}: ProspectoRowProps) {
  const [comentario, setComentario] = useState(p.comentario ?? "")
  const [dni, setDni] = useState(p.dni ?? "")

  React.useEffect(() => { startTransition(() => setComentario(p.comentario ?? "")) }, [p.comentario])
  React.useEffect(() => { startTransition(() => setDni(p.dni ?? "")) }, [p.dni])

  const afiliacion = tiposAfiliacion.find(t => t.id === Number(p.tipo_afiliacion_id))
  const traba = trabadoEn(p.estado)

  /* Segundo renglón del nombre: edad, localidad, origen y afiliación. Son
     contexto de la persona, no columnas por las que uno barre. */
  const contexto = [
    p.edad ? `${p.edad} años` : null,
    p.localidad || null,
    p.origen || null,
    afiliacion?.etiqueta || null,
    p.gecros_estado ? `Gecros: ${p.gecros_estado}` : null,
  ].filter(Boolean).join(" · ")

  return (
    <div role="row" className="reg-row reg-entry" aria-selected={marcado}>
      {/* 1 · folio — casilla y número de asiento */}
      <span role="cell" className="f-num">
        <Checkbox
          checked={marcado}
          onCheckedChange={v => onMarcar(v === true)}
          aria-label={`Marcar el asiento de ${p.apellido}`}
        />
        <span className="folio-n">{String(folio).padStart(4, "0")}</span>
      </span>

      {/* 2 · documento — el eje */}
      <span role="cell">
        <Input
          className="h-7 w-full rounded-none border-0 bg-transparent px-0 text-[13.5px] font-semibold tabular-nums shadow-none focus-visible:border-b focus-visible:border-primary focus-visible:ring-0"
          placeholder="Sin DNI"
          aria-label={`Documento de ${p.apellido}`}
          value={dni}
          onChange={e => setDni(e.target.value)}
          onBlur={e => { if (e.target.value !== (p.dni ?? "")) onDniBlur(e.target.value) }}
        />
      </span>

      {/* 3 · apellido y nombre */}
      <span role="cell" className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px]">
            <b className="font-semibold">{p.apellido}</b>
            <span className="text-muted-foreground">, {p.nombre}</span>
          </span>
          {p.es_reciclado === 1 && p.visible_refrito === 1 && (
            <Badge variant="warn" size="sm" className="pointer-events-none shrink-0">Reciclado</Badge>
          )}
        </span>
        <span className="block truncate text-[11.5px] text-muted-foreground">
          {contexto || "—"}
        </span>
      </span>

      {/* 4 · contacto — teléfono y correo, ambos enmascarados */}
      <span role="cell" className="min-w-0 text-muted-foreground">
        <span className="block truncate text-[12.5px] tabular-nums">
          {p.numero_contacto ? maskPhone(p.numero_contacto) : "—"}
        </span>
        {p.correo && (
          <span className="block truncate text-[11.5px]">{maskEmail(p.correo)}</span>
        )}
      </span>

      {/* 5 · estado — el sello, y el disparador que lo cambia */}
      <span role="cell" className="min-w-0">
        <Select value={p.estado} onValueChange={onEstadoChange}>
          <SelectTrigger
            size="sm"
            aria-label={`Estado de ${p.apellido}: ${p.estado}`}
            className="h-auto w-fit max-w-full gap-1 border-0 bg-transparent p-0 shadow-none hover:opacity-75 focus-visible:ring-0 dark:bg-transparent dark:hover:bg-transparent [&_svg]:size-3 [&_svg]:opacity-40"
          >
            {getBadgeEstado(p.estado)}
          </SelectTrigger>
          <SelectContent>
            {ESTADOS.map(e => <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </span>

      {/* 6 · trabado en — contra qué está esperando, derivado del estado */}
      <Trabado role="cell" traba={traba} />

      {/* 7 · comentario */}
      <span role="cell">
        <Input
          className="h-7 w-full rounded-none border-0 bg-transparent px-0 text-[12px] shadow-none placeholder:text-muted-foreground/60 focus-visible:border-b focus-visible:border-primary focus-visible:ring-0"
          placeholder="Sin comentario"
          aria-label={`Comentario sobre ${p.apellido}`}
          value={comentario}
          onChange={e => setComentario(e.target.value)}
          onBlur={e => onComentarioBlur(e.target.value)}
        />
      </span>

      {/* 8 · acciones */}
      <span role="cell" className="reg-actions">
        <Button size="icon" variant="ghost" className="size-7" title="Historial" onClick={onHistorial}>
          <History className="size-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="size-7" title="WhatsApp primer contacto" onClick={onWhatsApp} disabled={!p.numero_contacto}>
          <MessageCircle className="size-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="size-7" title="Registrar llamada" onClick={onLlamada} disabled={!p.numero_contacto}>
          <Phone className="size-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="size-7" title="Promociones" onClick={onPromociones}>
          <Tag className="size-3.5" />
        </Button>
        {dni && (
          <Button size="icon" variant="ghost" className="size-7" title="Consultar Gecros" onClick={onGecros}>
            <Eye className="size-3.5" />
          </Button>
        )}
        <Button size="icon" variant="ghost" className="size-7" title="Ver detalle" onClick={onVerDetalle}>
          <ChevronRight className="size-3.5" />
        </Button>
      </span>
    </div>
  )
}

/** Encabezado de columnas del registro. Consume la misma retícula que la fila. */
function RegistroHead({
  todosMarcados, algunoMarcado, onMarcarTodos,
}: {
  todosMarcados: boolean
  algunoMarcado: boolean
  onMarcarTodos: (marcado: boolean) => void
}) {
  return (
    <div role="row" className="reg-row reg-head">
      <span role="columnheader" className="f-num">
        <Checkbox
          checked={todosMarcados ? true : algunoMarcado ? "indeterminate" : false}
          onCheckedChange={v => onMarcarTodos(v === true)}
          aria-label="Marcar todos los asientos de la página"
        />
        <span className="folio-n">Nº</span>
      </span>
      <span role="columnheader">Documento</span>
      <span role="columnheader">Apellido y nombre</span>
      <span role="columnheader">Contacto</span>
      <span role="columnheader">Estado</span>
      <span role="columnheader">Trabado en</span>
      <span role="columnheader">Comentario</span>
      <span role="columnheader" />
    </div>
  )
}

/** Banda de etapa del embudo. La activa lleva regla pesada y el violeta. */
function BandaEtapa({ etapa, cantidad, activa }: {
  etapa: string
  cantidad: number
  activa: boolean
}) {
  return (
    <div className="stage" {...(activa ? { "data-active": "" } : {})}>
      <h3>{etapa}</h3>
      <span className="n">{cantidad}</span>
      <span className="axis" aria-hidden="true" />
    </div>
  )
}
