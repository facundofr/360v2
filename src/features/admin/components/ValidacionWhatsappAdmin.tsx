import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell,
} from "recharts"
import {
  ShieldCheck, RefreshCw, Search, MessageCircle, Send, Clock,
  ThumbsUp, AlertTriangle, XCircle, Timer, ChevronLeft, ChevronRight,
  Flame, Hourglass,
} from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

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
import { DataTable } from "@/components/ui/data-table"
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
  { key: "urgentes",      label: "Interesado (urgente)", color: "var(--color-state-ok)" },
  { key: "averiguando",   label: "Averiguando",          color: "var(--color-primary)" },
  { key: "pendientes",    label: "Pendientes",           color: "var(--color-muted-foreground)" },
  { key: "timeout",       label: "Sin respuesta (auto)", color: "var(--color-state-warn)" },
  { key: "corregir",      label: "A corregir",           color: "var(--color-state-risk)" },
  { key: "no_interesado", label: "No interesado",        color: "var(--color-rule-firm)" },
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

interface FilaGestion { estado: string; total: number }

interface Metricas {
  totales?: Totales
  tasa_confirmacion_pct?: number
  tasa_timeout_pct?: number
  tasa_no_interesado_pct?: number
  tiempo_promedio_respuesta_minutos?: number
  porEstadoGestion?: {
    urgente?: FilaGestion[]
    averiguando?: FilaGestion[]
    otros?: FilaGestion[]
  }
}

/** Qué pasa con los prospectos DESPUÉS de asignarse a un vendedor — paridad con `ValidacionWhatsappAdmin.jsx:228-253`. */
const GESTION_BUCKETS = [
  { key: "urgente", label: "Urgente", color: "var(--color-state-ok-text)", icon: Flame },
  { key: "averiguando", label: "Averiguando", color: "var(--color-primary)", icon: MessageCircle },
  { key: "otros", label: "Otros (sin respuesta / legacy)", color: "var(--color-state-warn-text)", icon: Hourglass },
] as const

/** Campos reales de `validacionWhatsappService.js` (listado paginado): no
 * existen `fecha_envio_validacion`/`fecha_respuesta`/`vendedor_nombre` — son
 * `validacion_enviada_at`/`validacion_resuelta_at`, y la consulta no hace
 * JOIN con vendedor (los prospectos en validación aún no tienen uno asignado). */
interface ProspectoValidacion {
  id: number
  nombre?: string
  apellido?: string
  numero_contacto?: string
  telefono?: string
  estado: string
  validacion_enviada_at?: string
  validacion_resuelta_at?: string
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

  const columnasProspectos = React.useMemo<ColumnDef<ProspectoValidacion>[]>(() => [
    {
      id: "prospecto",
      header: "Prospecto",
      meta: { className: "text-sm font-medium" },
      accessorFn: (p) => `${p.nombre ?? ""} ${p.apellido ?? ""}`.trim() || `#${p.id}`,
      cell: ({ row }) => `${row.original.nombre ?? ""} ${row.original.apellido ?? ""}`.trim() || `#${row.original.id}`,
    },
    {
      id: "telefono",
      header: "Teléfono",
      meta: { className: "hidden sm:table-cell text-sm text-muted-foreground" },
      accessorFn: (p) => p.numero_contacto ?? p.telefono ?? "—",
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => (
        <Badge className={cn("text-xs", ESTADO_BADGE[row.original.estado] ?? "bg-muted text-muted-foreground")}>
          {row.original.estado}
        </Badge>
      ),
    },
    {
      accessorKey: "validacion_enviada_at",
      header: "Enviado",
      meta: { className: "hidden md:table-cell text-xs text-muted-foreground" },
      cell: ({ row }) => row.original.validacion_enviada_at ? new Date(row.original.validacion_enviada_at).toLocaleString("es-AR") : "—",
    },
    {
      accessorKey: "validacion_resuelta_at",
      header: "Respondió",
      meta: { className: "hidden md:table-cell text-xs text-muted-foreground" },
      cell: ({ row }) => row.original.validacion_resuelta_at ? new Date(row.original.validacion_resuelta_at).toLocaleString("es-AR") : "—",
    },
    {
      id: "chat",
      header: "Chat",
      enableSorting: false,
      meta: { className: "w-16" },
      cell: ({ row }) => (
        <Button
          size="icon" variant="outline" className="size-8"
          onClick={() => setConvModal({ open: true, p: row.original })}
          title="Ver conversación"
        >
          <MessageCircle className="size-3.5 text-green-600" />
        </Button>
      ),
    },
  ], [])

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
      <dl className="readout">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label}>
              <dt className="flex items-center gap-1.5">
                <Icon className={cn("size-3.5 shrink-0", k.color)} aria-hidden="true" />
                {k.label}
              </dt>
              <dd>{loading ? <Skeleton className="h-5 w-10" /> : k.valor}</dd>
            </div>
          )
        })}
      </dl>

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

      {/* Qué pasa con los prospectos después de asignarse al vendedor */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageCircle className="size-4 text-state-ok-text" />
            Qué pasa con los prospectos después de asignarse al vendedor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {GESTION_BUCKETS.map(b => {
              const filas = metricas?.porEstadoGestion?.[b.key] ?? []
              const total = filas.reduce((acc, f) => acc + f.total, 0)
              const Icon = b.icon
              return (
                <Card key={b.key} className="h-full">
                  <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs flex items-center gap-1.5" style={{ color: b.color }}>
                      <Icon className="size-3.5" />{b.label}
                    </CardTitle>
                    <Badge variant="secondary">{total}</Badge>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-40 w-full" />
                    ) : filas.length > 0 ? (
                      <ChartContainer config={{ total: { label: "Prospectos" } }} className="w-full" style={{ height: Math.max(160, filas.length * 32) }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                            <XAxis type="number" tickLine={false} axisLine={false} fontSize={10} allowDecimals={false} />
                            <YAxis type="category" dataKey="estado" tickLine={false} axisLine={false} fontSize={10} width={110} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="total" radius={[0, 4, 4, 0]} fill={b.color} />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    ) : (
                      <p className="text-xs text-muted-foreground py-8 text-center">Sin prospectos en este grupo todavía.</p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>

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

          {loadingProspectos ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : (
            // pageSize = PAGE_SIZE: cada página ya viene acotada por el backend
            // (`page`/`limit` en fetchProspectos), el paginador de DataTable no
            // debe activarse — la paginación real es la de abajo.
            <DataTable
              columns={columnasProspectos}
              data={prospectos}
              pageSize={PAGE_SIZE}
              emptyMessage="No hay prospectos derivados con esos criterios."
            />
          )}

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
