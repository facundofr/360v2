import { useState, useEffect } from "react"
import axios from "axios"
import { toast } from "sonner"
import { Tag, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
              <strong>{getNombre(promocionActual)}</strong> — {getDescuento(promocionActual)}%
            </p>
            {promocionActual.descripcion && (
              <p className="text-muted-foreground text-xs mt-0.5">{promocionActual.descripcion}</p>
            )}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : promociones.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No hay promociones disponibles</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {promociones.map(p => (
              <Card
                key={p.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selected?.id === p.id
                    ? "border-primary border-2 bg-primary/5 shadow-md"
                    : "hover:border-muted-foreground/30"
                }`}
                onClick={() => setSelected(prev => prev?.id === p.id ? null : p)}
              >
                <CardHeader className="pb-2 relative">
                  {selected?.id === p.id && (
                    <div className="absolute top-3 right-3 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="size-3" />
                    </div>
                  )}
                  <CardTitle className={`text-sm ${selected?.id === p.id ? "text-primary" : ""}`}>
                    {getNombre(p)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-1">
                  {p.descripcion && <p className="text-xs text-muted-foreground">{p.descripcion}</p>}
                  <Badge variant="ok">
                    🎯 Descuento: {getDescuento(p)}%
                  </Badge>
                  {getVencimiento(p) && (
                    <p className="text-xs text-muted-foreground">
                      📅 Válido hasta: {new Date(getVencimiento(p)!).toLocaleDateString("es-AR")}
                    </p>
                  )}
                  {selected?.id === p.id && (
                    <p className="text-xs font-semibold text-state-ok-text">✅ Seleccionada</p>
                  )}
                </CardContent>
              </Card>
            ))}
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
