import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import { Eye, Edit2, Download, ArrowRightLeft, LayoutGrid, List, Loader2, History, Upload, Stethoscope } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"
import { BadgeEstadoFirma } from "@/components/badges/BadgeEstadoFirma"
import { maskPhone, maskEmail } from "@/lib/mask"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
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
  estado_firma?: "pending" | "signed" | "rejected" | "expired" | null
}

interface PolizasDashboardProps {
  polizas: Poliza[]
  loadingPolizas: boolean
  onVerDocumentos?: (poliza: Poliza) => void
  /** Adjuntar archivos sueltos a la póliza (SubirDocumentosLibresModal). */
  onAgregarDocumentos?: (poliza: Poliza) => void
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

export default function PolizasDashboard({ polizas, loadingPolizas, onVerDocumentos, onAgregarDocumentos, onEditarPoliza, onRecargar }: PolizasDashboardProps) {
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

  const columns = React.useMemo<ColumnDef<Poliza>[]>(() => [
    {
      accessorKey: "numero_poliza_oficial",
      header: "N° Póliza",
      cell: ({ row }) => <span className="font-bold text-xs">{row.original.numero_poliza_oficial ?? row.original.numero_poliza ?? `#${row.original.id}`}</span>,
    },
    {
      id: "prospecto",
      header: "Prospecto",
      meta: { className: "hidden sm:table-cell text-sm" },
      accessorFn: (p) => `${p.prospecto_nombre ?? ""} ${p.prospecto_apellido ?? ""}`,
    },
    {
      accessorKey: "plan_nombre",
      header: "Plan",
      meta: { className: "hidden md:table-cell text-xs text-muted-foreground" },
    },
    {
      accessorKey: "total_final",
      header: "Total",
      cell: ({ row }) => <span className="font-bold text-sm">{formatCurrency(row.original.total_final ?? 0)}</span>,
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => {
        const p = row.original
        return (
          <div className="flex flex-col gap-1">
            {getEstadoBadge(p.estado)}
            <BadgeEstadoFirma poliza={p} />
            {p.requiere_auditoria_medica && <Badge variant="warn" size="sm" className="pointer-events-none"><Stethoscope aria-hidden="true" />Auditoría</Badge>}
          </div>
        )
      },
    },
    {
      accessorKey: "created_at",
      header: "Fecha",
      meta: { className: "hidden md:table-cell text-xs text-muted-foreground" },
      cell: ({ row }) => formatFecha(row.original.created_at),
    },
    {
      id: "acciones",
      header: "Acciones",
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original
        return (
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
            {onAgregarDocumentos && (
              <Button size="icon" variant="outline" className="size-7" onClick={() => onAgregarDocumentos(p)} title="Agregar documentos">
                <Upload className="size-3" />
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
        )
      },
    },
  ], [onEditarPoliza, onVerDocumentos, onAgregarDocumentos])

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
        <DataTable columns={columns} data={polizasArray} emptyMessage="No tienes pólizas generadas aún." />
      )}

      {/* Vista registro — una fila por póliza, el número como eje */}
      {tipoVista === "tarjetas" && (
        polizasArray.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No tienes pólizas generadas aún.</div>
        ) : (
          <div className="reg reg--pol border-t-2 border-rule-heavy">
            <div className="reg-row reg-head" role="presentation">
              <span>Nº póliza</span>
              <span>Titular</span>
              <span>Plan</span>
              <span className="text-right">Total</span>
              <span>Contacto</span>
              <span>Estado</span>
              <span className="text-right">Fecha</span>
              <span />
            </div>

            {polizasArray.map(p => (
              <div key={p.id} className="reg-row reg-entry">
                {/* 1 · número — el eje */}
                <span className="truncate text-[13px] font-semibold tabular-nums">
                  {p.numero_poliza_oficial ?? p.numero_poliza ?? `#${p.id}`}
                </span>

                {/* 2 · titular */}
                <span className="min-w-0">
                  <span className="block truncate text-[13px]">
                    <b className="font-semibold">{p.prospecto_apellido}</b>
                    <span className="text-muted-foreground">, {p.prospecto_nombre}</span>
                  </span>
                  {p.prospecto_localidad && (
                    <span className="block truncate text-[11.5px] text-muted-foreground">{p.prospecto_localidad}</span>
                  )}
                </span>

                {/* 3 · plan */}
                <span className="truncate text-[12.5px] text-muted-foreground">{p.plan_nombre ?? "—"}</span>

                {/* 4 · total */}
                <span className="text-right text-[13px] font-semibold tabular-nums">
                  {formatCurrency(p.total_final ?? 0)}
                </span>

                {/* 5 · contacto */}
                <span className="min-w-0 text-muted-foreground">
                  <span className="block truncate text-[12.5px] tabular-nums">
                    {p.prospecto_telefono ? maskPhone(p.prospecto_telefono) : "—"}
                  </span>
                  {p.prospecto_email && (
                    <span className="block truncate text-[11.5px]">{maskEmail(p.prospecto_email)}</span>
                  )}
                </span>

                {/* 6 · estado — sello, firma y auditoría */}
                <span className="flex min-w-0 flex-wrap items-center gap-1">
                  {getEstadoBadge(p.estado)}
                  <BadgeEstadoFirma poliza={p} />
                  {p.requiere_auditoria_medica && (
                    <Badge variant="warn" size="sm" className="pointer-events-none">
                      <Stethoscope aria-hidden="true" />Auditoría
                    </Badge>
                  )}
                </span>

                {/* 7 · fecha */}
                <span className="text-right text-[12px] tabular-nums text-muted-foreground">
                  {formatFecha(p.created_at)}
                </span>

                {/* 8 · acciones */}
                <span className="reg-actions">
                  {onEditarPoliza && (
                    <Button size="icon" variant="ghost" className="size-7" title="Editar póliza" onClick={() => onEditarPoliza(p)}>
                      <Edit2 className="size-3.5" />
                    </Button>
                  )}
                  {p.pdf_hash && (
                    <Button size="icon" variant="ghost" className="size-7" title="Descargar PDF" onClick={() => window.open(`${API_URL}/polizas/pdf/${p.pdf_hash}`, "_blank")}>
                      <Download className="size-3.5" />
                    </Button>
                  )}
                  {onVerDocumentos && (
                    <Button size="icon" variant="ghost" className="size-7" title="Ver documentos" onClick={() => onVerDocumentos(p)}>
                      <Eye className="size-3.5" />
                    </Button>
                  )}
                  {onAgregarDocumentos && (
                    <Button size="icon" variant="ghost" className="size-7" title="Agregar documentos" onClick={() => onAgregarDocumentos(p)}>
                      <Upload className="size-3.5" />
                    </Button>
                  )}
                  {p.estado === "asesor" && (
                    <Button size="icon" variant="ghost" className="size-7" title="Enviar a supervisor" onClick={() => { setModalSupervisor({ open: true, poliza: p }); setMotivo("") }}>
                      <ArrowRightLeft className="size-3.5" />
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )
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
