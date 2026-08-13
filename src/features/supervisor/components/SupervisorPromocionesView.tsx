import { useEffect, useMemo, useState } from "react"
import axios from "axios"
import { toast } from "sonner"
import { Search, RefreshCw, Tag, CheckCircle2, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Promocion {
  id: number
  nombre: string
  descripcion?: string
  descuento_porcentaje?: number
  activa?: boolean
  created_at?: string
}

function fmtFecha(f?: string) {
  if (!f) return "—"
  try {
    return new Date(f).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch { return "—" }
}

export function SupervisorPromocionesView() {
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [soloActivas, setSoloActivas] = useState(false)

  const getAuth = () => ({ Authorization: `Bearer ${getAuthToken()}` })

  const fetchPromociones = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API_URL}/supervisor/promociones`, { headers: getAuth() })
      setPromociones(data?.data ?? data ?? [])
    } catch { toast.error("Error al cargar promociones") }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchPromociones() }, [])

  const filtradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase()
    return promociones
      .filter(p => !soloActivas || p.activa)
      .filter(p =>
        !term ||
        p.nombre?.toLowerCase().includes(term) ||
        p.descripcion?.toLowerCase().includes(term) ||
        String(p.descuento_porcentaje ?? "").includes(term)
      )
      .sort((a, b) => b.id - a.id)
  }, [promociones, busqueda, soloActivas])

  const totalActivas = promociones.filter(p => p.activa).length

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Promociones</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Vista de lectura — Promociones disponibles</p>
        </div>
        <Button variant="ghost" size="icon" className="size-8" onClick={fetchPromociones}>
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Total",          value: promociones.length,  icon: <Tag className="size-4" />,          cls: "text-blue-600",  bg: "bg-blue-50 dark:bg-blue-950" },
          { label: "Activas",        value: totalActivas,         icon: <CheckCircle2 className="size-4" />, cls: "text-green-600", bg: "bg-green-50 dark:bg-green-950" },
          { label: "Inactivas",      value: promociones.length - totalActivas, icon: <XCircle className="size-4" />, cls: "text-gray-500", bg: "bg-gray-50 dark:bg-gray-950" },
        ].map(s => (
          <Card key={s.label} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center gap-3 p-4">
                <div className={`rounded-xl p-2 ${s.bg} shrink-0`}>
                  <span className={s.cls}>{s.icon}</span>
                </div>
                <div>
                  <p className="text-xl font-bold tabular-nums leading-none">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9"
            placeholder="Buscar por nombre o descripción..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            className="accent-primary"
            checked={soloActivas}
            onChange={e => setSoloActivas(e.target.checked)}
          />
          Solo activas
        </label>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-4 py-3">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Modo Lectura:</strong> Como supervisor podés visualizar todas las promociones disponibles. Para crear o editar promociones, contactá al área de Back Office.
        </p>
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {loading ? "Cargando..." : `${filtradas.length} promociones`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Tag className="size-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No se encontraron promociones</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden md:table-cell">Descripción</TableHead>
                    <TableHead className="text-center">Descuento</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="hidden sm:table-cell">Creación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map(promo => (
                    <TableRow key={promo.id}>
                      <TableCell className="text-sm text-muted-foreground">{promo.id}</TableCell>
                      <TableCell className="font-medium text-sm">{promo.nombre}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-xs">
                        <span className="line-clamp-2">{promo.descripcion ?? "—"}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-semibold">
                          {promo.descuento_porcentaje ?? 0}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {promo.activa ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-0">
                            <CheckCircle2 className="size-3 mr-1" />Activa
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="size-3 mr-1" />Inactiva
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {fmtFecha(promo.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards en mobile */}
      <div className="block sm:hidden space-y-2">
        {!loading && filtradas.map(promo => (
          <Card key={promo.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">{promo.nombre}</p>
                  {promo.descripcion && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{promo.descripcion}</p>
                  )}
                </div>
                {promo.activa ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-0 shrink-0">
                    Activa
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0">Inactiva</Badge>
                )}
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Descuento: <strong className="text-foreground">{promo.descuento_porcentaje ?? 0}%</strong></span>
                <span>{fmtFecha(promo.created_at)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
