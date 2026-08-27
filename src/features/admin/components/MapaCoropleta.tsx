import { useState, useEffect, useCallback } from "react"
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PartidoData {
  partido: string
  cantidad: number
}

interface MapaCoropletaProps {
  data: PartidoData[]
}

interface GeoPoint {
  partido: string
  cantidad: number
  coords: [number, number]
}

interface CoordMap {
  [normalized: string]: {
    original: string
    coords: [number, number]
  }
}

function getQuantileThresholds(values: number[]) {
  if (!values || values.length === 0) return { q25: 0, q50: 0, q75: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  return {
    q25: sorted[Math.max(0, Math.floor(n * 0.25) - 1)],
    q50: sorted[Math.max(0, Math.floor(n * 0.50) - 1)],
    q75: sorted[Math.max(0, Math.floor(n * 0.75) - 1)],
  }
}

function getBubbleColor(value: number, thresholds: { q25: number; q50: number; q75: number }) {
  if (!thresholds || thresholds.q75 === 0) return "#9e9ac8"
  if (value >= thresholds.q75) return "#c7254e"
  if (value >= thresholds.q50) return "#ec971f"
  if (value >= thresholds.q25) return "#f0ad4e"
  return "#5bc0de"
}

function getBubbleRadius(value: number, max: number) {
  if (max === 0) return 8
  const logVal = Math.log1p(value)
  const logMax = Math.log1p(max)
  return 8 + Math.round((logVal / logMax) * 28)
}

const norm = (s: string) =>
  s?.trim().normalize("NFC").toLowerCase().replace(/\s+/g, " ") ?? ""

const CABA_ALIASES = [
  "caba", "c.a.b.a", "c.a.b.a.", "capital federal",
  "ciudad autónoma de buenos aires", "ciudad autonoma de buenos aires",
]

function MapFitter({ geoPoints }: { geoPoints: GeoPoint[] }) {
  const map = useMap()

  useEffect(() => {
    if (geoPoints.length === 0) {
      map.fitBounds(
        L.latLngBounds(L.latLng(-38.5, -61.5), L.latLng(-33.5, -57.5)),
        { padding: [50, 50] },
      )
      return
    }
    const bounds = geoPoints.map((p) => p.coords)
    if (bounds.length > 0) {
      const latLngs = L.latLngBounds(bounds)
      map.fitBounds(latLngs, { padding: [60, 60], maxZoom: 8, animate: true })
    }
  }, [geoPoints, map])

  return null
}

export default function MapaCoropleta({ data = [] }: MapaCoropletaProps) {
  const [geoPoints, setGeoPoints] = useState<GeoPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [debugInfo, setDebugInfo] = useState("")

  const normalizarYmapear = useCallback(async () => {
    if (data.length === 0) {
      setLoading(false)
      setDebugInfo("Sin datos de prospectos")
      return
    }

    const base = import.meta.env.BASE_URL || "/"
    const geoUrl = `${base.replace(/\/$/, "")}/data/pba-partidos.geo.json`

    try {
      const res = await fetch(geoUrl)
      const geo: { features?: { properties?: { name?: string }; geometry?: { coordinates?: number[] } }[] } = await res.json()

      if (!geo.features) throw new Error("GeoJSON sin features")

      const coordMap: CoordMap = {}

      geo.features.forEach((f) => {
        if (f.properties?.name && f.geometry?.coordinates) {
          const normalized = norm(f.properties.name)
          coordMap[normalized] = {
            original: f.properties.name,
            coords: [f.geometry.coordinates[1], f.geometry.coordinates[0]] as [number, number],
          }
        }
      })

      CABA_ALIASES.forEach((a) => {
        coordMap[norm(a)] = {
          original: "CABA",
          coords: [-34.6037, -58.3816] as [number, number],
        }
      })

      const puntos = data
        .map((item) => {
          const normalized = norm(item.partido)
          const entry = coordMap[normalized]
          return {
            partido: item.partido,
            cantidad: item.cantidad,
            coords: entry?.coords ?? null,
          }
        })
        .filter((p): p is GeoPoint => p.coords !== null)

      setGeoPoints(puntos)
      setDebugInfo(`${puntos.length}/${data.length} partidos ubicados`)
    } catch (err) {
      console.error("Error cargando GeoJSON:", err)
      setDebugInfo("Error: " + (err instanceof Error ? err.message : "desconocido"))
    } finally {
      setLoading(false)
    }
  }, [data])

  useEffect(() => {
    normalizarYmapear()
  }, [normalizarYmapear])

  const maxValor = geoPoints.length > 0 ? Math.max(...geoPoints.map((p) => p.cantidad)) : 0
  const quantileThresholds = getQuantileThresholds(geoPoints.map((p) => p.cantidad))
  const top5 = [...geoPoints].sort((a, b) => b.cantidad - a.cantidad).slice(0, 5)

  const leyenda = [
    { color: "#c7254e", label: `Alto (≥${quantileThresholds.q75})` },
    { color: "#ec971f", label: `Medio-alto (≥${quantileThresholds.q50})` },
    { color: "#f0ad4e", label: `Medio (≥${quantileThresholds.q25})` },
    { color: "#5bc0de", label: `Bajo (<${quantileThresholds.q25})` },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Distribución de Prospectos &mdash; PBA</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{debugInfo}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 relative">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="size-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Cargando...</span>
          </div>
        ) : geoPoints.length === 0 ? (
          <div className="text-muted-foreground text-center py-12 text-sm">
            No se encontraron ubicaciones en el mapa
          </div>
        ) : (
          <div className="relative">
            <MapContainer
              bounds={L.latLngBounds(geoPoints.map((p) => p.coords))}
              style={{ height: "380px", width: "100%" }}
              zoom={7}
              scrollWheelZoom={false}
              doubleClickZoom
              touchZoom
            >
              <MapFitter geoPoints={geoPoints} />
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
                maxZoom={11}
                minZoom={5}
              />
              {geoPoints.map((punto) => (
                <CircleMarker
                  key={punto.partido}
                  center={punto.coords}
                  radius={getBubbleRadius(punto.cantidad, maxValor)}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 2,
                    fillColor: getBubbleColor(punto.cantidad, quantileThresholds),
                    fillOpacity: 0.75,
                    opacity: 1,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -8]} permanent={false} sticky>
                    <div style={{ fontSize: 12 }}>
                      <strong>{punto.partido}</strong>
                      <br />
                      <span style={{ fontSize: 11 }}>{punto.cantidad.toLocaleString("es-AR")} prospectos</span>
                    </div>
                  </Tooltip>
                </CircleMarker>
              ))}
            </MapContainer>

            {/* Leyenda */}
            <div
              className="absolute bottom-3 left-3 z-[1000] bg-background/95 backdrop-blur-sm rounded-lg p-2.5 shadow-lg"
              style={{ fontSize: 11 }}
            >
              <p className="font-bold mb-2 text-[10px] text-muted-foreground uppercase tracking-wide">
                Escala (cuartiles)
              </p>
              <div className="space-y-1.5">
                {leyenda.map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div
                      className="size-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: color,
                        border: "1px solid #fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                      }}
                    />
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 5 */}
            {top5.length > 0 && (
              <div
                className="absolute top-3 right-3 z-[1000] bg-background/95 backdrop-blur-sm rounded-lg p-2.5 shadow-lg"
                style={{ maxWidth: 180 }}
              >
                <p className="font-bold mb-2 text-[10px] text-muted-foreground uppercase tracking-wide">
                  Top 5
                </p>
                <div className="space-y-1">
                  {top5.map((p, i) => (
                    <div
                      key={p.partido}
                      className="flex justify-between items-center pb-1"
                      style={{
                        borderBottom: i < top5.length - 1 ? "1px solid hsl(var(--border))" : "none",
                      }}
                    >
                      <span className="text-[10px] text-muted-foreground truncate flex-1">
                        {i + 1}. {p.partido}
                      </span>
                      <span className="font-bold text-[10px] ml-1.5 shrink-0">
                        {p.cantidad.toLocaleString("es-AR")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
