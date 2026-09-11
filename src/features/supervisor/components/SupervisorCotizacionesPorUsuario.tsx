import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import { Eye, MessageCircle, RefreshCw, ChevronDown, ChevronUp, Receipt } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { API_URL } from "@/lib/config"
import { getAuthHeaders } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

// ─────────────────────────────────────────────────────────────────────────────
// Cotizaciones agrupadas por prospecto, vista del supervisor.
//   GET /cotizaciones/todas              → listado general
//   GET /supervisor/cotizaciones/:id     → detalle por prospecto, agrupado por plan
// Reemplaza a CotizacionesPorUsuario + CotizacionesTable + CotizacionesCard.
// ─────────────────────────────────────────────────────────────────────────────

const TIPO_AFILIACION: Record<number, string> = {
  1: "Particular/autónomo",
  2: "Con recibo de sueldo",
  3: "Monotributista",
}

interface Cotizacion {
  id: number
  prospecto_id: number
  prospecto_nombre?: string
  prospecto_telefono?: string
  plan?: string
  plan_nombre?: string
  tipo_afiliacion_id?: number
  total_bruto?: number
  total_final?: number
  precio_final?: number
  /** Alias real a nivel cotización: `c.total_descuento_promocion` (`cotizacionesController.js`
   * listarTodasLasCotizaciones) — `descuento_promocion` sólo existe dentro de `detalles[]`. */
  total_descuento_promocion?: number
  created_at?: string
}

const formatCurrency = (v: number | undefined) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 })
    .format(Number(v ?? 0))

/**
 * Un `descuento_promocion` negativo representa un INCREMENTO sobre el precio,
 * no un descuento. Misma regla que producción.
 */
function infoPromocion(valor: number | undefined) {
  const num = Number(valor ?? 0)
  const esIncremento = num < 0
  return {
    esIncremento,
    monto: esIncremento ? `+ ${formatCurrency(Math.abs(num))}` : formatCurrency(num),
    label: esIncremento ? "Incremento" : "Promoción",
    clase: esIncremento ? "text-state-risk-text" : "text-state-ok-text",
  }
}

export function SupervisorCotizacionesPorUsuario() {
  const [cotizaciones, setCotizaciones] = React.useState<Cotizacion[]>([])
  const [loading, setLoading] = React.useState(true)
  const [expandido, setExpandido] = React.useState<Record<number, boolean>>({})

  // Modal detalle por prospecto
  const [modal, setModal] = React.useState<{ open: boolean; nombre: string }>({ open: false, nombre: "" })
  const [detalle, setDetalle] = React.useState<Record<string, Cotizacion[]>>({})
  const [loadingDetalle, setLoadingDetalle] = React.useState(false)

  const fetchTodas = React.useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API_URL}/cotizaciones/todas`, { headers: getAuthHeaders() })
      const lista = data?.data ?? data ?? []
      setCotizaciones(Array.isArray(lista) ? lista : [])
    } catch {
      toast.error("No se pudieron cargar las cotizaciones")
      setCotizaciones([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { fetchTodas() }, [fetchTodas])

  // Agrupar por prospecto
  const porProspecto = React.useMemo(() => {
    const acc: Record<number, { nombre: string; telefono?: string; items: Cotizacion[] }> = {}
    for (const c of cotizaciones) {
      if (!acc[c.prospecto_id]) {
        acc[c.prospecto_id] = {
          nombre: c.prospecto_nombre ?? "Sin nombre",
          telefono: c.prospecto_telefono,
          items: [],
        }
      }
      acc[c.prospecto_id].items.push(c)
    }
    return acc
  }, [cotizaciones])

  const abrirDetalle = async (prospectoId: number, nombre: string) => {
    setModal({ open: true, nombre })
    setLoadingDetalle(true)
    setDetalle({})
    try {
      const { data } = await axios.get(`${API_URL}/supervisor/cotizaciones/${prospectoId}`, {
        headers: getAuthHeaders(),
      })
      const lista: Cotizacion[] = data?.data ?? data ?? []
      // Agrupar por plan, igual que `CotizacionesTable.jsx`
      const porPlan = (Array.isArray(lista) ? lista : []).reduce<Record<string, Cotizacion[]>>((acc, c) => {
        const plan = c.plan ?? c.plan_nombre ?? "Sin Plan"
        ;(acc[plan] ??= []).push(c)
        return acc
      }, {})
      setDetalle(porPlan)
    } catch {
      toast.error("No se pudieron cargar las cotizaciones del prospecto")
    } finally {
      setLoadingDetalle(false)
    }
  }

  const abrirWhatsApp = (telefono?: string) => {
    if (!telefono) { toast.error("El prospecto no tiene teléfono"); return }
    window.open(`https://wa.me/${telefono.replace(/\D/g, "")}`, "_blank")
  }

  const entradas = Object.entries(porProspecto)

  const columnsCotizacionesGrupo = React.useMemo<ColumnDef<Cotizacion>[]>(() => [
    {
      accessorKey: "plan",
      header: "Plan",
      cell: ({ row }) => (
        <Badge variant="outline" size="sm">
          {row.original.plan ?? row.original.plan_nombre ?? "Sin plan"}
        </Badge>
      ),
    },
    {
      id: "afiliacion",
      header: "Afiliación",
      meta: { className: "hidden sm:table-cell text-xs text-muted-foreground" },
      accessorFn: (c) => (c.tipo_afiliacion_id ? TIPO_AFILIACION[c.tipo_afiliacion_id] ?? "—" : "—"),
    },
    {
      accessorKey: "total_bruto",
      header: "Lista",
      meta: { className: "text-right text-xs text-muted-foreground", headerClassName: "text-right" },
      cell: ({ row }) => (row.original.total_bruto ? formatCurrency(row.original.total_bruto) : "—"),
    },
    {
      accessorKey: "total_descuento_promocion",
      header: "Promoción",
      meta: { className: "text-right text-xs", headerClassName: "text-right" },
      cell: ({ row }) => {
        const promo = infoPromocion(row.original.total_descuento_promocion)
        return <span className={promo.clase}>{row.original.total_descuento_promocion ? promo.monto : "—"}</span>
      },
    },
    {
      id: "final",
      header: "Final",
      meta: { className: "text-right font-semibold", headerClassName: "text-right" },
      accessorFn: (c) => c.total_final ?? c.precio_final ?? 0,
      cell: ({ row }) => formatCurrency(row.original.total_final ?? row.original.precio_final),
    },
  ], [])

  const columnsCotizacionesPlan = React.useMemo<ColumnDef<Cotizacion>[]>(() => [
    {
      id: "afiliacion",
      header: "Afiliación",
      meta: { className: "text-xs" },
      accessorFn: (c) => (c.tipo_afiliacion_id ? TIPO_AFILIACION[c.tipo_afiliacion_id] ?? "—" : "—"),
    },
    {
      accessorKey: "total_bruto",
      header: "Lista",
      meta: { className: "text-xs text-right text-muted-foreground", headerClassName: "text-xs text-right" },
      cell: ({ row }) => (row.original.total_bruto ? formatCurrency(row.original.total_bruto) : "—"),
    },
    {
      accessorKey: "total_descuento_promocion",
      header: "Promoción",
      meta: { className: "text-xs text-right", headerClassName: "text-xs text-right" },
      cell: ({ row }) => {
        const promo = infoPromocion(row.original.total_descuento_promocion)
        return <span className={promo.clase}>{row.original.total_descuento_promocion ? promo.monto : "—"}</span>
      },
    },
    {
      id: "final",
      header: "Final",
      meta: { className: "text-xs text-right font-semibold", headerClassName: "text-xs text-right" },
      accessorFn: (c) => c.total_final ?? c.precio_final ?? 0,
      cell: ({ row }) => formatCurrency(row.original.total_final ?? row.original.precio_final),
    },
  ], [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Cotizaciones por prospecto{!loading && ` · ${entradas.length}`}
        </h2>
        <Button variant="outline" size="sm" onClick={fetchTodas} disabled={loading}>
          <RefreshCw className={cn("size-3.5 mr-1", loading && "animate-spin")} />Actualizar
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : entradas.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Receipt className="size-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay cotizaciones registradas.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {entradas.map(([id, grupo]) => {
            const prospectoId = Number(id)
            const abierto = !!expandido[prospectoId]
            return (
              <Card key={id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between gap-3 p-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-left flex-1 min-w-0"
                      onClick={() => setExpandido(e => ({ ...e, [prospectoId]: !abierto }))}
                    >
                      {abierto ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
                      <span className="min-w-0">
                        <span className="block font-medium text-sm truncate">{grupo.nombre}</span>
                        <span className="block text-xs text-muted-foreground">
                          {grupo.items.length} cotización{grupo.items.length !== 1 ? "es" : ""}
                        </span>
                      </span>
                    </button>
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="icon" variant="outline" className="size-8"
                        onClick={() => abrirWhatsApp(grupo.telefono)} title="WhatsApp">
                        <MessageCircle className="size-3.5 text-green-600" />
                      </Button>
                      <Button size="icon" variant="outline" className="size-8"
                        onClick={() => abrirDetalle(prospectoId, grupo.nombre)} title="Ver detalle">
                        <Eye className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {abierto && (
                    <div className="border-t bg-muted/30 p-3">
                      <DataTable columns={columnsCotizacionesGrupo} data={grupo.items} hideColumnToggle />
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Detalle por prospecto, agrupado por plan */}
      <Dialog open={modal.open} onOpenChange={o => setModal(m => ({ ...m, open: o }))}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cotizaciones de {modal.nombre}</DialogTitle>
          </DialogHeader>
          {loadingDetalle ? (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : Object.keys(detalle).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sin cotizaciones.</p>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {Object.entries(detalle).map(([plan, items]) => (
                <div key={plan}>
                  <Badge variant="outline" className="mb-2">{plan}</Badge>
                  <DataTable columns={columnsCotizacionesPlan} data={items} hideColumnToggle />
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SupervisorCotizacionesPorUsuario
