import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface LocalidadData {
  localidad: string
  cantidad: number
}

interface MapaProspectosBuenosAiresProps {
  data: LocalidadData[]
}

export default function MapaProspectosBuenosAires({ data = [] }: MapaProspectosBuenosAiresProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Prospectos por Localidad &mdash; Provincia de Buenos Aires</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Distribución seg&uacute;n campo &quot;localidad&quot;</p>
          </div>
          <Badge variant="secondary" className="text-[10px]">Beta</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Sin datos para el per&iacute;odo seleccionado.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase text-muted-foreground">Localidad</TableHead>
                    <TableHead className="text-xs uppercase text-muted-foreground text-right">Prospectos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.slice(0, 15).map((item) => (
                    <TableRow key={item.localidad}>
                      <TableCell className="text-sm">{item.localidad}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-sm">{item.cantidad}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.length > 15 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Mostrando 15 de {data.length} localidades
                </p>
              )}
            </div>
            <div className="flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <div className="mb-2 text-sm">Mapa de PBA pr&oacute;ximamente</div>
                <p className="text-xs">Integraci&oacute;n con react-simple-maps + GeoJSON de PBA.</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
