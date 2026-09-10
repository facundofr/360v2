import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import { Download, FileSpreadsheet, Loader2, BarChart2, Settings } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

const ESTADOS_PROSPECTO = [
  "Lead","1º Contacto","Calificado Cotización","Calificado Póliza",
  "Calificado Pago","Venta","Fuera de zona","Fuera de edad",
  "Preexistencia","Reafiliación","No contesta","Ya es socio",
  "Busca otra Cobertura","Teléfono erróneo","No le interesa (económico)",
  "No le interesa cartilla","No busca cobertura médica",
]

interface ModalExportacionProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userRole?: "vendedor" | "supervisor" | "admin" | "backoffice"
}

interface Estadisticas {
  total_prospectos?: number
  total_polizas?: number
  total_documentos?: number
}

const getHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` })

export default function ModalExportacion({ open, onOpenChange, userRole = "vendedor" }: ModalExportacionProps) {
  const [config, setConfig] = React.useState({
    formato: "excel",
    incluir_polizas: true,
    incluir_documentos: true,
    incluir_familiares: false,
    fecha_desde: "",
    fecha_hasta: "",
    estado_prospecto: "todos",
    vendedor_id: "todos",
  })
  const [estadisticas, setEstadisticas] = React.useState<Estadisticas | null>(null)
  const [vendedores, setVendedores] = React.useState<{ id: number; first_name: string; last_name: string }[]>([])
  const [loadingStats, setLoadingStats] = React.useState(false)
  const [exportando, setExportando] = React.useState(false)

  const fetchStats = async () => {
    setLoadingStats(true)
    try {
      const { data } = await axios.get(`${API_URL}/export/estadisticas`, { headers: getHeaders() })
      setEstadisticas(data?.data ?? data)
    } catch {
      // stats are optional
    } finally {
      setLoadingStats(false)
    }
  }

  const fetchVendedores = async () => {
    try {
      const endpoint = userRole === "admin" ? "/admin/vendedores" : "/supervisor/vendedores"
      const { data } = await axios.get(`${API_URL}${endpoint}`, { headers: getHeaders() })
      setVendedores(data?.data ?? data ?? [])
    } catch {
      // optional
    }
  }

  React.useEffect(() => {
    if (open) {
      fetchStats()
      if (userRole === "supervisor" || userRole === "admin") fetchVendedores()
    }
  }, [open, userRole])

  const set = (key: string, val: unknown) => setConfig(prev => ({ ...prev, [key]: val }))

  const handleExportar = async () => {
    setExportando(true)
    try {
      const params = new URLSearchParams()
      Object.entries(config).forEach(([k, v]) => {
        if (v !== "" && v !== undefined) params.append(k, String(v))
      })
      const resp = await fetch(`${API_URL}/export/prospectos?${params}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })
      if (!resp.ok) throw new Error("Error en exportación")
      const blob = await resp.blob()
      const ext = config.formato === "excel" ? "xlsx" : "csv"
      const filename = `prospectos_export_${Date.now()}.${ext}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Archivo ${filename} descargado`)
      onOpenChange(false)
    } catch {
      toast.error("Error al exportar. Intente nuevamente.")
    } finally {
      setExportando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-4" />
            Exportar Prospectos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Estadísticas */}
          {loadingStats ? (
            <Skeleton className="h-16 w-full" />
          ) : estadisticas && (
            <div className="flex gap-3 flex-wrap bg-paper-sunk rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-sm">
                <BarChart2 className="size-4 text-primary" />
                <Badge variant="secondary">{estadisticas.total_prospectos ?? 0}</Badge>
                <span className="text-muted-foreground">Prospectos</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Badge variant="secondary">{estadisticas.total_polizas ?? 0}</Badge>
                <span className="text-muted-foreground">Pólizas</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Badge variant="secondary">{estadisticas.total_documentos ?? 0}</Badge>
                <span className="text-muted-foreground">Docs</span>
              </div>
            </div>
          )}

          {/* Formato */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Settings className="size-3.5" />Formato</Label>
            <div className="flex gap-4">
              {[{v:"excel",label:"Excel (.xlsx)"},{v:"csv",label:"CSV (.csv)"}].map(f => (
                <label key={f.v} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="formato" value={f.v} checked={config.formato === f.v} onChange={() => set("formato", f.v)} className="accent-primary" />
                  <FileSpreadsheet className="size-3.5" />
                  {f.label}
                </label>
              ))}
            </div>
          </div>

          {/* Incluir */}
          <div className="space-y-2">
            <Label>Incluir en exportación</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "incluir_polizas", label: "Pólizas" },
                { key: "incluir_documentos", label: "Documentos" },
                { key: "incluir_familiares", label: "Familiares" },
              ].map(item => (
                <label key={item.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={config[item.key as keyof typeof config] as boolean}
                    onCheckedChange={v => set(item.key, v)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={config.fecha_desde} onChange={e => set("fecha_desde", e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={config.fecha_hasta} onChange={e => set("fecha_hasta", e.target.value)} className="h-8 text-sm" />
            </div>
          </div>

          {/* Estado */}
          <div className="space-y-1">
            <Label className="text-xs">Estado del prospecto</Label>
            <Select value={config.estado_prospecto} onValueChange={v => set("estado_prospecto", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {ESTADOS_PROSPECTO.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Vendedor (supervisor/admin) */}
          {vendedores.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Vendedor</Label>
              <Select value={config.vendedor_id} onValueChange={v => set("vendedor_id", v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {vendedores.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.first_name} {v.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exportando}>Cancelar</Button>
          <Button onClick={handleExportar} disabled={exportando}>
            {exportando ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Download className="size-4 mr-2" />}
            Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
