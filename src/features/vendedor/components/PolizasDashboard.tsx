import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import { Eye, Edit2, Download, ArrowRightLeft, LayoutGrid, List, Loader2, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface HistorialEstado {
  id?: number
  estado_anterior?: string
  estado_nuevo?: string
  motivo?: string
  usuario_nombre?: string
  created_at?: string
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

interface PolizasDashboardProps {
  polizas: Poliza[]
  loadingPolizas: boolean
  onVerDocumentos?: (poliza: Poliza) => void
  onEditarPoliza?: (poliza: Poliza) => void
  onRecargar?: () => void
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(v)
}

function formatFecha(d?: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("es-AR")
}

function getEstadoBadge(estado?: string) {
  const map: Record<string, "warn" | "ok" | "risk" | "secondary"> = {
    asesor: "warn",
    supervisor: "warn",
    auditoria: "warn",
    aprobado: "ok",
    rechazado: "risk",
    vigente: "ok",
    vencido: "secondary",
  }
  const key = (estado ?? "").toLowerCase()
  return (
    <Badge variant={map[key] ?? "secondary"} className="text-xs">
      {estado ?? "—"}
    </Badge>
  )
}

const getHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` })

export default function PolizasDashboard({ polizas, loadingPolizas, onVerDocumentos, onEditarPoliza, onRecargar }: PolizasDashboardProps) {
  const [tipoVista, setTipoVista] = React.useState<"tabla" | "tarjetas">("tabla")
  const [modalSupervisor, setModalSupervisor] = React.useState<{ open: boolean; poliza: Poliza | null }>({ open: false, poliza: null })
  const [motivo, setMotivo] = React.useState("")
  const [enviando, setEnviando] = React.useState(false)
  const [historial, setHistorial] = React.useState<{
    open: boolean
    poliza: Poliza | null
    loading: boolean
    items: HistorialEstado[]
  }>({ open: false, poliza: null, loading: false, items: [] })

  // ─── Historial de estados de la póliza ────────────────────────────────────
  // GET /polizas/:id/historial-estados (paridad con `PolizasDashboard.jsx`).
  const verHistorial = async (poliza: Poliza) => {
    setHistorial({ open: true, poliza, loading: true, items: [] })
    try {
      const { data } = await axios.get(
        `${API_URL}/polizas/${poliza.id}/historial-estados`,
        { headers: getHeaders() }
      )
      setHistorial(h => ({ ...h, loading: false, items: data?.data ?? [] }))
    } catch {
      toast.error("No se pudo cargar el historial")
      setHistorial(h => ({ ...h, loading: false, items: [] }))
    }
  }

  const polizasArray = Array.isArray(polizas) ? polizas : []

  const handleEnviarSupervisor = async () => {
    if (!motivo.trim()) { toast.error("Ingresa un motivo"); return }
    if (!modalSupervisor.poliza) return
    setEnviando(true)
    try {
      await axios.patch(
        `${API_URL}/vendedor/${modalSupervisor.poliza.id}/enviar-supervisor`,
        { motivo_cambio_estado: motivo },
        { headers: getHeaders() }
      )
      toast.success("Póliza enviada a supervisor")
      setModalSupervisor({ open: false, poliza: null })
      setMotivo("")
      onRecargar?.()
    } catch {
      toast.error("Error al enviar a supervisor")
    } finally {
      setEnviando(false)
    }
  }

  if (loadingPolizas) {
    return <Skeleton className="h-64 w-full" />
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-muted-foreground">{polizasArray.length} póliza{polizasArray.length !== 1 ? "s" : ""}</p>
        <div className="flex gap-1">
          <Button size="icon" variant={tipoVista === "tabla" ? "default" : "ghost"} className="size-7" onClick={() => setTipoVista("tabla")}>
            <List className="size-3.5" />
          </Button>
          <Button size="icon" variant={tipoVista === "tarjetas" ? "default" : "ghost"} className="size-7" onClick={() => setTipoVista("tarjetas")}>
            <LayoutGrid className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Vista tabla */}
      {tipoVista === "tabla" && (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Póliza</TableHead>
                <TableHead className="hidden sm:table-cell">Prospecto</TableHead>
                <TableHead className="hidden md:table-cell">Plan</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden md:table-cell">Fecha</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {polizasArray.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                    No tienes pólizas generadas aún.
                  </TableCell>
                </TableRow>
              ) : polizasArray.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold text-xs">{p.numero_poliza_oficial ?? p.numero_poliza ?? `#${p.id}`}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{p.prospecto_nombre} {p.prospecto_apellido}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{p.plan_nombre}</TableCell>
                  <TableCell className="font-bold text-sm">{formatCurrency(p.total_final ?? 0)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {getEstadoBadge(p.estado)}
                      {p.requiere_auditoria_medica && <Badge variant="warn" className="text-xs">🏥 Auditoría</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{formatFecha(p.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {onEditarPoliza && (
                        <Button size="icon" variant="outline" className="size-7" onClick={() => onEditarPoliza(p)} title="Editar">
                          <Edit2 className="size-3" />
                        </Button>
                      )}
                      {p.pdf_hash && (
                        <Button size="icon" variant="outline" className="size-7" onClick={() => window.open(`${API_URL}/polizas/pdf/${p.pdf_hash}`, "_blank")} title="PDF">
                          <Download className="size-3" />
                        </Button>
                      )}
                      {onVerDocumentos && (
                        <Button size="icon" variant="outline" className="size-7" onClick={() => onVerDocumentos(p)} title="Documentos">
                          <Eye className="size-3" />
                        </Button>
                      )}
                      <Button size="icon" variant="outline" className="size-7" onClick={() => verHistorial(p)} title="Historial de estados">
                        <History className="size-3" />
                      </Button>
                      {p.estado === "asesor" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setModalSupervisor({ open: true, poliza: p }); setMotivo("") }}>
                          <ArrowRightLeft className="size-3 mr-1" />Sup
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Vista tarjetas */}
      {tipoVista === "tarjetas" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {polizasArray.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground text-sm">No tienes pólizas generadas aún.</div>
          ) : polizasArray.map(p => (
            <Card key={p.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-sm">Póliza #{p.numero_poliza_oficial ?? p.numero_poliza ?? p.id}</p>
                  <div className="flex flex-col gap-1 items-end">
                    {getEstadoBadge(p.estado)}
                    {p.requiere_auditoria_medica && <Badge variant="warn" className="text-xs">🏥 Auditoría</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-2 text-sm">
                <p className="font-medium">{p.prospecto_nombre} {p.prospecto_apellido}</p>
                <p className="text-xs text-muted-foreground">{p.plan_nombre}</p>
                <p className="text-lg font-bold">{formatCurrency(p.total_final ?? 0)}</p>
                <p className="text-xs text-muted-foreground">{formatFecha(p.created_at)}</p>
                <div className="flex gap-1 pt-2 flex-wrap">
                  {onEditarPoliza && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onEditarPoliza(p)}>
                      <Edit2 className="size-3 mr-1" />Editar
                    </Button>
                  )}
                  {p.pdf_hash && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => window.open(`${API_URL}/polizas/pdf/${p.pdf_hash}`, "_blank")}>
                      <Download className="size-3 mr-1" />PDF
                    </Button>
                  )}
                  {onVerDocumentos && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onVerDocumentos(p)}>
                      <Eye className="size-3 mr-1" />Docs
                    </Button>
                  )}
                  {p.estado === "asesor" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setModalSupervisor({ open: true, poliza: p }); setMotivo("") }}>
                      <ArrowRightLeft className="size-3 mr-1" />Supervisor
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal enviar a supervisor */}
      <Dialog open={modalSupervisor.open} onOpenChange={open => { if (!open) { setModalSupervisor({ open: false, poliza: null }); setMotivo("") } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Enviar Póliza a Supervisor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Póliza: <strong>{modalSupervisor.poliza?.numero_poliza_oficial ?? `#${modalSupervisor.poliza?.id}`}</strong>
            </p>
            <div className="space-y-1.5">
              <Label>Motivo *</Label>
              <Textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Describe el motivo del envío al supervisor..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalSupervisor({ open: false, poliza: null })} disabled={enviando}>Cancelar</Button>
            <Button onClick={handleEnviarSupervisor} disabled={!motivo.trim() || enviando}>
              {enviando ? <Loader2 className="size-4 mr-2 animate-spin" /> : <ArrowRightLeft className="size-4 mr-2" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal historial de estados */}
      <Dialog
        open={historial.open}
        onOpenChange={open => !open && setHistorial({ open: false, poliza: null, loading: false, items: [] })}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-4" />
              Historial de estados
              {historial.poliza && (
                <span className="text-sm font-normal text-muted-foreground">
                  · Nº {historial.poliza.numero_poliza_oficial ?? historial.poliza.numero_poliza ?? historial.poliza.id}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {historial.loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : historial.items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Esta póliza todavía no tiene cambios de estado registrados.
            </p>
          ) : (
            <ol className="space-y-3 max-h-[60vh] overflow-y-auto">
              {historial.items.map((h, i) => (
                <li key={h.id ?? i} className="border-l-2 border-muted pl-3 pb-1">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    {h.estado_anterior && (
                      <>
                        <Badge variant="outline" className="text-xs">{h.estado_anterior}</Badge>
                        <ArrowRightLeft className="size-3 text-muted-foreground" />
                      </>
                    )}
                    <Badge className="text-xs">{h.estado_nuevo ?? "—"}</Badge>
                  </div>
                  {h.motivo && <p className="text-xs text-muted-foreground mt-1">{h.motivo}</p>}
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {[h.usuario_nombre, h.created_at && new Date(h.created_at).toLocaleString("es-AR")]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
