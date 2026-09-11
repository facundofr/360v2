import { useState, useEffect, useCallback, useMemo } from "react"
import axios from "axios"
import { toast } from "sonner"
import {
  Users, Eye, ArrowRightLeft, UserCheck, UserX,
  Trash2, Tag, Search, RefreshCw,
  Loader2, BarChart2
} from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { API_URL } from "@/lib/config"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Lectura, LecturaItem } from "@/components/common/Lectura"
import { EstadoVacio } from "@/components/common/EstadoVacio"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { DataTable } from "@/components/ui/data-table"
import { getBadgeEstado } from "@/utils/estadosHelper"
import { getAuthToken } from "@/lib/auth"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Vendedor {
  id: number
  first_name?: string
  last_name?: string
  email?: string
  phone_number?: string
  is_enabled: boolean | number
  total_prospectos?: number
  conversiones?: number
  ventas?: number
  created_at?: string
  categoria_id?: number | string
  categoria_nombre?: string
  categoria_prioridad?: number
}

interface ProspectoVendedor {
  id: number
  nombre: string
  apellido: string
  numero_contacto?: string
  correo?: string
  estado?: string
  asignacion_estado?: string
  fecha_asignacion?: string
}

interface Categoria {
  id: number
  nombre: string
  capacidad_maxima?: number
  prioridad?: number
  activa?: boolean
}

interface MetricasVendedor {
  total_prospectos?: number
  ventas?: number
  tasa_conversion?: number
  tiempo_promedio?: number
  [key: string]: unknown
}

/** Agregado del equipo, de `GET /supervisor/metricas`. */
interface MetricasEquipo {
  totalVendedores: number
  vendedoresActivos: number
  prospectosPorVendedor: { vendedor_id?: number; nombre?: string; total_prospectos?: number }[]
}

const authHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` })

function nombreCompleto(v: Vendedor) {
  return `${v.first_name ?? ""} ${v.last_name ?? ""}`.trim() || `Vendedor ${v.id}`
}

function isEnabled(v: Vendedor) {
  return v.is_enabled !== false && v.is_enabled !== 0
}

// ─── Component ────────────────────────────────────────────────────────────────
export function SupervisorVendedoresView() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [filtroEstado, setFiltroEstado] = useState<"all" | "habilitado" | "deshabilitado">("all")

  // Detalle vendedor
  const [detalleVendedor, setDetalleVendedor] = useState<Vendedor | null>(null)
  const [metricas, setMetricas] = useState<MetricasVendedor | null>(null)
  const [metricasEquipo, setMetricasEquipo] = useState<MetricasEquipo | null>(null)
  const [loadingMetricas, setLoadingMetricas] = useState(false)

  // Prospectos del vendedor
  const [prospectosVendedor, setProspectosVendedor] = useState<ProspectoVendedor[]>([])
  const [loadingProspectos, setLoadingProspectos] = useState(false)
  const [vendedorProspectos, setVendedorProspectos] = useState<Vendedor | null>(null)
  const [selectedProspectos, setSelectedProspectos] = useState<number[]>([])
  const [showProspectosModal, setShowProspectosModal] = useState(false)

  // Reasignar
  const [showReasignarModal, setShowReasignarModal] = useState(false)
  const [nuevoVendedorId, setNuevoVendedorId] = useState("")
  const [reasignando, setReasignando] = useState(false)

  // Categoría
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [showCategoriaModal, setShowCategoriaModal] = useState(false)
  const [vendedorCategoria, setVendedorCategoria] = useState<Vendedor | null>(null)
  const [selectedCategoriaId, setSelectedCategoriaId] = useState("")
  const [guardandoCategoria, setGuardandoCategoria] = useState(false)

  // Eliminar
  const [confirmEliminar, setConfirmEliminar] = useState<Vendedor | null>(null)
  const [eliminando, setEliminando] = useState(false)

  // Toggle habilitar
  const [togglingId, setTogglingId] = useState<number | null>(null)

  // Spinner botones de fila (detalle + prospectos)
  const [loadingBtnId, setLoadingBtnId] = useState<Record<string, boolean>>({})
  const setBtnLoad = (id: number, action: string, val: boolean) =>
    setLoadingBtnId(prev => ({ ...prev, [`${id}-${action}`]: val }))
  const isBtnLoad = (id: number, action: string) => !!loadingBtnId[`${id}-${action}`]

  // ─── Fetch ──────────────────────────────────────────────────────────────────
  const fetchVendedores = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API_URL}/supervisor/vendedores`, { headers: authHeaders() })
      setVendedores(data ?? [])
    } catch {
      toast.error("No se pudieron cargar los vendedores.")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCategorias = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/admin/categorias`, { headers: authHeaders() })
      setCategorias((data ?? []).filter((c: Categoria) => c.activa !== false))
    } catch {
      // categorías opcionales, no bloquea
    }
  }, [])

  // Métricas agregadas del equipo (paridad con `VendedoresSupervisor.jsx`).
  const fetchMetricasEquipo = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/supervisor/metricas`, { headers: authHeaders() })
      const porVendedor = data?.prospectosPorVendedor ?? data?.data?.prospectosPorVendedor ?? []
      setMetricasEquipo({
        totalVendedores: porVendedor.length,
        vendedoresActivos: porVendedor.filter((v: { total_prospectos?: number }) => (v.total_prospectos ?? 0) > 0).length,
        prospectosPorVendedor: porVendedor,
      })
    } catch {
      // no bloquea el listado
    }
  }, [])

  useEffect(() => {
    fetchMetricasEquipo()
    fetchVendedores()
    fetchCategorias()
  }, [fetchVendedores, fetchCategorias])

  // ─── Detalle ─────────────────────────────────────────────────────────────────
  const abrirDetalle = async (v: Vendedor) => {
    setBtnLoad(v.id, "detalle", true)
    setDetalleVendedor(v)
    setMetricas(null)
    setLoadingMetricas(true)
    try {
      const { data } = await axios.get(`${API_URL}/supervisor/vendedores/${v.id}/metricas`, { headers: authHeaders() })
      setMetricas(data)
    } catch {
      // métricas opcionales
    } finally {
      setLoadingMetricas(false)
      setBtnLoad(v.id, "detalle", false)
    }
  }

  // ─── Prospectos ──────────────────────────────────────────────────────────────
  const abrirProspectos = async (v: Vendedor) => {
    setBtnLoad(v.id, "prospectos", true)
    setVendedorProspectos(v)
    setSelectedProspectos([])
    setNuevoVendedorId("")
    setShowProspectosModal(true)
    setLoadingProspectos(true)
    try {
      const { data } = await axios.get(`${API_URL}/supervisor/vendedores/${v.id}/prospectos`, { headers: authHeaders() })
      setProspectosVendedor(data ?? [])
    } catch {
      toast.error("No se pudieron cargar los prospectos.")
    } finally {
      setLoadingProspectos(false)
      setBtnLoad(v.id, "prospectos", false)
    }
  }

  const toggleProspecto = (id: number) => {
    setSelectedProspectos(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const toggleTodosProspectos = () => {
    setSelectedProspectos(prev =>
      prev.length === prospectosVendedor.length ? [] : prospectosVendedor.map(p => p.id)
    )
  }

  // ─── Reasignar ───────────────────────────────────────────────────────────────
  const handleReasignar = async () => {
    if (!nuevoVendedorId || selectedProspectos.length === 0) {
      toast.warning("Seleccioná al menos un prospecto y un vendedor destino.")
      return
    }
    setReasignando(true)
    try {
      await axios.post(
        `${API_URL}/supervisor/reasignar-prospectos`,
        {
          prospectos: selectedProspectos,
          nuevo_vendedor_id: Number(nuevoVendedorId),
          vendedor_anterior_id: vendedorProspectos?.id,
        },
        { headers: authHeaders() }
      )
      toast.success(`${selectedProspectos.length} prospectos reasignados.`)
      setShowReasignarModal(false)
      setNuevoVendedorId("")
      // Refrescar prospectos y vendedores
      if (vendedorProspectos) await abrirProspectos(vendedorProspectos)
      await fetchVendedores()
    } catch {
      toast.error("Error al reasignar prospectos.")
    } finally {
      setReasignando(false)
    }
  }

  // ─── Toggle habilitar/deshabilitar ───────────────────────────────────────────
  const handleToggle = async (v: Vendedor) => {
    setTogglingId(v.id)
    try {
      const enabled = isEnabled(v)
      const endpoint = enabled
        ? `${API_URL}/supervisor/disable-vendedor/${v.id}`
        : `${API_URL}/supervisor/enable-vendedor/${v.id}`
      await axios.put(endpoint, {}, { headers: authHeaders() })
      toast.success(enabled ? "Vendedor deshabilitado." : "Vendedor habilitado.")
      setVendedores(prev => prev.map(x => x.id === v.id ? { ...x, is_enabled: !enabled } : x))
      if (detalleVendedor?.id === v.id) {
        setDetalleVendedor(prev => prev ? { ...prev, is_enabled: !enabled } : prev)
      }
    } catch {
      toast.error("Error al cambiar estado del vendedor.")
    } finally {
      setTogglingId(null)
    }
  }

  // ─── Eliminar ────────────────────────────────────────────────────────────────
  const handleEliminar = async () => {
    if (!confirmEliminar) return
    setEliminando(true)
    try {
      await axios.delete(`${API_URL}/supervisor/vendedores/${confirmEliminar.id}`, { headers: authHeaders() })
      toast.success("Vendedor eliminado.")
      setVendedores(prev => prev.filter(x => x.id !== confirmEliminar.id))
      if (detalleVendedor?.id === confirmEliminar.id) setDetalleVendedor(null)
      setConfirmEliminar(null)
    } catch (err: unknown) {
      // El backend distingue motivos concretos (p.ej. "tiene prospectos asignados,
      // reasigne primero") — mostrar un mensaje genérico los ocultaba siempre.
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? "No se pudo eliminar el vendedor.")
    } finally {
      setEliminando(false)
    }
  }

  // ─── Categoría ───────────────────────────────────────────────────────────────
  const abrirCategoria = (v: Vendedor) => {
    setVendedorCategoria(v)
    setSelectedCategoriaId(v.categoria_id ? String(v.categoria_id) : "__none__")
    setShowCategoriaModal(true)
  }

  const handleGuardarCategoria = async () => {
    if (!vendedorCategoria) return
    setGuardandoCategoria(true)
    try {
      await axios.put(
        `${API_URL}/admin/categorias/vendedor/${vendedorCategoria.id}/categoria`,
        { categoriaId: (selectedCategoriaId && selectedCategoriaId !== "__none__") ? selectedCategoriaId : null },
        { headers: authHeaders() }
      )
      toast.success("Categoría asignada correctamente.")
      setShowCategoriaModal(false)
      await fetchVendedores()
    } catch {
      toast.error("Error al asignar la categoría.")
    } finally {
      setGuardandoCategoria(false)
    }
  }

  // ─── Filter ──────────────────────────────────────────────────────────────────
  const vendedoresFiltrados = vendedores
    .filter(v => {
      const term = busqueda.toLowerCase()
      const coincide =
        !term ||
        v.first_name?.toLowerCase().includes(term) ||
        v.last_name?.toLowerCase().includes(term) ||
        v.email?.toLowerCase().includes(term) ||
        v.phone_number?.toLowerCase().includes(term)
      const coincideEstado =
        filtroEstado === "all" ||
        (filtroEstado === "habilitado" && isEnabled(v)) ||
        (filtroEstado === "deshabilitado" && !isEnabled(v))
      return coincide && coincideEstado
    })

  const categoriaBadge = (v: Vendedor) => {
    if (!v.categoria_nombre) return <Badge variant="outline" className="text-xs">Sin categoría</Badge>
    return <Badge variant="secondary" className="text-xs">{v.categoria_nombre}</Badge>
  }


  const columnsProspectos = useMemo<ColumnDef<ProspectoVendedor>[]>(() => [
    {
      id: "seleccionar",
      header: () => (
        <input
          type="checkbox"
          className="rounded border-input"
          checked={selectedProspectos.length === prospectosVendedor.length && prospectosVendedor.length > 0}
          onChange={toggleTodosProspectos}
        />
      ),
      enableSorting: false,
      meta: { className: "w-10" },
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="rounded border-input"
          checked={selectedProspectos.includes(row.original.id)}
          onChange={() => toggleProspecto(row.original.id)}
        />
      ),
    },
    {
      id: "nombre",
      header: "Nombre",
      accessorFn: (p) => `${p.nombre} ${p.apellido}`,
      cell: ({ row }) => (
        <div className="font-medium text-sm">
          {row.original.nombre} {row.original.apellido}
          <div className="md:hidden text-xs text-muted-foreground">{row.original.numero_contacto}</div>
        </div>
      ),
    },
    {
      id: "contacto",
      header: "Contacto",
      meta: { className: "hidden md:table-cell text-xs text-muted-foreground" },
      accessorFn: (p) => p.numero_contacto ?? "",
      cell: ({ row }) => (
        <>
          <div>{row.original.numero_contacto}</div>
          <div>{row.original.correo}</div>
        </>
      ),
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (p) => p.asignacion_estado ?? p.estado ?? "",
      cell: ({ row }) => getBadgeEstado(row.original.asignacion_estado ?? row.original.estado ?? ""),
    },
    {
      id: "fecha_asignacion",
      header: "F. Asignación",
      meta: { className: "hidden lg:table-cell text-xs text-muted-foreground" },
      accessorFn: (p) => p.fecha_asignacion ?? "",
      cell: ({ row }) => row.original.fecha_asignacion ? new Date(row.original.fecha_asignacion).toLocaleDateString("es-AR") : "—",
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selectedProspectos, prospectosVendedor])

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Métricas del equipo (GET /supervisor/metricas).
          Una regla horizontal de cifras, no cuatro tarjetas centradas: el
          ojo compara en vertical y el promedio se lee al lado del total. */}
      {metricasEquipo && (
        <Lectura>
          <LecturaItem rotulo="Vendedores" icono={Users} valor={metricasEquipo.totalVendedores} />
          <LecturaItem rotulo="Con prospectos" icono={UserCheck} valor={metricasEquipo.vendedoresActivos} />
          <LecturaItem rotulo="Prospectos totales" icono={BarChart2} valor={metricasEquipo.prospectosPorVendedor.reduce((s, v) => s + (v.total_prospectos ?? 0), 0)} />
          <LecturaItem
            rotulo="Promedio por vendedor"
            icono={BarChart2}
            valor={metricasEquipo.totalVendedores > 0
              ? Math.round(metricasEquipo.prospectosPorVendedor.reduce((s, v) => s + (v.total_prospectos ?? 0), 0) / metricasEquipo.totalVendedores)
              : 0}
          />
        </Lectura>
      )}

      {/* Controles */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, email..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <Select value={filtroEstado} onValueChange={v => setFiltroEstado(v as typeof filtroEstado)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="habilitado">Habilitados</SelectItem>
            <SelectItem value="deshabilitado">Deshabilitados</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchVendedores} disabled={loading}>
          <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
        <p className="text-xs text-muted-foreground ml-auto">
          {vendedoresFiltrados.length} vendedores
        </p>
      </div>

      {/* Registro del equipo. Una sola implementación: antes había una
          DataTable para escritorio y una grilla de tarjetas para móvil, con
          acciones distintas en cada una. La retícula se apila sola. */}
      {loading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : vendedoresFiltrados.length === 0 ? (
        <EstadoVacio
          icono={Users}
          titulo="No hay vendedores"
          descripcion="Ninguno coincide con los filtros aplicados."
        />
      ) : (
        <div className="reg reg--sup-vend border-t-2 border-rule-heavy" role="table" aria-label="Vendedores del equipo">
          <div role="rowgroup">
            <div role="row" className="reg-row reg-head">
              <span role="columnheader" className="f-num">Nº</span>
              <span role="columnheader">Vendedor</span>
              <span role="columnheader">Contacto</span>
              <span role="columnheader">Categoría</span>
              <span role="columnheader" className="text-right">Cartera</span>
              <span role="columnheader">Estado</span>
              <span role="columnheader" />
            </div>
          </div>

          <div role="rowgroup">
            {vendedoresFiltrados.map(v => (
              <div
                key={v.id}
                role="row"
                className={`reg-row reg-entry${isEnabled(v) ? "" : " opacity-60"}`}
              >
                {/* 1 · folio — el id real, que es como se nombra al vendedor acá */}
                <span role="cell" className="f-num">
                  <span className="folio-n">{String(v.id).padStart(4, "0")}</span>
                </span>

                {/* 2 · vendedor — el eje */}
                <span role="cell" className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">
                    {v.last_name}<span className="font-normal text-muted-foreground">, {v.first_name}</span>
                  </span>
                  {v.email && <span className="block truncate text-[11.5px] text-muted-foreground">{v.email}</span>}
                </span>

                {/* 3 · contacto */}
                <span role="cell" className="truncate text-[12.5px] tabular-nums text-muted-foreground">
                  {v.phone_number || "—"}
                </span>

                {/* 4 · categoría */}
                <span role="cell" className="min-w-0">{categoriaBadge(v)}</span>

                {/* 5 · cartera */}
                <span role="cell" className="text-right text-[13px] font-semibold tabular-nums">
                  {v.total_prospectos ?? 0}
                </span>

                {/* 6 · estado */}
                <span role="cell" className="min-w-0">
                  <Badge variant={isEnabled(v) ? "ok" : "secondary"} size="sm" className="pointer-events-none">
                    {isEnabled(v) ? "Habilitado" : "Deshabilitado"}
                  </Badge>
                </span>

                {/* 7 · acciones */}
                <span role="cell" className="reg-actions">
                  <Button size="icon" variant="ghost" className="size-7" title="Ver detalle"
                    disabled={isBtnLoad(v.id, "detalle")} onClick={() => abrirDetalle(v)}>
                    {isBtnLoad(v.id, "detalle") ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7" title="Ver prospectos"
                    disabled={isBtnLoad(v.id, "prospectos")} onClick={() => abrirProspectos(v)}>
                    {isBtnLoad(v.id, "prospectos") ? <Loader2 className="size-3.5 animate-spin" /> : <Users className="size-3.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7" title="Cambiar categoría"
                    onClick={() => abrirCategoria(v)}>
                    <Tag className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7"
                    title={isEnabled(v) ? "Deshabilitar" : "Habilitar"}
                    disabled={togglingId === v.id} onClick={() => handleToggle(v)}>
                    {togglingId === v.id
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : isEnabled(v) ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7 text-destructive hover:text-destructive"
                    title="Eliminar vendedor" onClick={() => setConfirmEliminar(v)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Modal Detalle ─────────────────────────────────────────────────── */}
      <Dialog open={!!detalleVendedor} onOpenChange={o => { if (!o) setDetalleVendedor(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-4" />Detalle del Vendedor
            </DialogTitle>
          </DialogHeader>
          {detalleVendedor && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div><p className="text-xs text-muted-foreground">ID</p><p className="font-medium">{detalleVendedor.id}</p></div>
                <div><p className="text-xs text-muted-foreground">Nombre</p><p className="font-medium">{nombreCompleto(detalleVendedor)}</p></div>
                <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium break-all">{detalleVendedor.email}</p></div>
                <div><p className="text-xs text-muted-foreground">Teléfono</p><p className="font-medium">{detalleVendedor.phone_number || "No disponible"}</p></div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Estado</p>
                  <Badge variant={isEnabled(detalleVendedor) ? "ok" : "secondary"} className="text-xs">
                    {isEnabled(detalleVendedor) ? "Habilitado" : "Deshabilitado"}
                  </Badge>
                </div>
                <div><p className="text-xs text-muted-foreground">Prospectos</p><p className="font-bold">{detalleVendedor.total_prospectos ?? 0}</p></div>
                <div>
                  <p className="text-xs text-muted-foreground">Conversiones</p>
                  {loadingMetricas
                    ? <Skeleton className="h-4 w-10 mt-0.5" />
                    : <p className="font-bold">{metricas?.ventas ?? detalleVendedor.conversiones ?? 0}</p>
                  }
                </div>
                {detalleVendedor.created_at && (
                  <div>
                    <p className="text-xs text-muted-foreground">Alta</p>
                    <p className="text-xs">{new Date(detalleVendedor.created_at).toLocaleDateString("es-AR")}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1" onClick={() => { setDetalleVendedor(null); if (detalleVendedor) abrirProspectos(detalleVendedor) }}>
              <Users className="size-3 mr-1" />Ver Prospectos
            </Button>
            {detalleVendedor && (
              <Button
                variant={isEnabled(detalleVendedor) ? "secondary" : "default"}
                className="flex-1"
                disabled={togglingId === detalleVendedor.id}
                onClick={() => handleToggle(detalleVendedor)}
              >
                {isEnabled(detalleVendedor) ? <><UserX className="size-3 mr-1" />Deshabilitar</> : <><UserCheck className="size-3 mr-1" />Habilitar</>}
              </Button>
            )}
            {detalleVendedor && (
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => { setDetalleVendedor(null); setConfirmEliminar(detalleVendedor) }}
              >
                <Trash2 className="size-3 mr-1" />Eliminar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal Prospectos del vendedor ─────────────────────────────────── */}
      <Dialog open={showProspectosModal} onOpenChange={o => { if (!o) { setShowProspectosModal(false); setSelectedProspectos([]) } }}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-4" />
              Prospectos de {vendedorProspectos ? nombreCompleto(vendedorProspectos) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0">
            {loadingProspectos ? (
              <div className="space-y-2 p-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : prospectosVendedor.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="size-10 mx-auto mb-2 opacity-40" />
                <p>Este vendedor no tiene prospectos asignados.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-1 pb-2">
                  <p className="text-sm text-muted-foreground">
                    {prospectosVendedor.length} prospectos
                    {selectedProspectos.length > 0 && ` · ${selectedProspectos.length} seleccionados`}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={toggleTodosProspectos}>
                      {selectedProspectos.length === prospectosVendedor.length ? "Deseleccionar todo" : "Seleccionar todo"}
                    </Button>
                    {selectedProspectos.length > 0 && (
                      <Button size="sm" className="h-7 text-xs" onClick={() => setShowReasignarModal(true)}>
                        <ArrowRightLeft className="size-3 mr-1" />
                        Reasignar ({selectedProspectos.length})
                      </Button>
                    )}
                  </div>
                </div>
                <DataTable columns={columnsProspectos} data={prospectosVendedor} hideColumnToggle />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowProspectosModal(false); setSelectedProspectos([]) }}>
              Cerrar
            </Button>
            {selectedProspectos.length > 0 && (
              <Button onClick={() => setShowReasignarModal(true)}>
                <ArrowRightLeft className="size-3.5 mr-1" />
                Reasignar ({selectedProspectos.length})
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal Reasignar ───────────────────────────────────────────────── */}
      <Dialog open={showReasignarModal} onOpenChange={o => { if (!o) setShowReasignarModal(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reasignar Prospectos</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Reasignando <strong>{selectedProspectos.length}</strong> prospectos de{" "}
            <strong>{vendedorProspectos ? nombreCompleto(vendedorProspectos) : ""}</strong>
          </p>
          <div className="space-y-1">
            <Label>Nuevo vendedor destino</Label>
            <Select value={nuevoVendedorId} onValueChange={setNuevoVendedorId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar vendedor..." /></SelectTrigger>
              <SelectContent>
                {vendedores
                  .filter(v => v.id !== vendedorProspectos?.id && isEnabled(v))
                  .map(v => (
                    <SelectItem key={v.id} value={String(v.id)}>{nombreCompleto(v)}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          {selectedProspectos.length > 0 && (
            <div className="bg-paper-sunk rounded-lg p-3 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold mb-1">Prospectos seleccionados:</p>
              <ul className="text-xs space-y-0.5">
                {prospectosVendedor
                  .filter(p => selectedProspectos.includes(p.id))
                  .map(p => <li key={p.id}>{p.nombre} {p.apellido} (ID: {p.id})</li>)}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReasignarModal(false)}>Cancelar</Button>
            <Button onClick={handleReasignar} disabled={!nuevoVendedorId || reasignando}>
              <ArrowRightLeft className="size-3.5 mr-1" />
              {reasignando ? "Reasignando..." : "Reasignar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal Categoría ──────────────────────────────────────────────── */}
      <Dialog open={showCategoriaModal} onOpenChange={o => { if (!o) setShowCategoriaModal(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="size-4" />Cambiar Categoría
            </DialogTitle>
          </DialogHeader>
          {vendedorCategoria && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vendedor:</span>
                <span className="font-medium">{nombreCompleto(vendedorCategoria)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Categoría actual:</span>
                {categoriaBadge(vendedorCategoria)}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Carga actual:</span>
                <span className="font-medium">{vendedorCategoria.total_prospectos ?? 0} prospectos</span>
              </div>
              <div className="space-y-1 pt-1">
                <Label>Nueva categoría</Label>
                <Select value={selectedCategoriaId} onValueChange={setSelectedCategoriaId}>
                  <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin categoría asignada</SelectItem>
                    {categorias.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.nombre}{c.capacidad_maxima ? ` (Cap: ${c.capacidad_maxima})` : ""}{c.prioridad ? `, Prior: ${c.prioridad}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  La categoría determina la capacidad máxima y prioridad en la distribución de prospectos.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoriaModal(false)}>Cancelar</Button>
            <Button onClick={handleGuardarCategoria} disabled={guardandoCategoria}>
              <Tag className="size-3.5 mr-1" />
              {guardandoCategoria ? "Guardando..." : "Cambiar Categoría"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Confirm Eliminar ─────────────────────────────────────────────── */}
      <Dialog open={!!confirmEliminar} onOpenChange={o => { if (!o) setConfirmEliminar(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar vendedor?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción eliminará permanentemente a{" "}
            <strong>{confirmEliminar ? nombreCompleto(confirmEliminar) : ""}</strong>.
            Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEliminar(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleEliminar}
              disabled={eliminando}
            >
              {eliminando ? "Eliminando..." : "Sí, eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
