import { useState, useEffect } from "react"
import axios from "axios"
import { toast } from "sonner"
import { Tag, Check, TrendingUp, CalendarDays } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Promocion {
  id: number
  nombre?: string
  titulo?: string
  descripcion?: string
  descuento?: number
  descuento_porcentaje?: number
  /** ENUM backend `descuento`|`incremento` (`promociones.tipo`, default `descuento`). */
  tipo?: "descuento" | "incremento"
  fecha_vencimiento?: string
  vigencia_hasta?: string
}

interface PromocionesModalProps {
  prospectoId: number
  open: boolean
  onClose: () => void
  onPromocionAplicada: () => void
}

export function PromocionesModal({ prospectoId, open, onClose, onPromocionAplicada }: PromocionesModalProps) {
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [selected, setSelected] = useState<Promocion | null>(null)
  const [loading, setLoading] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [promocionActual, setPromocionActual] = useState<Promocion | null>(null)

  const authHeaders = { Authorization: `Bearer ${getAuthToken()}` }

  const fetchPromociones = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API_URL}/vendedor/promociones`, { headers: authHeaders })
      setPromociones(data)
    } catch {
      toast.error("Error al cargar promociones")
    } finally {
      setLoading(false)
    }
  }

  const fetchPromocionActual = async () => {
    try {
      const { data } = await axios.get(
        `${API_URL}/vendedor/prospectos/${prospectoId}/promocion-actual`,
        { headers: authHeaders }
      )
      setPromocionActual(data?.promocion ?? null)
    } catch {
      // silencioso
    }
  }

  useEffect(() => {
    if (open) {
      fetchPromociones()
      fetchPromocionActual()
      setSelected(null)
    }
  }, [open, prospectoId])

  const handleAplicar = async () => {
    if (!selected) return
    setAplicando(true)
    try {
      await axios.post(
        `${API_URL}/vendedor/prospectos/${prospectoId}/aplicar-promocion`,
        { promocionId: selected.id },
        { headers: authHeaders }
      )
      const nombre = selected.nombre ?? selected.titulo
      const descuento = selected.descuento_porcentaje ?? selected.descuento
      toast.success(`¡Promoción "${nombre}" con ${descuento}% aplicada correctamente!`)
      onClose()
      onPromocionAplicada()
    } catch {
      toast.error("No se pudo aplicar la promoción. Intentá de nuevo.")
    } finally {
      setAplicando(false)
    }
  }

  const getDescuento = (p: Promocion) => p.descuento_porcentaje ?? p.descuento ?? 0
  const getNombre = (p: Promocion) => p.nombre ?? p.titulo ?? "Promoción"
  const getVencimiento = (p: Promocion) => p.fecha_vencimiento ?? p.vigencia_hasta

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="size-5" />Aplicar Promoción
          </DialogTitle>
        </DialogHeader>

        {promocionActual && (
          <div className="rounded-lg border bg-muted p-3 text-sm">
            <p className="font-semibold mb-0.5">Promoción actualmente aplicada:</p>
            <p className="text-muted-foreground">
              <strong>{getNombre(promocionActual)}</strong> — {promocionActual.tipo === "incremento" ? "+" : "-"}{getDescuento(promocionActual)}%
            </p>
            {promocionActual.descripcion && (
              <p className="text-muted-foreground text-xs mt-0.5">{promocionActual.descripcion}</p>
            )}
          </div>
        )}

        {loading ? (
          <div className="border-t-2 border-rule-heavy" aria-busy="true" aria-live="polite">
            <span className="sr-only">Cargando promociones…</span>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-rule px-4 py-3">
                <Skeleton className="size-4 shrink-0 rounded-stamp" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40 rounded-xs" />
                  <Skeleton className="h-3 w-56 rounded-xs" />
                </div>
                <Skeleton className="h-[22px] w-28 shrink-0 rounded-stamp" />
              </div>
            ))}
          </div>
        ) : promociones.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No hay promociones disponibles</p>
        ) : (
          /* Lista reglada, no grilla de tarjetas: elegir una promoción es
             recorrer un registro, y la selección se marca con superficie y
             filete en vez de levantar una tarjeta. */
          <div role="radiogroup" aria-label="Promociones disponibles" className="border-t-2 border-rule-heavy">
            {promociones.map(p => {
              const activa = selected?.id === p.id
              const vence = getVencimiento(p)
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={activa}
                  onClick={() => setSelected(prev => prev?.id === p.id ? null : p)}
                  className={`flex w-full items-center gap-3 border-b border-rule px-4 py-3 text-left transition-colors ${
                    activa ? "bg-primary/5" : "hover:bg-paper-sunk"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-4 shrink-0 items-center justify-center rounded-stamp border ${
                      activa
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-rule-firm"
                    }`}
                  >
                    {activa && <Check className="size-3" />}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[13px] font-semibold ${activa ? "text-primary" : ""}`}>
                      {getNombre(p)}
                    </span>
                    {p.descripcion && (
                      <span className="block truncate text-[11.5px] text-muted-foreground">{p.descripcion}</span>
                    )}
                  </span>

                  {vence && (
                    <span className="hidden shrink-0 items-center gap-1 text-[11.5px] tabular-nums text-muted-foreground sm:flex">
                      <CalendarDays className="size-3" aria-hidden="true" />
                      Hasta {new Date(vence).toLocaleDateString("es-AR")}
                    </span>
                  )}

                  <Badge
                    variant={p.tipo === "incremento" ? "risk" : "ok"}
                    size="sm"
                    className="pointer-events-none shrink-0"
                  >
                    {p.tipo === "incremento" ? <TrendingUp aria-hidden="true" /> : <Tag aria-hidden="true" />}
                    {p.tipo === "incremento" ? "+" : "−"}{getDescuento(p)}%
                  </Badge>
                </button>
              )
            })}
          </div>
        )}

        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleAplicar} disabled={!selected || aplicando}>
            {aplicando ? "Aplicando..." : "Aplicar Promoción"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
