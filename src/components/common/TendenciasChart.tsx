import { memo } from "react"
import { CartesianGrid, XAxis, Line, LineChart, LabelList } from "recharts"
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
  ChartLegend, ChartLegendContent, type ChartConfig,
} from "@/components/ui/chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export interface TendenciasDato {
  mes: string
  Prospectos?: number
  Vendedores?: number
  Ventas?: number
  Polizas?: number
  // aliases from supervisor endpoint
  nuevosProspectos?: number
  vendedores?: number
  ventas?: number
  polizasGeneradas?: number
}

export const TENDENCIAS_COLORS = {
  Prospectos: "rgba(227, 6, 32, 1)",
  Vendedores: "rgba(251, 162, 0, 1)",
  Ventas:     "rgba(8, 198, 176, 1)",
  Polizas:    "rgba(0, 57, 109, 1)",
} as const

export const tendenciasChartConfig = {
  Prospectos: { label: "Nuevos Prospectos", color: TENDENCIAS_COLORS.Prospectos },
  Vendedores: { label: "Vendedores",        color: TENDENCIAS_COLORS.Vendedores },
  Ventas:     { label: "Ventas",            color: TENDENCIAS_COLORS.Ventas },
  Polizas:    { label: "Pólizas Generadas", color: TENDENCIAS_COLORS.Polizas },
} satisfies ChartConfig

/** Normaliza ambos formatos de dato (backoffice y supervisor) al formato canónico */
export function normalizarDatos(raw: TendenciasDato[]): TendenciasDato[] {
  return raw.map(d => ({
    mes: d.mes,
    Prospectos: d.Prospectos ?? d.nuevosProspectos,
    Vendedores: d.Vendedores ?? d.vendedores,
    Ventas:     d.Ventas     ?? d.ventas,
    Polizas:    d.Polizas    ?? d.polizasGeneradas,
  }))
}

interface TendenciasChartProps {
  data: TendenciasDato[]
  loading?: boolean
  title?: string
  description?: string
  accion?: React.ReactNode
}

export const TendenciasChart = memo(function TendenciasChart({
  data,
  loading = false,
  title = "Tendencias Mensuales",
  description = "Evolución de prospectos, vendedores, ventas y pólizas",
  accion,
}: TendenciasChartProps) {
  const chartData = normalizarDatos(data)

  return (
    <Card className="pt-0">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {accion}
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {loading ? (
          <Skeleton className="h-[250px] w-full" />
        ) : chartData.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
            Sin datos disponibles
          </div>
        ) : (
          <ChartContainer config={tendenciasChartConfig} className="aspect-auto h-[280px] w-full">
            <LineChart
              accessibilityLayer
              data={chartData}
              margin={{ top: 20, left: 12, right: 12 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="mes"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
              {(["Prospectos", "Vendedores", "Ventas", "Polizas"] as const).map(key => (
                <Line
                  key={key}
                  dataKey={key}
                  type="natural"
                  stroke={TENDENCIAS_COLORS[key]}
                  strokeWidth={2}
                  dot={{ fill: TENDENCIAS_COLORS[key] }}
                  activeDot={{ r: 6 }}
                >
                  <LabelList position="top" offset={12} className="fill-foreground" fontSize={11} />
                </Line>
              ))}
              <ChartLegend content={<ChartLegendContent />} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
})
