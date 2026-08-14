import * as React from "react"
import { useParams, useNavigate } from "react-router-dom"
import axios from "axios"
import { toast } from "sonner"
import {
  ArrowLeft, UserCheck, Users, Mail, Phone, Calendar,
  UserPlus, ToggleLeft, ToggleRight, Loader2, Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Supervisor {
  id: number
  name: string
  email: string
  telefono?: string
  created_at?: string
  activo?: boolean
}

interface Vendedor {
  id: number
  name: string
  email: string
  activo?: boolean
  total_prospectos?: number
  total_polizas?: number
}

const getHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` })

export default function DetalleSupervisorView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [supervisor, setSupervisor] = React.useState<Supervisor | null>(null)
  const [vendedores, setVendedores] = React.useState<Vendedor[]>([])
  const [sinSupervisor, setSinSupervisor] = React.useState<Vendedor[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [modalAsignar, setModalAsignar] = React.useState(false)
  const [toggling, setToggling] = React.useState<number | null>(null)

  const fetchDetalles = React.useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await axios.get(`${API_URL}/backoffice/supervisores/${id}`, { headers: getHeaders() })
      if (data.success) {
        setSupervisor(data.data.supervisor)
        setVendedores(data.data.vendedores ?? [])
      } else {
        setError("No se pudieron cargar los detalles del supervisor")
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      setError(status === 404 ? "Supervisor no encontrado" : "Error al conectar con el servidor")
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchSinSupervisor = React.useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/backoffice/vendedores-sin-supervisor`, { headers: getHeaders() })
      if (data.success) setSinSupervisor(data.data ?? [])
    } catch { /* silent */ }
  }, [])

  React.useEffect(() => {
    fetchDetalles()
    fetchSinSupervisor()
  }, [fetchDetalles, fetchSinSupervisor])

  const handleAsignar = async (vendedorId: number) => {
    try {
      await axios.post(`${API_URL}/backoffice/vendedores/asignar`, { vendedorId, supervisorId: id }, { headers: getHeaders() })
      toast.success("Vendedor asignado correctamente")
      setModalAsignar(false)
      fetchDetalles()
      fetchSinSupervisor()
    } catch {
      toast.error("No se pudo asignar el vendedor")
    }
  }

  const handleToggleEstado = async (vendedor: Vendedor) => {
    setToggling(vendedor.id)
    try {
      await axios.patch(`${API_URL}/backoffice/vendedores/${vendedor.id}/toggle-status`, {}, { headers: getHeaders() })
      toast.success(`Vendedor ${vendedor.activo ? "deshabilitado" : "habilitado"}`)
      fetchDetalles()
    } catch {
      toast.error("Error al cambiar estado del vendedor")
    } finally {
      setToggling(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-destructive mb-4">{error}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4 mr-2" />Volver
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold">Detalle Supervisor</h1>
      </div>

      {/* Info supervisor */}
      {supervisor && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="size-5" />
              {supervisor.name}
              <Badge variant={supervisor.activo ? "ok" : "risk"}>
                {supervisor.activo ? "Activo" : "Inactivo"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4" />
              {supervisor.email}
            </div>
            {supervisor.telefono && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="size-4" />
                {supervisor.telefono}
              </div>
            )}
            {supervisor.created_at && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="size-4" />
                Desde {new Date(supervisor.created_at).toLocaleDateString("es-AR")}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vendedores */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Users className="size-4" />
            Vendedores ({vendedores.length})
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setModalAsignar(true)} className="h-7 text-xs">
            <Plus className="size-3 mr-1" />Asignar Vendedor
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden md:table-cell">Prospectos</TableHead>
                  <TableHead className="hidden md:table-cell">Pólizas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendedores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                      Sin vendedores asignados
                    </TableCell>
                  </TableRow>
                ) : vendedores.map(v => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium text-sm">{v.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{v.email}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{v.total_prospectos ?? 0}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{v.total_polizas ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={v.activo ? "ok" : "risk"}>
                        {v.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={toggling === v.id}
                        onClick={() => handleToggleEstado(v)}
                      >
                        {toggling === v.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : v.activo ? (
                          <><ToggleLeft className="size-3 mr-1" />Deshabilitar</>
                        ) : (
                          <><ToggleRight className="size-3 mr-1" />Habilitar</>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal asignar vendedor */}
      <Dialog open={modalAsignar} onOpenChange={setModalAsignar}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar Vendedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sinSupervisor.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay vendedores sin supervisor</p>
            ) : sinSupervisor.map(v => (
              <div key={v.id} className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/30">
                <div>
                  <p className="text-sm font-medium">{v.name}</p>
                  <p className="text-xs text-muted-foreground">{v.email}</p>
                </div>
                <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => handleAsignar(v.id)}>
                  <UserPlus className="size-3 mr-1" />Asignar
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
