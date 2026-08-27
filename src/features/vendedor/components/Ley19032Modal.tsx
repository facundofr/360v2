import { useState, useEffect, useMemo } from "react"
import axios from "axios"
import { toast } from "sonner"
import { Calculator } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Integrante {
  nombre?: string
  vinculo?: string
  tipo_afiliacion_id?: number
}

interface Cotizacion {
  id: number
  plan_nombre?: string
  detalles?: { tipo_afiliacion_id?: number; vinculo?: string }[]
}

interface CalcPreview {
  nombre: string
  vinculo: string
  importeLey19032: number
  sueldoBruto: number
  aportePresuntivo: number
}

interface Ley19032ModalProps {
  prospectoId: number
  open: boolean
  onClose: () => void
  onAplicada: () => void
  integrantesConReciboSueldo?: Integrante[]
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(amount)
}

export function Ley19032Modal({
  prospectoId,
  open,
  onClose,
  onAplicada,
  integrantesConReciboSueldo = [],
}: Ley19032ModalProps) {
  const [loading, setLoading] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [totalConRecibo, setTotalConRecibo] = useState(0)
  const [importes, setImportes] = useState<Record<number, string>>({})
  const authHeaders = { Authorization: `Bearer ${getAuthToken()}` }

  // Deduplicar integrantes por vinculo+nombre
  const integrantesUnicos = useMemo(() => {
    const map = new Map<string, Integrante>()
    integrantesConReciboSueldo.forEach(i => {
      const key = `${(i.vinculo ?? "").toLowerCase()}|${(i.nombre ?? "").trim()}`
      if (!map.has(key)) map.set(key, i)
    })
    return Array.from(map.values())
  }, [integrantesConReciboSueldo])

  // Calcular preview en tiempo real
  const previewCalc = useMemo(() => {
    const newPreview: Record<number, CalcPreview> = {}
    integrantesUnicos.forEach((integrante, idx) => {
      const importe = parseFloat(importes[idx] ?? "0")
      if (importe > 0) {
        const sueldoBruto = importe / 0.03
        const aportePresuntivo = sueldoBruto * 0.06732
        newPreview[idx] = {
          nombre: integrante.nombre ?? `Integrante ${idx + 1}`,
          vinculo: integrante.vinculo ?? "",
          importeLey19032: importe,
          sueldoBruto,
          aportePresuntivo,
        }
      }
    })
    return newPreview
  }, [importes, integrantesUnicos])

  useEffect(() => {
    if (!open) return
    const doFetch = async () => {
      setLoading(true)
      try {
        const { data } = await axios.get(
          `${API_URL}/lead/${prospectoId}/cotizaciones?detalles=1`,
          { headers: authHeaders }
        )
        const conRecibo = (data as Cotizacion[]).filter(c =>
          c.detalles?.some(d => d.tipo_afiliacion_id === 2)
        )
        setCotizaciones(conRecibo)
        const total = conRecibo.reduce(
          (sum, c) => sum + (c.detalles?.filter(d => d.tipo_afiliacion_id === 2).length ?? 0),
          0
        )
        setTotalConRecibo(total)
      } catch {
        toast.error("No se pudieron cargar las cotizaciones")
      } finally {
        setLoading(false)
      }
    }
    doFetch()
  }, [open, prospectoId])

  const handleAplicar = async () => {
    if (cotizaciones.length === 0) {
      toast.error("No hay cotizaciones con personas que tengan recibo de sueldo")
      return
    }
    if (Object.keys(previewCalc).length === 0) {
      toast.error("Ingresá importes válidos de Ley 19032 para al menos un integrante")
      return
    }
    setAplicando(true)
    try {
      const integrantesConAporte = Object.values(previewCalc).map(d => ({
        nombre: d.nombre,
        vinculo: d.vinculo,
        importe_ley19032: d.importeLey19032,
        sueldo_bruto_calculado: d.sueldoBruto,
        aporte_presuntivo: d.aportePresuntivo,
      }))
      await Promise.all(
        cotizaciones.map(c =>
          axios.post(
            `${API_URL}/cotizaciones/${c.id}/aplicar-ley19032`,
            { integrantesConAporte },
            { headers: authHeaders }
          )
        )
      )
      const totalAporte = Object.values(previewCalc).reduce((s, c) => s + c.aportePresuntivo, 0)
      toast.success(
        `Aporte presuntivo de ${formatCurrency(totalAporte)} aplicado a ${Object.keys(previewCalc).length} integrante(s)`
      )
      onAplicada()
      handleClose()
    } catch {
      toast.error("No se pudo aplicar la Ley 19032")
    } finally {
      setAplicando(false)
    }
  }

  const handleClose = () => {
    setImportes({})
    onClose()
  }

  const totalAportePreview = Object.values(previewCalc).reduce((s, c) => s + c.aportePresuntivo, 0)

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="sm:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="size-5" />Aplicar Ley 19032 — Aporte Presuntivo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted p-3 text-sm">
            <p className="font-semibold">Ley 19032 — Cálculo de Aporte Presuntivo</p>
            <p className="text-muted-foreground mt-1">
              Ingresá el importe de descuento de Ley 19032 del recibo de sueldo.
              Se aplica automáticamente a todas las cotizaciones con personas de recibo de sueldo.
            </p>
            <div className="mt-2 rounded bg-background px-3 py-1.5 font-mono text-xs text-muted-foreground">
              Fórmula: (Ley 19032 ÷ 0.03) × 0.06732 = Aporte Presuntivo
            </div>
          </div>

          {loading ? (
            <Skeleton className="h-20 w-full rounded-lg" />
          ) : cotizaciones.length === 0 ? (
            <div className="rounded-lg border border-state-warn/30 bg-state-warn-soft p-3 text-sm text-state-warn-text">
              No hay cotizaciones con tipo de afiliación "Con recibo de sueldo"
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-state-ok/30 bg-state-ok-soft p-3 text-sm">
                <p className="text-state-ok-text">
                  <strong>Cotizaciones encontradas:</strong> {cotizaciones.length} &nbsp;·&nbsp;
                  <strong>Personas con recibo de sueldo:</strong> {totalConRecibo}
                </p>
              </div>

              {integrantesUnicos.length > 0 && (
                <div className="space-y-3">
                  <p className="font-medium text-sm">Ingresá el importe de Ley 19032 por integrante:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {integrantesUnicos.map((integrante, idx) => (
                      <div key={idx} className="rounded-lg border p-3 space-y-2">
                        <Label className="text-xs font-semibold">
                          {integrante.nombre ?? `Integrante ${idx + 1}`}
                          {integrante.vinculo && (
                            <span className="text-muted-foreground font-normal ml-1">({integrante.vinculo})</span>
                          )}
                        </Label>
                        <Input
                          type="number"
                          placeholder="Importe Ley 19032..."
                          value={importes[idx] ?? ""}
                          onChange={e => setImportes({ ...importes, [idx]: e.target.value })}
                        />
                        {previewCalc[idx] && (
                          <div className="rounded bg-muted p-2 text-xs space-y-0.5">
                            <p>Sueldo bruto calculado: <strong>{formatCurrency(previewCalc[idx].sueldoBruto)}</strong></p>
                            <p className="text-muted-foreground">
                              Aporte presuntivo: <strong>{formatCurrency(previewCalc[idx].aportePresuntivo)}</strong>
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(previewCalc).length > 0 && (
                <div className="rounded-lg border">
                  <p className="font-semibold text-sm px-4 pt-3 pb-2">Preview del cálculo:</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Integrante</TableHead>
                        <TableHead>Importe Ley 19032</TableHead>
                        <TableHead>Aporte Presuntivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.values(previewCalc).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>{row.nombre} <span className="text-xs text-muted-foreground">({row.vinculo})</span></TableCell>
                          <TableCell>{formatCurrency(row.importeLey19032)}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(row.aportePresuntivo)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={2} className="font-bold text-right">Total:</TableCell>
                        <TableCell className="font-bold">{formatCurrency(totalAportePreview)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={handleAplicar}
            disabled={aplicando || cotizaciones.length === 0 || Object.keys(previewCalc).length === 0}
          >
            <Calculator className="size-4 mr-2" />
            {aplicando ? "Aplicando..." : "Aplicar Ley 19032"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
