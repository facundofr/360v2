import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import axios from "axios"
import { toast } from "sonner"
import {
  ArrowLeft, Edit2, Save, X, RefreshCw, DollarSign, FileText,
  User, Users, History, CreditCard, Loader2, ExternalLink,
  Tag, Send, Calculator, PlusCircle, ChevronDown, ChevronUp,
  MessageCircle, LogOut
} from "lucide-react"
import {
  SidebarProvider, Sidebar, SidebarContent, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger,
  SidebarInset, SidebarFooter
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import Logo from "@/components/ui/logo"
import { useAuth } from "@/contexts/AuthContext"
import { PromocionesModal } from "@/features/vendedor/components/PromocionesModal"
import { EnviarCotizacionModal } from "@/features/vendedor/components/EnviarCotizacionModal"
import { Ley19032Modal } from "@/features/vendedor/components/Ley19032Modal"
import { PolizaForm } from "@/features/vendedor/components/PolizaForm"
import { EditarPolizaModal } from "@/features/vendedor/components/EditarPolizaModal"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { getBadgeEstado } from "@/utils/estadosHelper"
import { ENDPOINTS, API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

// ─── Sidebar nav vendedor ────────────────────────────────────────────────────

const VENDEDOR_NAV = [
  { id: "prospectos", label: "Dashboard Prospectos", icon: User, desc: "Gestión de leads" },
  { id: "polizas",    label: "Mis Pólizas",          icon: FileText, desc: "Pólizas generadas" },
  { id: "whatsapp",  label: "WhatsApp",             icon: MessageCircle, desc: "Chat con prospectos" },
] as const

// ─── Tipos ────────────────────────────────────────────────────────────────────

const ESTADOS = [
  "Lead","1º Contacto","Calificado Cotización","Calificado Póliza",
  "Calificado Pago","Venta","Fuera de zona","Fuera de edad",
  "No contesta","No le interesa (económico)","No le interesa cartilla",
  "No busca cobertura médica","Teléfono erróneo","Ya es socio",
  "Busca otra Cobertura","Preexistencia","Reafiliación"
]

const VINCULOS = ["pareja/conyuge","hijo/a","familiar a cargo"]
interface Familiar {
  id?: number
  nombre: string
  apellido: string
  edad: number
  dni?: string
  vinculo: string
  tipo_afiliacion_id?: number
  sueldo_bruto?: string
  categoria_monotributo?: string
}

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
  telefono?: string
  email?: string
  domicilio?: string
  localidad?: string
  provincia?: string
  familiares?: Familiar[]
  updated_at?: string
  created_at?: string
}

interface CotizacionDetalle {
  persona?: string
  vinculo?: string
  edad?: number
  tipo_afiliacion?: string
  tipo_afiliacion_id?: number
  precio_base?: number
  descuento_aporte?: number
  promocion_aplicada?: string
  descuento_promocion?: number
  precio_final?: number
}

interface Cotizacion {
  id: number
  plan_id?: number
  plan_nombre?: string
  prestador_nombre?: string
  tipo_afiliacion_nombre?: string
  total_bruto?: number
  total_descuento_aporte?: number
  total_descuento_promocion?: number
  total_final?: number
  // legacy compat
  precio_final?: number
  precio_anterior?: number
  vigencia?: string
  created_at?: string
  detalles?: CotizacionDetalle[]
}

interface Poliza {
  id: number
  numero?: string
  numero_poliza?: string
  numero_poliza_oficial?: string
  plan_id?: number
  plan_nombre?: string
  cotizacion_id?: number
  prospecto_id?: number
  pdf_hash?: string
  estado?: string
  total_final?: number
  created_at?: string
}

interface HistorialItem {
  id: number
  accion?: string
  usuario?: string
  created_at?: string
  descripcion?: string
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ProspectoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [prospecto, setProspecto] = useState<Prospecto | null>(null)
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [polizas, setPolizas] = useState<Poliza[]>([])
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingCot, setLoadingCot] = useState(false)

  // Edición
  const [editando, setEditando] = useState(false)
  const [formEdit, setFormEdit] = useState<Partial<Prospecto>>({})
  const [guardandoEdit, setGuardandoEdit] = useState(false)

  // Modal familiar
  const [showFamiliar, setShowFamiliar] = useState(false)
  const [formFamiliar, setFormFamiliar] = useState<Familiar>({ nombre:"", apellido:"", edad:0, vinculo:"hijo/a" })
  const [guardandoFamiliar, setGuardandoFamiliar] = useState(false)

  // Modal recalcular
  const [recalculando, setRecalculando] = useState<number | null>(null)

  // Cotizaciones detalles toggle
  const [showDetallesCot, setShowDetallesCot] = useState<Record<number, boolean>>({})

  // Cupon
  const [cuponesGenerados, setCuponesGenerados] = useState<Record<number, Record<string,unknown>>>({})
  const [generandoCupon, setGenerandoCupon] = useState(false)
  const [reenviandoCupon, setReenviandoCupon] = useState(false)
  const [localidades, setLocalidades] = useState<string[]>([])

  // Catálogo de localidades de Buenos Aires para el formulario de edición.
  //
  // NOTA: producción también pide `GET /vendedor/promociones` en esta pantalla,
  // pero el bloque que las mostraba está comentado (`ProspectoDetalle.jsx:1498`).
  // No replicamos esa llamada: es una request por render sin consumidor.
  // Las promociones se aplican desde `PromocionesModal` en el dashboard.
  useEffect(() => {
    axios.get(`${API_URL}/localidades/buenos-aires`)
      .then(({ data }) => {
        const lista = data?.data ?? data ?? []
        setLocalidades(
          Array.isArray(lista)
            ? lista.map((l: unknown) => typeof l === "string" ? l : String((l as { nombre?: string })?.nombre ?? "")).filter(Boolean)
            : []
        )
      })
      .catch(() => setLocalidades([]))
  }, [])
  const [cuponModal, setCuponModal] = useState<{
    open: boolean; cotId: number | null; planNombre: string
    telefono: string; vencimiento: string; enviarWhatsApp: boolean
  }>({ open: false, cotId: null, planNombre: "", telefono: "", vencimiento: "7", enviarWhatsApp: true })

  // Modales vendedor
  const [promoModal, setPromoModal] = useState(false)
  const [cotizacionParaEnviar, setCotizacionParaEnviar] = useState<Cotizacion | null>(null)
  const [ley19032Modal, setLey19032Modal] = useState(false)
  const [polizaFormCot, setPolizaFormCot] = useState<Cotizacion | null>(null)
  const [editarPolizaId, setEditarPolizaId] = useState<number | null>(null)

  // ─── Fetch principal ──────────────────────────────────────────────────────

  const fetchProspecto = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [{ data: p }, { data: cotData }, { data: polData }, { data: histData }] = await Promise.all([
        axios.get(`${ENDPOINTS.PROSPECTOS}/${id}`, { headers: { Authorization: `Bearer ${getAuthToken()}` } }),
        axios.get(`${API_URL}/lead/${id}/cotizaciones?detalles=1`, { headers: { Authorization: `Bearer ${getAuthToken()}` } }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/polizas/prospecto/${id}`, { headers: { Authorization: `Bearer ${getAuthToken()}` } }).catch(() => ({ data: [] })),
        axios.get(`${ENDPOINTS.PROSPECTOS}/${id}/historial`, { headers: { Authorization: `Bearer ${getAuthToken()}` } }).catch(() => ({ data: [] })),
      ])
      setProspecto(p)
      setFormEdit(p)
      // Procesar cotizaciones: agrupar por plan_id si vienen por integrante
      const rawCot: Cotizacion[] = cotData?.data ?? cotData ?? []
      if (rawCot.length > 0 && !rawCot[0].plan_nombre) {
        // ya vienen agrupadas
        setCotizaciones(rawCot)
      } else {
        const grouped: Record<number, Cotizacion> = {}
        rawCot.forEach(row => {
          const planId = row.plan_id ?? row.id
          if (!grouped[planId]) {
            grouped[planId] = {
              id: row.id,
              plan_id: planId,
              plan_nombre: row.plan_nombre,
              tipo_afiliacion_nombre: row.tipo_afiliacion_nombre,
              total_bruto: row.total_bruto,
              total_descuento_aporte: row.total_descuento_aporte ?? 0,
              total_descuento_promocion: row.total_descuento_promocion ?? 0,
              total_final: row.total_final,
              detalles: []
            }
          } else {
            // si la row trae detalles de integrantes
            grouped[planId].detalles?.push({
              persona: (row as unknown as Record<string,unknown>).persona as string,
              vinculo: (row as unknown as Record<string,unknown>).vinculo as string,
              edad: (row as unknown as Record<string,unknown>).edad as number,
              tipo_afiliacion: (row as unknown as Record<string,unknown>).tipo_afiliacion_nombre as string,
              tipo_afiliacion_id: (row as unknown as Record<string,unknown>).tipo_afiliacion_id as number,
              precio_base: (row as unknown as Record<string,unknown>).precio_base as number,
              descuento_aporte: (row as unknown as Record<string,unknown>).descuento_aporte as number,
              promocion_aplicada: (row as unknown as Record<string,unknown>).promocion_aplicada as string,
              descuento_promocion: (row as unknown as Record<string,unknown>).descuento_promocion as number,
              precio_final: (row as unknown as Record<string,unknown>).precio_final as number,
            })
          }
        })
        setCotizaciones(Object.values(grouped))
      }
      setPolizas(polData?.data ?? polData ?? [])
      setHistorial(histData?.data ?? histData ?? [])
    } catch {
      toast.error("Error al cargar el prospecto")
      navigate(-1)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const doFetch = async () => {
      setLoading(true)
      try {
        const [proData, cotData, polData, histData] = await Promise.all([
          axios.get(`${ENDPOINTS.PROSPECTOS}/${id}`).catch(() => ({ data: null })),
          // Las cotizaciones se piden por `/lead/:id/cotizaciones?detalles=1`
          // (igual que prod). `/prospectos/:id/cotizaciones` no existe.
          axios.get(`${API_URL}/lead/${id}/cotizaciones?detalles=1`).catch(() => ({ data: null })),
          axios.get(`${ENDPOINTS.POLIZAS}`, { params: { prospecto_id: id } }).catch(() => ({ data: null })),
          axios.get(`${ENDPOINTS.PROSPECTOS}/${id}/historial`).catch(() => ({ data: null })),
        ])
        if (proData?.data?.success === false && proData?.data?.message) {
          toast.error(proData.data.message)
          navigate(-1)
          return
        }
        setProspecto(proData?.data?.data ?? proData?.data ?? null)
        const cotRaw = cotData?.data?.data ?? cotData?.data ?? []
        if (Array.isArray(cotRaw)) {
          const grouped: Record<string, typeof cotRaw> = {}
          cotRaw.forEach((c: { plan_nombre?: string }) => {
            const key = c.plan_nombre ?? "Sin plan"
            if (!grouped[key]) grouped[key] = []
            grouped[key].push(c)
          })
        setCotizaciones(Object.values(grouped).flat() as Cotizacion[])
        }
        setPolizas(polData?.data ?? polData ?? [])
        setHistorial(histData?.data ?? histData ?? [])
      } catch {
        toast.error("Error al cargar el prospecto")
        navigate(-1)
      } finally {
        setLoading(false)
      }
    }
    doFetch()
  }, [id, navigate])

  // ─── Guardar edición ──────────────────────────────────────────────────────

  const guardarEdicion = async () => {
    if (!prospecto) return
    setGuardandoEdit(true)
    try {
      await axios.put(
        `${ENDPOINTS.PROSPECTOS}/${prospecto.id}`,
        { ...prospecto, ...formEdit },
        { headers: { Authorization: `Bearer ${getAuthToken()}` } }
      )
      toast.success("Prospecto actualizado")
      setEditando(false)
      await fetchProspecto()
    } catch {
      toast.error("Error al actualizar el prospecto")
    } finally {
      setGuardandoEdit(false)
    }
  }

  // ─── Recotizar ────────────────────────────────────────────────────────────

  const recotizarTodo = async () => {
    if (!prospecto) return
    setLoadingCot(true)
    try {
      await axios.post(
        `${API_URL}/prospectos/${prospecto.id}/recotizar`,
        {},
        { headers: { Authorization: `Bearer ${getAuthToken()}` } }
      )
      toast.success("Cotizaciones actualizadas")
      await fetchProspecto()
    } catch {
      toast.error("Error al recotizar")
    } finally {
      setLoadingCot(false)
    }
  }

  const recalcularCotizacion = async (cotId: number) => {
    setRecalculando(cotId)
    try {
      await axios.post(
        `${API_URL}/cotizaciones/${cotId}/recalcular`,
        {},
        { headers: { Authorization: `Bearer ${getAuthToken()}` } }
      )
      toast.success("Cotización recalculada")
      await fetchProspecto()
    } catch {
      toast.error("Error al recalcular")
    } finally {
      setRecalculando(null)
    }
  }

  // ─── Agregar familiar ─────────────────────────────────────────────────────

  // No existe `POST /prospectos/:id/familiares` en el backend. Producción
  // persiste el grupo familiar completo dentro del PUT del prospecto y luego
  // recotiza, porque agregar un integrante cambia el precio.
  const agregarFamiliar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prospecto) return

    // ─── Reglas de negocio (idénticas a `ProspectoDetalle.jsx`) ─────────────
    if (!formFamiliar.vinculo || !formFamiliar.nombre || formFamiliar.edad === undefined || formFamiliar.edad === null) {
      toast.error("Vínculo, nombre y edad son obligatorios")
      return
    }
    if (formFamiliar.vinculo === "pareja/conyuge" && !formFamiliar.tipo_afiliacion_id) {
      toast.error("El tipo de afiliación es obligatorio para pareja/cónyuge")
      return
    }
    if (formFamiliar.vinculo === "hijo/a" && Number(formFamiliar.edad) > 25) {
      toast.error(
        'Un hijo/a puede tener hasta 25 años inclusive. Para mayores de 25 años, usá el vínculo "Familiar a cargo".'
      )
      return
    }

    setGuardandoFamiliar(true)
    try {
      const familiarCompleto: Familiar = {
        ...formFamiliar,
        edad: Number(formFamiliar.edad),
        tipo_afiliacion_id: formFamiliar.tipo_afiliacion_id ? Number(formFamiliar.tipo_afiliacion_id) : undefined,
        sueldo_bruto: formFamiliar.sueldo_bruto || undefined,
      }
      const familiares = [...(prospecto.familiares ?? []), familiarCompleto]
      const headers = { Authorization: `Bearer ${getAuthToken()}` }

      await axios.put(`${API_URL}/prospectos/${prospecto.id}`, { ...prospecto, familiares }, { headers })
      // Cambia la composición del grupo → el precio cambia.
      await axios.post(`${API_URL}/prospectos/${prospecto.id}/recotizar`, {}, { headers })

      toast.success("Familiar agregado y cotización actualizada")
      setShowFamiliar(false)
      setFormFamiliar({ nombre:"", apellido:"", edad:0, vinculo:"hijo/a" })
      await fetchProspecto()
    } catch {
      toast.error("Error al agregar familiar")
    } finally {
      setGuardandoFamiliar(false)
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const formatCurrency = (amount: number | undefined) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(amount ?? 0)

  const tienePolizaGenerada = (cot: Cotizacion): boolean => {
    if (!polizas.length) return false
    return polizas.some(pol =>
      (pol.cotizacion_id && cot.id && pol.cotizacion_id === cot.id) ||
      (pol.plan_id && cot.plan_id && pol.plan_id === cot.plan_id) ||
      (pol.plan_nombre && cot.plan_nombre && pol.plan_nombre === cot.plan_nombre)
    )
  }

  const toggleDetallesCot = (cotId: number) =>
    setShowDetallesCot(prev => ({ ...prev, [cotId]: !prev[cotId] }))

  const abrirCuponModal = (cot: Cotizacion) => {
    setCuponModal({
      open: true,
      cotId: cot.id,
      planNombre: cot.plan_nombre ?? `Plan #${cot.id}`,
      telefono: prospecto?.telefono ?? "",
      vencimiento: "7",
      enviarWhatsApp: true
    })
  }

  // ─── Generar cupón ────────────────────────────────────────────────────────

  const confirmarCupon = async () => {
    if (!cuponModal.cotId) return
    setGenerandoCupon(true)
    try {
      // ⚠️ Host hardcodeado a propósito: producción hace exactamente lo mismo
      // (`ProspectoDetalle.jsx:688`). El ALTA del cupón va a wspflows mientras
      // que el REENVÍO va a API_URL — inconsistencia heredada de prod.
      // No cambiar sin confirmar dónde vive realmente el servicio de cupones.
      const { data } = await axios.post(
        `https://wspflows.cober.online/cupones-pago/cotizacion/${cuponModal.cotId}`,
        {
          telefono: cuponModal.enviarWhatsApp ? cuponModal.telefono : null,
          vencimiento_dias: parseInt(cuponModal.vencimiento),
          enviar_whatsapp: cuponModal.enviarWhatsApp,
          metodos_pago: ["credit_card", "debit_card", "account_money", "ticket"]
        },
        { headers: { Authorization: `Bearer ${getAuthToken()}` } }
      )
      const cuponData = data?.data ?? data
      setCuponesGenerados(prev => ({ ...prev, [cuponModal.cotId!]: cuponData }))
      setCuponModal(prev => ({ ...prev, open: false }))
      if (cuponData?.checkout_url) {
        window.open(cuponData.checkout_url, "_blank")
      }
      toast.success(cuponData?.whatsapp_enviado ? "Cupón generado y enviado por WhatsApp" : "Cupón generado exitosamente")
    } catch {
      toast.error("Error al generar cupón")
    } finally {
      setGenerandoCupon(false)
    }
  }

  // ─── Reenviar cupón por WhatsApp ──────────────────────────────────────────
  // POST /cupones-pago/:cuponId/reenviar-whatsapp (paridad con producción).
  const reenviarCuponWhatsApp = async (cuponId: number | string, telefono: string) => {
    if (!telefono?.trim()) { toast.error("Ingresá un número de WhatsApp"); return }
    setReenviandoCupon(true)
    try {
      await axios.post(
        `${API_URL}/cupones-pago/${cuponId}/reenviar-whatsapp`,
        { telefono },
        { headers: { Authorization: `Bearer ${getAuthToken()}` } }
      )
      toast.success("Cupón enviado por WhatsApp")
    } catch {
      toast.error("Error enviando por WhatsApp")
    } finally {
      setReenviandoCupon(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    )
  }

  if (!prospecto) return null

  return (
    <SidebarProvider>

      {/* ─── Sidebar vendedor ─────────────────────────────────────── */}
      <Sidebar variant="inset" collapsible="offcanvas">
        <SidebarHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 flex items-center justify-center">
              <a href="#" aria-label="Inicio"><Logo className="h-8 w-auto mx-auto" /></a>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-sm">
              {user?.name?.charAt(0) ?? "V"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{user?.name ?? "Vendedor"}</p>
              <p className="text-[10px] text-muted-foreground">Panel Vendedor</p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="pt-2">
          <SidebarMenu>
            {VENDEDOR_NAV.map(v => {
              const Icon = v.icon
              return (
                <SidebarMenuItem key={v.id}>
                  <SidebarMenuButton
                    onClick={() => navigate("/vendedor/prospectos", { state: { vista: v.id } })}
                    className="h-auto py-2 px-3 group"
                  >
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary transition-colors">
                      <Icon className="size-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-tight">{v.label}</p>
                      <p className="text-[10px] text-muted-foreground">{v.desc}</p>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>

          <Separator className="my-3" />

          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => navigate("/vendedor/prospectos", { state: { openNuevo: true } })}
                className="h-auto py-2 px-3 group"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <PlusCircle className="size-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-tight">Nuevo Prospecto</p>
                  <p className="text-[10px] text-muted-foreground">Registrar lead</p>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="border-t p-2">
          <Button
            variant="ghost" size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => logout().then(() => navigate("/login"))}
          >
            <LogOut className="size-4 mr-2" />Cerrar sesión
          </Button>
        </SidebarFooter>
      </Sidebar>

      {/* ─── Contenido principal ──────────────────────────────────── */}
      <SidebarInset>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3 flex items-center gap-2 flex-wrap">
        <SidebarTrigger />
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold leading-tight truncate">
            {prospecto.nombre} {prospecto.apellido}
          </h1>
          <p className="text-xs text-muted-foreground">{prospecto.edad} años · ID #{prospecto.id}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {getBadgeEstado(prospecto.estado)}
          {polizas.length > 0 && (
            <Badge variant="secondary" className="text-xs">{polizas.length} póliza{polizas.length > 1 ? "s" : ""}</Badge>
          )}
          {!editando ? (
            <Button
              variant="outline" size="sm" className="h-8"
              onClick={() => setEditando(true)}
              disabled={polizas.length > 0}
              title={polizas.length > 0 ? "No se puede editar con pólizas generadas" : ""}
            >
              <Edit2 className="size-3.5 mr-1" /><span className="hidden xs:inline">Editar</span>
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-8" onClick={() => { setEditando(false); setFormEdit(prospecto) }}>
                <X className="size-3.5 mr-1" /><span className="hidden xs:inline">Cancelar</span>
              </Button>
              <Button size="sm" className="h-8" onClick={guardarEdicion} disabled={guardandoEdit}>
                {guardandoEdit ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Save className="size-3.5 mr-1" />}
                <span className="hidden xs:inline">Guardar</span>
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        {/* Info principal */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="size-4" />Información personal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editando ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: "Nombre", key: "nombre" },
                  { label: "Apellido", key: "apellido" },
                  { label: "DNI", key: "dni" },
                  { label: "Edad", key: "edad", type: "number" },
                  { label: "Teléfono", key: "telefono" },
                  { label: "Email", key: "email" },
                  { label: "Domicilio", key: "domicilio" },
                ].map(({ label, key, type }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      type={type ?? "text"}
                      value={String(formEdit[key as keyof Prospecto] ?? "")}
                      onChange={e => setFormEdit({ ...formEdit, [key]: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
                {/* Localidad: catálogo real de Buenos Aires, no texto libre.
                    Escribirla a mano rompe el matcheo por zona en el backend. */}
                <div className="space-y-1">
                  <Label className="text-xs">Localidad</Label>
                  {localidades.length > 0 ? (
                    <Select
                      value={String(formEdit.localidad ?? prospecto.localidad ?? "")}
                      onValueChange={v => setFormEdit({ ...formEdit, localidad: v })}
                    >
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                      <SelectContent>
                        {localidades.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={String(formEdit.localidad ?? "")}
                      onChange={e => setFormEdit({ ...formEdit, localidad: e.target.value })}
                      className="h-8 text-sm"
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Estado</Label>
                  <Select
                    value={formEdit.estado ?? prospecto.estado}
                    onValueChange={v => setFormEdit({ ...formEdit, estado: v })}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ESTADOS.map(e => <SelectItem key={e} value={e} className="text-sm">{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-full space-y-1">
                  <Label className="text-xs">Comentario</Label>
                  <Textarea
                    value={formEdit.comentario ?? ""}
                    onChange={e => setFormEdit({ ...formEdit, comentario: e.target.value })}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                {[
                  { label: "DNI", value: prospecto.dni },
                  { label: "Edad", value: `${prospecto.edad} años` },
                  { label: "Teléfono", value: prospecto.telefono },
                  { label: "Email", value: prospecto.email },
                  { label: "Domicilio", value: prospecto.domicilio },
                  { label: "Localidad", value: prospecto.localidad },
                  { label: "Estado", value: getBadgeEstado(prospecto.estado) },
                ].map(({ label, value }) => (
                  value ? (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium mt-0.5">{value}</p>
                    </div>
                  ) : null
                ))}
                {prospecto.comentario && (
                  <div className="col-span-full">
                    <p className="text-xs text-muted-foreground">Comentario</p>
                    <p className="text-sm mt-0.5">{prospecto.comentario}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="cotizaciones">
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList className="w-max min-w-full">
              <TabsTrigger value="cotizaciones" className="flex-1">
                <DollarSign className="size-3.5 mr-1" /><span className="hidden sm:inline">Cotizaciones</span><span className="sm:hidden">Cot.</span> ({cotizaciones.length})
              </TabsTrigger>
              <TabsTrigger value="polizas" className="flex-1">
                <FileText className="size-3.5 mr-1" />Pólizas ({polizas.length})
              </TabsTrigger>
              <TabsTrigger value="familiares" className="flex-1">
                <Users className="size-3.5 mr-1" /><span className="hidden sm:inline">Familiares</span><span className="sm:hidden">Fam.</span> ({prospecto.familiares?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="historial" className="flex-1">
                <History className="size-3.5 mr-1" />Historial
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Cotizaciones ── */}
          <TabsContent value="cotizaciones">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Cotizaciones guardadas</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline" size="sm" className="h-8"
                      onClick={recotizarTodo}
                      disabled={loadingCot}
                    >
                      {loadingCot ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <RefreshCw className="size-3.5 mr-1" />}
                      Recotizar todo
                    </Button>
                    <Button
                      variant="outline" size="sm" className="h-8"
                      onClick={() => setPromoModal(true)}
                      disabled={polizas.length > 0}
                      title={polizas.length > 0 ? "No se puede aplicar promoción con pólizas generadas" : ""}
                    >
                      <Tag className="size-3.5 mr-1" />Promo
                    </Button>
                    <Button
                      variant="outline" size="sm" className="h-8"
                      onClick={() => setLey19032Modal(true)}
                      disabled={polizas.length > 0}
                      title={polizas.length > 0 ? "No se puede aplicar Ley 19032 con pólizas generadas" : ""}
                    >
                      <Calculator className="size-3.5 mr-1" />Ley 19032
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {cotizaciones.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin cotizaciones guardadas</p>
                ) : (
                  <div className="space-y-3">
                    {cotizaciones.map(cot => {
                      const yaGenerada = tienePolizaGenerada(cot)
                      const cuponGenerado = cuponesGenerados[cot.id]
                      const mostrandoDetalles = showDetallesCot[cot.id]
                      return (
                        <div key={cot.id} className="border rounded-lg overflow-hidden">
                          {/* Fila principal */}
                          <div className="flex flex-col sm:flex-row sm:items-center p-3 gap-3">
                            <div className="flex items-center justify-between gap-3 sm:contents">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm">{cot.plan_nombre ?? `Plan #${cot.id}`}</p>
                                  {yaGenerada && <Badge variant="ok" className="text-xs">✓ Póliza</Badge>}
                                  {cuponGenerado && <Badge variant="ok" className="text-xs">Cupón ✓</Badge>}
                                </div>
                                {cot.tipo_afiliacion_nombre && (
                                  <p className="text-xs text-muted-foreground">{cot.tipo_afiliacion_nombre}</p>
                                )}
                                {cot.total_bruto && cot.total_bruto !== cot.total_final && (
                                  <p className="text-xs text-muted-foreground">Lista: {formatCurrency(cot.total_bruto)}</p>
                                )}
                                {(cot.total_descuento_aporte ?? 0) > 0 && (
                                  <p className="text-xs text-muted-foreground">Desc. aporte: -{formatCurrency(cot.total_descuento_aporte)}</p>
                                )}
                                {(cot.total_descuento_promocion ?? 0) > 0 && (
                                  <p className="text-xs text-muted-foreground">Desc. promo: -{formatCurrency(cot.total_descuento_promocion)}</p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-bold">
                                  {formatCurrency(cot.total_final ?? cot.precio_final)}
                                </p>
                                {(cot.detalles?.length ?? 0) > 0 && (
                                  <button
                                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 ml-auto mt-0.5"
                                    onClick={() => toggleDetallesCot(cot.id)}
                                  >
                                    {mostrandoDetalles ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                                    {cot.detalles?.length} integrantes
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1.5 shrink-0 flex-wrap">
                              <Button
                                variant="outline" size="sm" className="h-7 text-xs"
                                onClick={() => recalcularCotizacion(cot.id)}
                                disabled={recalculando === cot.id}
                                title="Recalcular cotización"
                              >
                                {recalculando === cot.id ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                              </Button>
                              <Button
                                variant="outline" size="sm" className="h-7 text-xs"
                                onClick={() => setCotizacionParaEnviar(cot)}
                              >
                                <Send className="size-3 mr-1" />Enviar
                              </Button>
                              <Button
                                size="sm" className="h-7 text-xs"
                                onClick={() => abrirCuponModal(cot)}
                              >
                                <CreditCard className="size-3 mr-1" />Cupón
                              </Button>
                              {/* Reenvío por WhatsApp: sólo tiene sentido una
                                  vez que el cupón existe y tiene id. */}
                              {cuponGenerado?.cupon_id != null && (
                                <Button
                                  variant="outline" size="sm" className="h-7 text-xs"
                                  disabled={reenviandoCupon}
                                  onClick={() =>
                                    reenviarCuponWhatsApp(
                                      cuponGenerado.cupon_id as number,
                                      prospecto?.telefono ?? ""
                                    )
                                  }
                                  title="Reenviar cupón por WhatsApp"
                                >
                                  {reenviandoCupon
                                    ? <Loader2 className="size-3 animate-spin" />
                                    : <><Send className="size-3 mr-1" />Reenviar</>}
                                </Button>
                              )}
                              <Button
                                variant={yaGenerada ? "secondary" : "outline"}
                                size="sm" className="h-7 text-xs"
                                onClick={() => {
                                  if (yaGenerada) {
                                    toast.info("Ya existe una póliza generada para este plan")
                                    return
                                  }
                                  setPolizaFormCot(cot)
                                }}
                              >
                                <PlusCircle className="size-3 mr-1" />{yaGenerada ? "Ya generada" : "Póliza"}
                              </Button>
                            </div>
                          </div>
                          {/* Detalles por integrante */}
                          {mostrandoDetalles && cot.detalles && cot.detalles.length > 0 && (
                            <div className="border-t bg-muted/30 p-3">
                              <p className="text-xs font-semibold text-muted-foreground mb-2">Desglose por integrante</p>
                              <div className="overflow-x-auto">
                                <table className="text-xs w-full">
                                  <thead>
                                    <tr className="text-muted-foreground">
                                      <th className="text-left pb-1 pr-3">Persona</th>
                                      <th className="text-left pb-1 pr-3">Vínculo</th>
                                      <th className="text-right pb-1 pr-3">Edad</th>
                                      <th className="text-right pb-1 pr-3">Base</th>
                                      <th className="text-right pb-1">Final</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {cot.detalles.map((d, di) => (
                                      <tr key={di} className="border-t border-muted">
                                        <td className="py-1 pr-3 capitalize">{d.persona ?? "Titular"}</td>
                                        <td className="py-1 pr-3 text-muted-foreground capitalize">{d.vinculo ?? "—"}</td>
                                        <td className="py-1 pr-3 text-right">{d.edad ?? "—"}</td>
                                        <td className="py-1 pr-3 text-right">{formatCurrency(d.precio_base)}</td>
                                        <td className="py-1 text-right font-medium">{formatCurrency(d.precio_final)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Pólizas ── */}
          <TabsContent value="polizas">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pólizas generadas</CardTitle>
              </CardHeader>
              <CardContent>
                {polizas.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin pólizas generadas</p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead className="hidden sm:table-cell">Total</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="w-16" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {polizas.map(pol => (
                          <TableRow key={pol.id}>
                            <TableCell className="font-mono text-sm">{pol.numero ?? pol.id}</TableCell>
                            <TableCell className="text-sm">{pol.plan_nombre ?? "—"}</TableCell>
                            <TableCell className="hidden sm:table-cell text-sm">
                              {pol.total_final ? `$${pol.total_final}` : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{pol.estado ?? "—"}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                              <Button
                                variant="ghost" size="sm" className="h-7"
                                onClick={() => setEditarPolizaId(pol.id)}
                                title="Editar póliza"
                              >
                                <Edit2 className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="sm" className="h-7"
                                onClick={() => window.open(`${API_URL}/polizas/${pol.id}/pdf`, "_blank")}
                              >
                                <ExternalLink className="size-3.5" />
                              </Button>
                            </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Familiares ── */}
          <TabsContent value="familiares">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Familiares a cargo</CardTitle>
                  <Button variant="outline" size="sm" className="h-8" onClick={() => setShowFamiliar(true)}>
                    + Agregar familiar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!prospecto.familiares?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin familiares registrados</p>
                ) : (
                  <div className="space-y-3">
                    {prospecto.familiares.map((f, i) => (
                      <div key={f.id ?? i} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{f.nombre} {f.apellido}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {f.edad} años · {f.vinculo}
                            {f.dni ? ` · DNI ${f.dni}` : ""}
                          </p>
                        </div>
                        <Badge variant="secondary" className="capitalize">{f.vinculo}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Historial ── */}
          <TabsContent value="historial">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Historial de acciones</CardTitle>
              </CardHeader>
              <CardContent>
                {historial.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin historial registrado</p>
                ) : (
                  <div className="space-y-2">
                    {historial.map(h => (
                      <div key={h.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{h.accion ?? h.descripcion ?? "Acción registrada"}</p>
                          {h.descripcion && h.accion && (
                            <p className="text-xs text-muted-foreground">{h.descripcion}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {h.usuario ? `${h.usuario} · ` : ""}
                            {h.created_at ? new Date(h.created_at).toLocaleString("es-AR") : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal agregar familiar */}
      <Dialog open={showFamiliar} onOpenChange={setShowFamiliar}>
        <DialogContent className="sm:max-w-lg lg:max-w-xl">
          <DialogHeader><DialogTitle>Agregar familiar</DialogTitle></DialogHeader>
          <form onSubmit={agregarFamiliar} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nombre *</Label>
                <Input
                  value={formFamiliar.nombre}
                  onChange={e => setFormFamiliar({...formFamiliar, nombre: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Apellido *</Label>
                <Input
                  value={formFamiliar.apellido}
                  onChange={e => setFormFamiliar({...formFamiliar, apellido: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Edad *</Label>
                <Input
                  type="number"
                  value={formFamiliar.edad}
                  onChange={e => setFormFamiliar({...formFamiliar, edad: Number(e.target.value)})}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>DNI</Label>
                <Input
                  value={formFamiliar.dni ?? ""}
                  onChange={e => setFormFamiliar({...formFamiliar, dni: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Vínculo *</Label>
              <Select value={formFamiliar.vinculo} onValueChange={v => setFormFamiliar({...formFamiliar, vinculo: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VINCULOS.map(v => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowFamiliar(false)}>Cancelar</Button>
              <Button type="submit" disabled={guardandoFamiliar}>
                {guardandoFamiliar ? "Guardando..." : "Agregar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modales vendedor */}
      <PromocionesModal
        prospectoId={prospecto.id}
        open={promoModal}
        onClose={() => setPromoModal(false)}
        onPromocionAplicada={() => { setPromoModal(false); recotizarTodo() }}
      />

      <EnviarCotizacionModal
        open={!!cotizacionParaEnviar}
        onClose={() => setCotizacionParaEnviar(null)}
        cotizacion={cotizacionParaEnviar as Record<string, unknown> | null}
        prospecto={prospecto as unknown as Record<string, unknown>}
      />

      <Ley19032Modal
        prospectoId={prospecto.id}
        open={ley19032Modal}
        onClose={() => setLey19032Modal(false)}
        onAplicada={() => { setLey19032Modal(false); fetchProspecto() }}
        integrantesConReciboSueldo={(prospecto.familiares ?? []).filter(f => f.tipo_afiliacion_id === 2)}
      />

      <PolizaForm
        cotizacion={polizaFormCot as Record<string, unknown> | null}
        prospecto={prospecto as unknown}
        open={!!polizaFormCot}
        onClose={() => setPolizaFormCot(null)}
        onPolizaCreada={() => { setPolizaFormCot(null); fetchProspecto() }}
      />

      <EditarPolizaModal
        polizaId={editarPolizaId}
        open={!!editarPolizaId}
        onClose={() => setEditarPolizaId(null)}
        onActualizada={() => { setEditarPolizaId(null); fetchProspecto() }}
      />

      {/* Modal generar cupón de pago */}
      <Dialog open={cuponModal.open} onOpenChange={open => setCuponModal(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generar Cupón de Pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                <span className="font-medium text-foreground">{cuponModal.planNombre}</span>
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Número de WhatsApp</Label>
              <input
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Ej: +5491123456789"
                value={cuponModal.telefono}
                onChange={e => setCuponModal(prev => ({ ...prev, telefono: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Días de vencimiento</Label>
              <Select
                value={cuponModal.vencimiento}
                onValueChange={v => setCuponModal(prev => ({ ...prev, vencimiento: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["3","7","15","30"].map(d => (
                    <SelectItem key={d} value={d}>{d} días</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enviarWhatsApp"
                checked={cuponModal.enviarWhatsApp}
                onChange={e => setCuponModal(prev => ({ ...prev, enviarWhatsApp: e.target.checked }))}
                className="h-4 w-4 rounded border"
              />
              <Label htmlFor="enviarWhatsApp" className="text-sm font-normal cursor-pointer">
                Enviar automáticamente por WhatsApp
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCuponModal(prev => ({ ...prev, open: false }))}>
              Cancelar
            </Button>
            <Button onClick={confirmarCupon} disabled={generandoCupon}>
              {generandoCupon ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <CreditCard className="size-3.5 mr-1" />}
              Generar Cupón
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </SidebarInset>

    </SidebarProvider>
  )
}
