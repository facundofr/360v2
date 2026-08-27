import { useState, useEffect, useCallback, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios"
import { toast } from "sonner"
import {
  RefreshCw, Pause, Play, Pencil, Users, Ban, CheckCircle2,
} from "lucide-react"
import { useConfirm } from "@/components/common/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"
import { unidadCompensadorSchema, type UnidadCompensadorValues } from "@/features/admin/schemas"

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard del compensador de leads (balanceador entre Producción y
// Bariloche). Port de `CompensadorAdmin.jsx` — módulo que en producción está
// montado (`AdminDashboard.jsx:119,222`, "Compensador de leads") pero que
// nunca se migró a v2. No le habla directo al Lead Router: pasa por
// `backend/routes/admin/compensadorRoutes.js`, un proxy catch-all
// (`router.all('/*', ...)`) que reenvía todo a `/admin/compensador/*`.
// ─────────────────────────────────────────────────────────────────────────────

interface Unidad {
  id: number
  nombre: string
  slug: string
  tipo: string
  webhook_url?: string
  webhook_header_name?: string
  webhook_header_configurado?: boolean
  vendedores_efectivos_cache?: number | null
  salud_estado?: "sana" | "degradada" | "desconocida"
  activa: boolean
  peso_modo: "automatico" | "manual"
  peso_manual?: number
}

interface ResumenUnidad {
  unidadId: number
  nombre: string
  enviadosHoy: number
  confirmadosHoy: number
  fallidosHoy: number
  failoversRecibidosHoy: number
  porAfinidadHoy: number
  deficitVivo?: number | null
  repartoRealPct?: number | null
  pesoConfiguradoPct?: number | null
  saludEstado?: "sana" | "degradada" | "desconocida"
}

interface Resumen {
  unidades: ResumenUnidad[]
  outboxPendiente: number
}

interface Latencias { p50?: number; p95?: number; p99?: number }

interface EventoLedger {
  id: number
  lead_key: string
  motivo_decision?: string
  estado: string
  intentos: number
  latencia_ms?: number | null
  creado_en: string
}

interface VendedorCompensador {
  id: number
  nombre?: string
  email: string
  role: string
  cuentaParaPeso: boolean
  excluido: boolean
}

const ESTADO_SALUD_BADGE: Record<string, "ok" | "risk" | "secondary"> = {
  sana: "ok", degradada: "risk", desconocida: "secondary",
}

const authHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` })

export default function CompensadorAdmin() {
  const confirm = useConfirm()
  const [tab, setTab] = useState<"unidades" | "metricas">("unidades")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [unidades, setUnidades] = useState<Unidad[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [latencias, setLatencias] = useState<Latencias | null>(null)
  const [eventos, setEventos] = useState<EventoLedger[]>([])

  const [editando, setEditando] = useState<Unidad | null>(null)
  const [vendedoresDe, setVendedoresDe] = useState<Unidad | null>(null)
  const [vendedores, setVendedores] = useState<VendedorCompensador[]>([])
  const [vendedoresLoading, setVendedoresLoading] = useState(false)

  const cargarTodo = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [uRes, rRes, lRes, eRes] = await Promise.all([
        axios.get(`${API_URL}/admin/compensador/unidades`, { headers: authHeaders() }),
        axios.get(`${API_URL}/admin/compensador/metricas/resumen`, { headers: authHeaders() }),
        axios.get(`${API_URL}/admin/compensador/metricas/latencias`, { headers: authHeaders() }),
        axios.get(`${API_URL}/admin/compensador/metricas/eventos?limite=30`, { headers: authHeaders() }),
      ])
      setUnidades(uRes.data)
      setResumen(rRes.data)
      setLatencias(lRes.data)
      setEventos(eRes.data)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? "No se pudo cargar el compensador de leads")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarTodo() }, [cargarTodo])

  const pausar = async (unidad: Unidad) => {
    const ok = await confirm({
      title: `¿Pausar ${unidad.nombre}?`,
      description: "Sale del reparto de leads hasta que se reactive.",
      confirmText: "Pausar",
      destructive: true,
    })
    if (!ok) return
    try {
      await axios.post(`${API_URL}/admin/compensador/unidades/${unidad.id}/pausar`, { motivo: "Pausada desde el admin" }, { headers: authHeaders() })
      toast.success("Pausada")
      cargarTodo()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "No se pudo pausar")
    }
  }

  const reactivar = async (unidad: Unidad) => {
    try {
      await axios.post(`${API_URL}/admin/compensador/unidades/${unidad.id}/reactivar`, {}, { headers: authHeaders() })
      toast.success("Reactivada")
      cargarTodo()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "No se pudo reactivar")
    }
  }

  const recalcularPeso = async (unidad: Unidad) => {
    try {
      await axios.post(`${API_URL}/admin/compensador/unidades/${unidad.id}/recalcular-peso`, {}, { headers: authHeaders() })
      cargarTodo()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "No se pudo recalcular")
    }
  }

  const abrirVendedores = async (unidad: Unidad) => {
    setVendedoresDe(unidad)
    setVendedoresLoading(true)
    try {
      const { data } = await axios.get(`${API_URL}/admin/compensador/unidades/${unidad.id}/vendedores`, { headers: authHeaders() })
      setVendedores(data.vendedores ?? [])
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "No se pudo leer vendedores")
    } finally {
      setVendedoresLoading(false)
    }
  }

  const [excluirModal, setExcluirModal] = useState<{ open: boolean; vendedor: VendedorCompensador | null; motivo: string }>({ open: false, vendedor: null, motivo: "" })

  const confirmarExcluir = async () => {
    if (!excluirModal.vendedor || !vendedoresDe || !excluirModal.motivo.trim()) return
    try {
      await axios.post(`${API_URL}/admin/compensador/unidades/${vendedoresDe.id}/vendedores/excluir`, {
        vendedorId: excluirModal.vendedor.id,
        vendedorRef: excluirModal.vendedor.email,
        motivo: excluirModal.motivo.trim(),
      }, { headers: authHeaders() })
      setExcluirModal({ open: false, vendedor: null, motivo: "" })
      abrirVendedores(vendedoresDe)
      cargarTodo()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "No se pudo excluir")
    }
  }

  const incluirVendedor = async (vendedor: VendedorCompensador) => {
    if (!vendedoresDe) return
    try {
      await axios.delete(`${API_URL}/admin/compensador/unidades/${vendedoresDe.id}/vendedores/${vendedor.id}/excluir`, { headers: authHeaders() })
      abrirVendedores(vendedoresDe)
      cargarTodo()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "No se pudo incluir")
    }
  }

  const form = useForm<UnidadCompensadorValues>({ resolver: zodResolver(unidadCompensadorSchema) })

  const abrirEdicion = (u: Unidad) => {
    setEditando(u)
    form.reset({
      webhook_url: u.webhook_url ?? "",
      webhook_header_name: u.webhook_header_name ?? "",
      webhook_header_value: "",
      peso_modo: u.peso_modo,
      peso_manual: String(u.peso_manual ?? 10),
    })
  }

  const guardarEdicion = async (values: UnidadCompensadorValues) => {
    if (!editando) return
    const payload: Record<string, unknown> = {
      webhook_url: values.webhook_url,
      webhook_header_name: values.webhook_header_name,
      peso_modo: values.peso_modo,
      peso_manual: Number(values.peso_manual) || 0,
    }
    if (values.webhook_header_value) payload.webhook_header_value = values.webhook_header_value
    try {
      await axios.put(`${API_URL}/admin/compensador/unidades/${editando.id}`, payload, { headers: authHeaders() })
      setEditando(null)
      cargarTodo()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "No se pudo guardar")
    }
  }

  const pesoModo = form.watch("peso_modo")

  const resumenPorUnidad = useMemo(() => {
    const map = new Map<number, ResumenUnidad>()
    resumen?.unidades.forEach(u => map.set(u.unidadId, u))
    return map
  }, [resumen])

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Compensador de leads</h2>
        <Button variant="outline" size="sm" onClick={cargarTodo}>
          <RefreshCw className="size-3.5 mr-1.5" />Actualizar
        </Button>
      </div>

      {error && (
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      )}

      <Tabs value={tab} onValueChange={v => setTab(v as "unidades" | "metricas")}>
        <TabsList>
          <TabsTrigger value="unidades">Unidades</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
        </TabsList>

        <TabsContent value="unidades" className="pt-3">
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Webhook</TableHead>
                    <TableHead className="text-right">Vendedores</TableHead>
                    <TableHead className="text-right">Peso</TableHead>
                    <TableHead>Salud</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unidades.map(u => {
                    const r = resumenPorUnidad.get(u.id)
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{u.nombre}</div>
                          <div className="text-xs text-muted-foreground">{u.slug}</div>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">{u.webhook_url}</TableCell>
                        <TableCell className="text-right text-sm">{u.tipo === "cober360_crm" ? (u.vendedores_efectivos_cache ?? "—") : "—"}</TableCell>
                        <TableCell className="text-right text-sm">{r?.pesoConfiguradoPct != null ? `${r.pesoConfiguradoPct}%` : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={ESTADO_SALUD_BADGE[u.salud_estado ?? "desconocida"] ?? "secondary"}>{u.salud_estado ?? "desconocida"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.activa ? "outline" : "warn"}>{u.activa ? "activa" : "pausada"}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {u.tipo === "cober360_crm" && (
                              <Button size="icon" variant="ghost" className="size-8" title="Vendedores" onClick={() => abrirVendedores(u)}>
                                <Users className="size-3.5" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="size-8" title="Recalcular peso" onClick={() => recalcularPeso(u)}>
                              <RefreshCw className="size-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="size-8" title="Editar" onClick={() => abrirEdicion(u)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            {u.activa ? (
                              <Button size="icon" variant="ghost" className="size-8 text-destructive" title="Pausar" onClick={() => pausar(u)}>
                                <Pause className="size-3.5" />
                              </Button>
                            ) : (
                              <Button size="icon" variant="ghost" className="size-8 text-state-ok-text" title="Reactivar" onClick={() => reactivar(u)}>
                                <Play className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metricas" className="pt-3 space-y-4">
          {resumen && (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                {resumen.unidades.map(u => (
                  <Card key={u.unidadId}>
                    <CardContent className="pt-4">
                      <p className="text-xs uppercase text-muted-foreground">{u.nombre} · hoy</p>
                      <p className="text-3xl font-bold">{u.enviadosHoy}</p>
                      <p className="text-xs text-muted-foreground">{u.repartoRealPct ?? "—"}% real · {u.pesoConfiguradoPct ?? "—"}% configurado</p>
                    </CardContent>
                  </Card>
                ))}
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs uppercase text-muted-foreground">Outbox pendiente</p>
                    <p className="text-3xl font-bold">{resumen.outboxPendiente}</p>
                    <p className="text-xs text-muted-foreground">{resumen.outboxPendiente > 0 ? "revisar — leads sin entregar" : "sin leads pendientes"}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Detalle por unidad</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Unidad</TableHead>
                        <TableHead className="text-right">Enviados</TableHead>
                        <TableHead className="text-right">Confirmados</TableHead>
                        <TableHead className="text-right">Fallidos</TableHead>
                        <TableHead className="text-right">Failovers</TableHead>
                        <TableHead className="text-right">Por afinidad</TableHead>
                        <TableHead className="text-right">Déficit vivo</TableHead>
                        <TableHead>Salud</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resumen.unidades.map(u => (
                        <TableRow key={u.unidadId}>
                          <TableCell>{u.nombre}</TableCell>
                          <TableCell className="text-right">{u.enviadosHoy}</TableCell>
                          <TableCell className="text-right">{u.confirmadosHoy}</TableCell>
                          <TableCell className="text-right">{u.fallidosHoy}</TableCell>
                          <TableCell className="text-right">{u.failoversRecibidosHoy}</TableCell>
                          <TableCell className="text-right">{u.porAfinidadHoy}</TableCell>
                          <TableCell className="text-right">{u.deficitVivo ?? "—"}</TableCell>
                          <TableCell><Badge variant={ESTADO_SALUD_BADGE[u.saludEstado ?? "desconocida"] ?? "secondary"}>{u.saludEstado ?? "desconocida"}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {latencias && (
                <div className="grid gap-3 md:grid-cols-3">
                  {(["p50", "p95", "p99"] as const).map(k => (
                    <Card key={k}>
                      <CardContent className="pt-4">
                        <p className="text-xs uppercase text-muted-foreground">{k}</p>
                        <p className="text-2xl font-bold">{latencias[k] != null ? `${latencias[k]} ms` : "—"}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Últimos eventos del ledger</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lead key</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Intentos</TableHead>
                        <TableHead className="text-right">Latencia</TableHead>
                        <TableHead>Cuándo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eventos.map(e => (
                        <TableRow key={e.id}>
                          <TableCell><code className="text-xs">{e.lead_key}</code></TableCell>
                          <TableCell className="text-xs">{e.motivo_decision ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={e.estado === "confirmado" ? "ok" : e.estado === "fallido" || e.estado === "outbox" ? "risk" : "secondary"}>
                              {e.estado}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{e.intentos}</TableCell>
                          <TableCell className="text-right">{e.latencia_ms != null ? `${e.latencia_ms} ms` : "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(e.creado_en).toLocaleString("es-AR")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal: editar unidad */}
      <Dialog open={!!editando} onOpenChange={open => !open && setEditando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Editar {editando?.nombre}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form className="space-y-3" onSubmit={form.handleSubmit(guardarEdicion)}>
              <FormField control={form.control} name="webhook_url" render={({ field }) => (
                <FormItem>
                  <FormLabel>Webhook URL</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="webhook_header_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Header (nombre)</FormLabel>
                    <FormControl><Input {...field} placeholder="X-Internal-Key" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="webhook_header_value" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Header (valor)</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder={editando?.webhook_header_configurado ? "•••• (dejar vacío para no cambiar)" : ""} />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="peso_modo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Peso</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="automatico">Automático (por vendedores)</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                {pesoModo === "manual" && (
                  <FormField control={form.control} name="peso_manual" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Peso manual</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                    </FormItem>
                  )} />
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal: vendedores de la unidad */}
      <Dialog open={!!vendedoresDe} onOpenChange={open => !open && setVendedoresDe(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Vendedores — {vendedoresDe?.nombre}</DialogTitle></DialogHeader>
          {vendedoresLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Cuenta para el peso</TableHead>
                    <TableHead>Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendedores.map(v => (
                    <TableRow key={v.id}>
                      <TableCell>
                        {v.nombre || "(sin nombre)"} <span className="text-xs text-muted-foreground">{v.email}</span>
                      </TableCell>
                      <TableCell className="text-sm">{v.role}</TableCell>
                      <TableCell>
                        <Badge variant={v.cuentaParaPeso ? "ok" : "risk"}>{v.cuentaParaPeso ? "cuenta" : "excluido"}</Badge>
                      </TableCell>
                      <TableCell>
                        {v.excluido ? (
                          <Button size="sm" variant="outline" onClick={() => incluirVendedor(v)}>
                            <CheckCircle2 className="size-3.5 mr-1" />Incluir
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => setExcluirModal({ open: true, vendedor: v, motivo: "" })}>
                            <Ban className="size-3.5 mr-1" />Excluir
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: motivo de exclusión */}
      <Dialog open={excluirModal.open} onOpenChange={open => !open && setExcluirModal({ open: false, vendedor: null, motivo: "" })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Excluir a {excluirModal.vendedor?.email}</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="motivo-excluir">Motivo *</Label>
            <Input
              id="motivo-excluir"
              placeholder="ej. cuenta de prueba, sin verificar"
              value={excluirModal.motivo}
              onChange={e => setExcluirModal(m => ({ ...m, motivo: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluirModal({ open: false, vendedor: null, motivo: "" })}>Cancelar</Button>
            <Button variant="destructive" disabled={!excluirModal.motivo.trim()} onClick={confirmarExcluir}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
