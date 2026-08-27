// ─────────────────────────────────────────────────────────────────────────────
// Paso 4 del alta: Salud y Términos.
//
// Port de `frontend/src/components/features/vendedor/poliza-form/PasoSaludTerminos.jsx`.
//
// Recoge, POR CADA INTEGRANTE del grupo familiar (titular incluido):
//   · 49 preguntas de salud agrupadas en 14 categorías
//   · cobertura médica anterior
//   · medicación actual
//   · datos adicionales (declaración libre, médico tratante, instituciones)
//
// ⚠️ La FORMA del objeto la dicta el backend, no este componente:
// `polizaPDFController.js` lee `saludTerminos.respuestas[i]`,
// `coberturaAnterior[i]`, `medicacion[i]` y `datos_adicionales[i]` indexados por
// integrante. Si no llegan, el backend NO falla: genera el PDF de afiliación
// —el que el cliente firma— con esos bloques en blanco.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from "react"
import { HeartPulse, CheckCircle2, AlertTriangle } from "lucide-react"

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"

import {
  PREGUNTAS_SALUD,
  CATEGORIAS_SALUD,
  ORDEN_CATEGORIAS,
  COBERTURAS_MEDICAS,
  type CategoriaSalud,
} from "@/features/vendedor/constants/poliza"
import { esConyuge } from "@/features/vendedor/lib/poliza-reglas"
import {
  COBERTURA_VACIA,
  DATOS_ADICIONALES_VACIOS,
  type CoberturaAnterior,
  type DatosAdicionales,
  type SaludTerminos,
  type IntegranteSalud,
} from "@/features/vendedor/lib/salud-terminos"

interface Props {
  /** Titular, ya con nombre y apellido de datos personales. */
  titular: { nombre: string; apellido: string; sexo?: string }
  /** Familiares del grupo, en el orden en que están en el formulario. */
  integrantes: IntegranteSalud[]
  value: SaludTerminos
  onChange: (next: SaludTerminos) => void
  aceptaTerminos: boolean
  onAceptaTerminosChange: (v: boolean) => void
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function PasoSaludTerminos({
  titular,
  integrantes,
  value,
  onChange,
  aceptaTerminos,
  onAceptaTerminosChange,
}: Props) {
  // Orden de producción: Titular → cónyuge/pareja → resto.
  // El índice que se manda al backend es el de ESTA lista.
  const personas = useMemo(() => {
    const mapeados = integrantes.map((i, idx) => ({
      nombre: i.nombre || "Sin nombre",
      apellido: i.apellido || "",
      vinculo: i.vinculo || "Familiar",
      sexo: i.sexo,
      idxOriginal: idx,
    }))
    return [
      { nombre: titular.nombre || "Titular", apellido: titular.apellido || "", vinculo: "Titular", sexo: titular.sexo, idxOriginal: -1 },
      ...mapeados.filter((i) => esConyuge(i.vinculo)),
      ...mapeados.filter((i) => !esConyuge(i.vinculo)),
    ]
  }, [titular.nombre, titular.apellido, titular.sexo, integrantes])

  const preguntasPorCategoria = useMemo(() => {
    const acc = {} as Record<CategoriaSalud, typeof PREGUNTAS_SALUD>
    for (const cat of ORDEN_CATEGORIAS) {
      acc[cat] = PREGUNTAS_SALUD.filter((p) => p.categoria === cat)
    }
    return acc
  }, [])

  // ─── Escrituras ────────────────────────────────────────────────────────────
  const setRespuesta = (idx: number, preguntaId: string, campo: "respuesta" | "detalle", valor: string) => {
    const k = String(idx)
    const prevIntegrante = value.respuestas[k] ?? {}
    const prevPregunta = prevIntegrante[preguntaId] ?? { respuesta: "no" as const, detalle: "" }
    onChange({
      ...value,
      respuestas: {
        ...value.respuestas,
        [k]: {
          ...prevIntegrante,
          [preguntaId]: { ...prevPregunta, [campo]: valor },
        },
      },
    })
  }

  const setCobertura = (idx: number, campo: keyof CoberturaAnterior, valor: string) => {
    const k = String(idx)
    onChange({
      ...value,
      coberturaAnterior: {
        ...value.coberturaAnterior,
        [k]: { ...(value.coberturaAnterior[k] ?? COBERTURA_VACIA), [campo]: valor },
      },
    })
  }

  const setMedicacion = (idx: number, valor: string) => {
    const k = String(idx)
    // Igual que producción: vacío se guarda como "Ninguna".
    onChange({
      ...value,
      medicacion: { ...value.medicacion, [k]: { detalle: valor === "" ? "Ninguna" : valor } },
    })
  }

  const setDatoAdicional = (idx: number, campo: keyof DatosAdicionales, valor: string) => {
    const k = String(idx)
    onChange({
      ...value,
      datosAdicionales: {
        ...value.datosAdicionales,
        [k]: { ...(value.datosAdicionales[k] ?? DATOS_ADICIONALES_VACIOS), [campo]: valor },
      },
    })
  }

  // ─── Progreso por persona ──────────────────────────────────────────────────
  const respondidas = (idx: number) => Object.keys(value.respuestas[String(idx)] ?? {}).length
  const afirmativas = (idx: number) =>
    Object.values(value.respuestas[String(idx)] ?? {}).filter((r) => r.respuesta === "si").length

  // Categoría "embarazo" sólo aplica a personas femeninas (réplica de
  // PasoSaludTerminos.jsx:718-727) — se filtra la categoría entera en vez de
  // pregunta por pregunta porque acá esas 5 preguntas están todas agrupadas.
  const esFemenino = (p: { sexo?: string }) => p.sexo === "femenino"
  const totalPreguntas = (p: { sexo?: string }) =>
    PREGUNTAS_SALUD.filter((q) => q.categoria !== "embarazo" || esFemenino(p)).length

  return (
    <div className="space-y-4">
      <Alert>
        <HeartPulse className="size-4" />
        <AlertDescription>
          Completá la declaración de salud de <strong>cada integrante</strong> del grupo familiar.
          Los datos se imprimen en la póliza que el titular firma digitalmente.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="0" className="w-full">
        <div className="overflow-x-auto">
          <TabsList className="w-max">
            {personas.map((p, idx) => (
              <TabsTrigger key={idx} value={String(idx)} className="gap-2">
                <span className="truncate max-w-[10rem]">
                  {p.nombre} {p.apellido}
                </span>
                <Badge variant={respondidas(idx) > 0 ? "secondary" : "outline"} className="text-[10px]">
                  {respondidas(idx)}/{totalPreguntas(p)}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {personas.map((persona, idx) => (
          <TabsContent key={idx} value={String(idx)} className="space-y-4 pt-4">
            {/* Cabecera de la persona */}
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">
                {persona.nombre} {persona.apellido}
              </h3>
              <Badge variant="outline">{persona.vinculo}</Badge>
              {afirmativas(idx) > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="size-3" />
                  {afirmativas(idx)} afirmativa{afirmativas(idx) === 1 ? "" : "s"}
                </Badge>
              )}
              {respondidas(idx) === totalPreguntas(persona) && (
                <Badge variant="ok" className="gap-1">
                  <CheckCircle2 className="size-3" />
                  Completo
                </Badge>
              )}
            </div>

            {/* Cuestionario por categoría */}
            <Accordion type="multiple" className="w-full">
              {ORDEN_CATEGORIAS.map((cat) => {
                if (cat === "embarazo" && !esFemenino(persona)) return null
                const preguntas = preguntasPorCategoria[cat]
                const respondidasCat = preguntas.filter(
                  (p) => value.respuestas[String(idx)]?.[p.id] !== undefined
                ).length
                return (
                  <AccordionItem key={cat} value={cat}>
                    <AccordionTrigger className="text-sm">
                      <span className="flex flex-1 items-center justify-between gap-2 pr-2">
                        <span>{CATEGORIAS_SALUD[cat]}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {respondidasCat}/{preguntas.length}
                        </Badge>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      {preguntas.map((p) => {
                        const actual = value.respuestas[String(idx)]?.[p.id]
                        const esSi = actual?.respuesta === "si"
                        const detalleId = `salud-${idx}-${p.id}-detalle`
                        const grupoId = `salud-${idx}-${p.id}-label`
                        return (
                          <div key={p.id} className="rounded-lg border p-3 space-y-2">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <p id={grupoId} className="text-sm flex-1">
                                {p.pregunta}
                              </p>
                              <ToggleGroup
                                type="single"
                                variant="outline"
                                size="sm"
                                spacing={1}
                                aria-labelledby={grupoId}
                                value={actual?.respuesta ?? ""}
                                onValueChange={(v) => v && setRespuesta(idx, p.id, "respuesta", v)}
                                className="shrink-0"
                              >
                                <ToggleGroupItem value="si" aria-label="Sí">
                                  Sí
                                </ToggleGroupItem>
                                <ToggleGroupItem value="no" aria-label="No">
                                  No
                                </ToggleGroupItem>
                              </ToggleGroup>
                            </div>

                            {esSi && (
                              <div className="space-y-1">
                                <Label htmlFor={detalleId} className="text-xs text-muted-foreground">
                                  {p.detalle}
                                </Label>
                                <Textarea
                                  id={detalleId}
                                  rows={2}
                                  value={actual?.detalle ?? ""}
                                  onChange={(e) => setRespuesta(idx, p.id, "detalle", e.target.value)}
                                  placeholder={p.detalle}
                                />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>

            <Separator />

            {/* Cobertura médica anterior */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cobertura médica anterior</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor={`cob-${idx}`}>Prestador anterior</Label>
                  <Select
                    value={value.coberturaAnterior[String(idx)]?.cobertura ?? COBERTURA_VACIA.cobertura}
                    onValueChange={(v) => setCobertura(idx, "cobertura", v)}
                  >
                    <SelectTrigger id={`cob-${idx}`}>
                      <SelectValue placeholder="Seleccioná una cobertura" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {COBERTURAS_MEDICAS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`cob-desde-${idx}`}>Desde</Label>
                  <Input
                    id={`cob-desde-${idx}`}
                    type="date"
                    value={value.coberturaAnterior[String(idx)]?.fecha_desde ?? ""}
                    onChange={(e) => setCobertura(idx, "fecha_desde", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`cob-hasta-${idx}`}>Hasta</Label>
                  <Input
                    id={`cob-hasta-${idx}`}
                    type="date"
                    value={value.coberturaAnterior[String(idx)]?.fecha_hasta ?? ""}
                    onChange={(e) => setCobertura(idx, "fecha_hasta", e.target.value)}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor={`cob-motivo-${idx}`}>Motivo de baja</Label>
                  <Input
                    id={`cob-motivo-${idx}`}
                    value={value.coberturaAnterior[String(idx)]?.motivo_baja ?? ""}
                    onChange={(e) => setCobertura(idx, "motivo_baja", e.target.value)}
                    placeholder="Por qué se dio de baja la cobertura anterior"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Medicación */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Medicación actual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <Label htmlFor={`med-${idx}`} className="sr-only">
                    Medicación actual
                  </Label>
                  <Textarea
                    id={`med-${idx}`}
                    rows={2}
                    value={
                      value.medicacion[String(idx)]?.detalle === "Ninguna"
                        ? ""
                        : (value.medicacion[String(idx)]?.detalle ?? "")
                    }
                    onChange={(e) => setMedicacion(idx, e.target.value)}
                    placeholder="Medicamentos, dosis y frecuencia. Si no toma nada, dejar vacío."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Datos adicionales */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Datos adicionales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor={`dec-${idx}`}>Declaración adicional</Label>
                  <Textarea
                    id={`dec-${idx}`}
                    rows={2}
                    value={value.datosAdicionales[String(idx)]?.declaracion_adicional ?? ""}
                    onChange={(e) => setDatoAdicional(idx, "declaracion_adicional", e.target.value)}
                    placeholder="Cualquier información de salud que no haya entrado en las preguntas"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`medico-${idx}`}>Médico tratante</Label>
                  <Input
                    id={`medico-${idx}`}
                    value={value.datosAdicionales[String(idx)]?.medico_tratante ?? ""}
                    onChange={(e) => setDatoAdicional(idx, "medico_tratante", e.target.value)}
                    placeholder="Nombre y especialidad"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`inst-${idx}`}>Instituciones anteriores</Label>
                  <Input
                    id={`inst-${idx}`}
                    value={value.datosAdicionales[String(idx)]?.instituciones_anteriores ?? ""}
                    onChange={(e) => setDatoAdicional(idx, "instituciones_anteriores", e.target.value)}
                    placeholder="Sanatorios, clínicas u hospitales donde se atendió"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Separator />

      {/* Aceptación de términos */}
      <div className="flex items-start gap-3 rounded-lg border p-3">
        <Checkbox
          id="acepta-terminos-salud"
          checked={aceptaTerminos}
          onCheckedChange={(v) => onAceptaTerminosChange(v === true)}
          className="mt-0.5"
        />
        <Label htmlFor="acepta-terminos-salud" className="text-sm font-normal leading-snug">
          Declaro que la información de salud es completa y veraz, y que su omisión o falsedad
          puede dar lugar a la rescisión de la cobertura.
        </Label>
      </div>
    </div>
  )
}

export default PasoSaludTerminos
