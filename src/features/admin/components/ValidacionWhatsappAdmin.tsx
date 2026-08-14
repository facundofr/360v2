import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell,
} from "recharts"
import {
  ShieldCheck, RefreshCw, Search, MessageCircle, Send, Clock,
  ThumbsUp, AlertTriangle, XCircle, Timer, ChevronLeft, ChevronRight,
} from "lucide-react"

import { API_URL } from "@/lib/config"
import { getAuthHeaders } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { useConfirm } from "@/components/common/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { ValidacionConversacionModal } from "./ValidacionConversacionModal"

// ─────────────────────────────────────────────────────────────────────────────
// Validador de WhatsApp — paridad con `ValidacionWhatsappAdmin.jsx`.
//   GET /admin/validacion-whatsapp            → config { activo, cupo_diario }
//   PUT /admin/validacion-whatsapp            → guardar config
//   GET /admin/validacion-whatsapp/metricas   → totales y tasas
//   GET /admin/validacion-whatsapp/prospectos → listado paginado
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

const ESTADOS = [
  { key: "urgentes",      label: "Interesado (urgente)", color: "#198754" },
  { key: "averiguando",   label: "Averiguando",          color: "#20c997" },
  { key: "pendientes",    label: "Pendientes",           color: "#0dcaf0" },
  { key: "timeout",       label: "Sin respuesta (auto)", color: "#ffc107" },
  { key: "corregir",      label: "A corregir",           color: "#dc3545" },
  { key: "no_interesado", label: "No interesado",        color: "#6c757d" },
] as const

/** Color del badge según el estado textual que devuelve el backend. */
const ESTADO_BADGE: Record<string, string> = {
  "Pendiente validación WhatsApp":        "bg-state-warn-soft text-state-warn-text",
  "Validación: esperando confirmación":   "bg-state-warn-soft text-state-warn-text",
  "Lead":                                 "bg-state-ok-soft text-state-ok-text",
  "Lead (validado - interesado)":         "bg-state-ok-soft text-state-ok-text",
  "Lead (validado - averiguando)":        "bg-state-warn-soft text-state-warn-text",
  "Lead (sin respuesta a validación)":    "bg-state-warn-soft text-state-warn-text",
  "Corregir datos":                       "bg-state-risk-soft text-state-risk-text",
  "No interesado":                        "bg-muted text-muted-foreground",
}

const ESTADO_FILTROS = [
  { value: "todos", label: "Todos los estados" },
  { value: "Pendiente validación WhatsApp", label: "Pendiente validación WhatsApp" },
  { value: "Validación: esperando confirmación", label: "Esperando confirmación" },
  { value: "Lead (validado - interesado)", label: "Validado - interesado (urgente)" },
  { value: "Lead (validado - averiguando)", label: "Validado - averiguando" },
  { value: "Lead (sin respuesta a validación)", label: "Sin respuesta (auto-asignado)" },
  { value: "Corregir datos", label: "Corregir datos" },
  { value: "No interesado", label: "No interesado" },
]

interface Totales {
  total_enviados?: number
  urgentes?: number
  averiguando?: number
  pendientes?: number
  timeout?: number
  corregir?: number
  no_interesado?: number
  [k: string]: number | undefined
}

interface Metricas {
  totales?: Totales
  tasa_confirmacion_pct?: number
  tasa_timeout_pct?: number
  tasa_no_interesado_pct?: number
  tiempo_promedio_respuesta_minutos?: number
}

interface ProspectoValidacion {
  id: number
  nombre?: string
  apellido?: string
  numero_contacto?: string
  telefono?: string
  estado: string
  fecha_envio_validacion?: string
  fecha_respuesta?: string
  vendedor_nombre?: string
}

export default function ValidacionWhatsappAdmin() {
  const confirm = useConfirm()

  const [activo, setActivo] = React.useState(false)
  const [cupoDiario, setCupoDiario] = React.useState(20)
  const [cupoInput, setCupoInput] = React.useState("20")
  const [metricas, setMetricas] = React.useState<Metricas | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [prospectos, setProspectos] = React.useState<ProspectoValidacion[]>([])
  const [total, setTotal] = React.useState(0)
  const [pagina, setPagina] = React.useState(1)
  const [filtroEstado, setFiltroEstado] = React.useState("todos")
  const [busqueda, setBusqueda] = React.useState("")
  const [loadingProspectos, setLoadingProspectos] = React.useState(false)

  const [convModal, setConvModal] = React.useState<{ open: boolean; p: ProspectoValidacion | null }>({
    open: false, p: null,
  })

  // ─── Datos ────────────────────────────────────────────────────────────────
  const fetchProspectos = React.useCallback(
    async (page = 1, estado = "todos", search = "") => {
      setLoadingProspectos(true)
      try {
        const { data } = await axios.get(`${API_URL}/admin/validacion-whatsapp/prospectos`, {
          headers: getAuthHeaders(),
          params: {
            page,
            limit: PAGE_SIZE,
            estado: estado === "todos" ? undefined : estado,
            search: search || undefined,
          },
        })
        const d = data?.data ?? {}
        setProspectos(d.rows ?? [])
        setTotal(d.total ?? 0)
      } catch {
        setProspectos([])
        setTotal(0)
      } finally {
        setLoadingProspectos(false)
      }
    },
    []
  )

  const fetchAll = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [configRes, metricasRes] = await Promise.all([
        axios.get(`${API_URL}/admin/validacion-whatsapp`, { headers: getAuthHeaders() }),
        axios.get(`${API_URL}/admin/validacion-whatsapp/metricas`, { headers: getAuthHeaders() }),
      ])
      const cfg = configRes.data?.data ?? {}
      setActivo(!!cfg.activo)
      setCupoDiario(cfg.cupo_diario ?? 20)
      setCupoInput(String(cfg.cupo_diario ?? 20))
      setMetricas(metricasRes.data?.data ?? null)
      await fetchProspectos(1, "todos", "")
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? "Error al cargar la información del validador")
    } finally {
      setLoading(false)
    }
  }, [fetchProspectos])

  React.useEffect(() => { fetchAll() }, [fetchAll])

  // Refetch al cambiar filtros / página
  React.useEffect(() => {
    if (loading) return
    fetchProspectos(pagina, filtroEstado, busqueda)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, filtroEstado])

  const buscar = () => {
    setPagina(1)
    fetchProspectos(1, filtroEstado, busqueda)
  }

  // ─── Configuración ────────────────────────────────────────────────────────
  const guardarConfig = async (nuevoActivo: boolean, nuevoCupo: number) => {
    setSaving(true)
    try {
      const { data } = await axios.put(
        `${API_URL}/admin/validacion-whatsapp`,
        { activo: nuevoActivo, cupo_diario: nuevoCupo },
        { headers: getAuthHeaders() }
      )
      const d = data?.data ?? {}
      setActivo(!!d.activo)
      setCupoDiario(d.cupo_diario ?? nuevoCupo)
      setCupoInput(String(d.cupo_diario ?? nuevoCupo))
      toast.success("Configuración actualizada")
      await fetchAll()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? "No se pudo actualizar la configuración")
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (valor: boolean) => {
    // Apagar el validador corta el flujo de derivación: pedimos confirmación.
    if (!valor) {
      const ok = await confirm({
        title: "¿Desactivar el validador de WhatsApp?",
        description: "Los prospectos nuevos dejarán de derivarse al validador y pasarán directo a asignación.",
        confirmText: "Desactivar",
        destructive: true,
      })
      if (!ok) return
    }
    guardarConfig(valor, cupoDiario)
  }

  const guardarCupo = () => {
    const n = Number(cupoInput)
    if (!Number.isFinite(n) || n < 0) { toast.warning("El cupo debe ser un número mayor o igual a 0"); return }
    guardarConfig(activo, n)
  }

  // ─── Derivados ────────────────────────────────────────────────────────────
  const totales = metricas?.totales ?? {}
  const datosGrafico = ESTADOS.map(e => ({
    estado: e.label,
    cantidad: totales[e.key] ?? 0,
    fill: e.color,
  }))
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const kpis = [
    { label: "Enviados",        valor: totales.total_enviados ?? 0, icon: Send,       color: "text-primary" },
    { label: "Pendientes",      valor: totales.pendientes ?? 0,     icon: Clock,      color: "text-state-warn-text" },
    { label: "Urgentes",        valor: totales.urgentes ?? 0,       icon: ThumbsUp,   color: "text-state-ok-text" },
    { label: "Averiguando",     valor: totales.averiguando ?? 0,    icon: MessageCircle, color: "text-state-warn-text" },
    { label: "A corregir",      valor: totales.corregir ?? 0,       icon: AlertTriangle, color: "text-state-risk-text" },
    { label: "No interesado",   valor: totales.no_interesado ?? 0,  icon: XCircle,    color: "text-muted-foreground" },
  ]

  const tasas = [
    { label: "Tasa de confirmación", valor: metricas?.tasa_confirmacion_pct, sufijo: "%" },
    { label: "Tasa de timeout",      valor: metricas?.tasa_timeout_pct,      sufijo: "%" },
    { label: "Tasa no interesado",   valor: metricas?.tasa_no_interesado_pct, sufijo: "%" },
    { label: "Respuesta promedio",   valor: metricas?.tiempo_promedio_respuesta_minutos, sufijo: " min" },
  ]

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Configuración */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            Validador de WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex items-center gap-3">
            <Switch checked={activo} onCheckedChange={toggleActivo} disabled={loading || saving} id="validador-activo" />
            <Label htmlFor="validador-activo" className="cursor-pointer">
              {activo ? "Activo" : "Inactivo"}
            </Label>
            <Badge variant={activo ? "ok" : "secondary"}>
              {activo ? "Derivando prospectos" : "Sin derivar"}
            </Badge>
          </div>

          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="cupo" className="text-xs">Cupo diario</Label>
              <Input
                id="cupo"
                type="number"
                min="0"
                className="h-9 w-28"
                value={cupoInput}
                onChange={e => setCupoInput(e.target.value)}
                disabled={loading || saving}
              />
            </div>
            <Button
              size="sm"
              className="h-9"
              onClick={guardarCupo}
              disabled={saving || cupoInput === String(cupoDiario)}
            >
              Guardar
            </Button>
          </div>

          <Button variant="outline" size="sm" className="h-9 sm:ml-auto" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={cn("size-3.5 mr-1", loading && "animate-spin")} />Actualizar
          </Button>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <Card key={k.label}>
              <CardContent className="p-3 text-center">
                <Icon className={cn("size-4 mx-auto mb-1", k.color)} />
                <p className="text-2xl font-bold">
                  {loading ? <Skeleton className="h-7 w-10 mx-auto" /> : k.valor}
                </p>
                <p className="text-xs text-muted-foreground">{k.label}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Tasas + gráfico */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Distribución por estado</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-56 w-full" /> : (
              <ChartContainer config={{ cantidad: { label: "Prospectos" } }} className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datosGrafico} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                    <XAxis dataKey="estado" tickLine={false} axisLine={false} fontSize={10}
                      interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
                      {datosGrafico.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Indicadores</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {tasas.map(t => (
              <div key={t.label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t.label}</span>
                <span className="text-lg font-semibold">
                  {loading ? <Skeleton className="h-6 w-12" />
                    : t.valor != null ? `${t.valor}${t.sufijo}` : "—"}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Timer className="size-3" />Sin respuesta (auto)
              </span>
              <span className="text-lg font-semibold">{totales.timeout ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Listado */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Números derivados al validador y su último estado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-9"
                placeholder="Buscar por nombre o teléfono…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") buscar() }}
              />
            </div>
            <Select value={filtroEstado} onValueChange={v => { setFiltroEstado(v); setPagina(1) }}>
              <SelectTrigger className="h-9 w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESTADO_FILTROS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-9" onClick={buscar}>Buscar</Button>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prospecto</TableHead>
                  <TableHead className="hidden sm:table-cell">Teléfono</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden md:table-cell">Enviado</TableHead>
                  <TableHead className="hidden md:table-cell">Respondió</TableHead>
                  <TableHead className="w-16">Chat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingProspectos ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : prospectos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No hay prospectos derivados con esos criterios.
                    </TableCell>
                  </TableRow>
                ) : (
                  prospectos.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-sm">
                        {`${p.nombre ?? ""} ${p.apellido ?? ""}`.trim() || `#${p.id}`}
                        {p.vendedor_nombre && (
                          <span className="block text-xs text-muted-foreground">{p.vendedor_nombre}</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {p.numero_contacto ?? p.telefono ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs", ESTADO_BADGE[p.estado] ?? "bg-muted text-muted-foreground")}>
                          {p.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {p.fecha_envio_validacion ? new Date(p.fecha_envio_validacion).toLocaleString("es-AR") : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {p.fecha_respuesta ? new Date(p.fecha_respuesta).toLocaleString("es-AR") : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon" variant="outline" className="size-8"
                          onClick={() => setConvModal({ open: true, p })}
                          title="Ver conversación"
                        >
                          <MessageCircle className="size-3.5 text-green-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {total} prospecto{total !== 1 ? "s" : ""} · página {pagina} de {totalPaginas}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="size-8"
                  disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="outline" size="icon" className="size-8"
                  disabled={pagina >= totalPaginas} onClick={() => setPagina(p => p + 1)}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ValidacionConversacionModal
        open={convModal.open}
        onOpenChange={o => setConvModal(m => ({ ...m, open: o }))}
        prospectoId={convModal.p?.id ?? null}
        nombre={convModal.p ? `${convModal.p.nombre ?? ""} ${convModal.p.apellido ?? ""}`.trim() : undefined}
      />
    </div>
  )
}
