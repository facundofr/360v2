// ─────────────────────────────────────────────────────────────────────────────
// Alta de póliza (formulario de afiliación).
//
// Port de `frontend/src/components/features/vendedor/PolizaForm.jsx` + sus pasos
// en `poliza-form/`. Backend intocado: este componente se adapta al contrato que
// ya existe.
//
// CONTRATO CON EL BACKEND — no cambiar sin mirar `polizaController.js`:
//
//   POST /polizas   body: { prospecto_id, cotizacion_id, form, detalles }
//     · faltando cualquiera de los tres primeros → 400
//     · `form.saludTerminos`, `form.declaracion_jurada.datos_fisicos` y
//       `form.declaracion_jurada.requiere_auditoria_medica` los lee el generador
//       de PDF; si no llegan NO falla, imprime la póliza con esos bloques vacíos.
//
//   POST /poliza-documentos/upload   multipart:
//     · campo de archivo: `documento`  (multer: upload.single('documento'))
//     · más `poliza_id`, `tipo_documento` y, para familiares, `integrante_index`
//
// NOTA DE IMPLEMENTACIÓN (migración a react-hook-form + zod):
// Internamente, `peso`/`altura`/`documentos` de cada integrante viven en el
// MISMO objeto `Integrante` (antes estaban repartidos en dos arrays paralelos
// —`integrantes[]` y `declaracion_jurada.datos_fisicos.integrantes[]`— que
// había que mantener sincronizados a mano en cada alta/baja). Es sólo un
// cambio de representación INTERNA: el payload que sale hacia el backend en
// `generarPoliza()` reconstruye la forma exacta de siempre.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo, useRef, startTransition } from "react"
import axios from "axios"
import { toast } from "sonner"
import { useForm, useFieldArray } from "react-hook-form"
import { ChevronRight, ChevronLeft, Check, FileText, Download, X, Mail, MessageCircle, RotateCcw, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

import {
  PREGUNTAS_DJ, ESTADOS_CIVILES, CONDICIONES_IVA,
  TIPOS_DOMICILIO, FORMAS_PAGO, NACIONALIDADES, SEXOS, VINCULOS, OBRAS_SOCIALES,
  RELACIONES_REFERENCIA, TIPO_AFILIACION, TIPO_AFILIACION_PARTICULAR,
  TIPOS_DOCUMENTO, DOCUMENTOS_REQUERIDOS, ETIQUETAS_DOCUMENTO,
  type TipoDocumento,
} from "@/features/vendedor/constants/poliza"
import {
  calcularMesVigencia, fechaHoyYMD, formaPagoPorPromocion, calcularIMC,
  calcularEdad, requiereAuditoriaMedica,
} from "@/features/vendedor/lib/poliza-reglas"
import { datosPersonalesSchema, referenciasSchema } from "@/features/vendedor/schemas"
import { PasoSaludTerminos } from "@/features/vendedor/components/PasoSaludTerminos"
import { saludTerminosVacio, type SaludTerminos } from "@/features/vendedor/lib/salud-terminos"

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Documentos = Partial<Record<TipoDocumento, File | null>>

interface DatosPersonales {
  numero_poliza_vendedor: string; asesor: string; fecha_solicitud: string
  mes_ingreso: string; proximo_periodo_abonar: string
  nombre: string; apellido: string; dni: string; cuil: string
  fecha_nacimiento: string; edad: string; sexo: string; estado_civil: string
  nacionalidad: string; condicion_iva: string; tipo_domicilio: string
  direccion: string; numero: string; piso: string; dpto: string
  cod_postal: string; localidad: string; email: string; telefono: string
  celular: string; tipo_afiliacion: string
  obra_social: string; obra_social_otra: string
  porcentaje_promocion: string; forma_pago: string
  empresa_razon_social: string; empresa_cuit: string; empresa_direccion: string
  empresa_codigo_postal: string; empresa_localidad: string; empresa_telefono: string
}

/** Datos personales + físicos + documentos de un integrante, todo en un solo lugar. */
interface Integrante {
  nombre: string; apellido: string; dni: string; cuil: string; email: string
  fecha_nacimiento: string; edad: number; sexo: string; nacionalidad: string
  vinculo: string
  peso: string; altura: string
  documentos: Documentos
}

interface PreguntaDJ { pregunta: string; respuesta: "si" | "no"; detalle: string }

interface DeclaracionJurada {
  datos_fisicos: { titular_peso: string; titular_altura: string }
  preguntas: PreguntaDJ[]
  enfermedades_seleccionadas: string[]
  detalle_enfermedades: string
  acepta_terminos: boolean
}

interface Referencia { nombre: string; relacion: string; telefono: string }

interface FormData {
  datos_personales: DatosPersonales
  declaracion_jurada: DeclaracionJurada
  integrantes: Integrante[]
  documentos_titular: Documentos
  referencias: Referencia[]
  saludTerminos: SaludTerminos
}

interface DetalleCotizacion {
  vinculo?: string; persona?: string; nombre?: string; apellido?: string
  edad?: number; promocion_aplicada?: string; descuento_promocion?: number
  porcentaje_promocion?: number
}

interface Cotizacion {
  id?: number
  plan_nombre?: string
  prestador_nombre?: string
  total_final?: number
  porcentaje_promocion?: number
  promocion_aplicada?: string
  detalles?: DetalleCotizacion[]
}

interface PolizaFormProps {
  cotizacion: Cotizacion | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prospecto: any
  open: boolean
  onClose: () => void
  onPolizaCreada: (poliza: unknown) => void
}

// ─── Estado inicial ───────────────────────────────────────────────────────────

const datosPersonalesVacios = (): DatosPersonales => ({
  numero_poliza_vendedor: "", asesor: "", fecha_solicitud: "", mes_ingreso: "",
  proximo_periodo_abonar: "", nombre: "", apellido: "", dni: "", cuil: "",
  fecha_nacimiento: "", edad: "", sexo: "", estado_civil: "",
  nacionalidad: "Argentina", condicion_iva: "Consumidor Final",
  tipo_domicilio: "Particular", direccion: "", numero: "", piso: "", dpto: "",
  cod_postal: "", localidad: "", email: "", telefono: "", celular: "",
  tipo_afiliacion: "", obra_social: "", obra_social_otra: "",
  porcentaje_promocion: "", forma_pago: "",
  empresa_razon_social: "", empresa_cuit: "", empresa_direccion: "",
  empresa_codigo_postal: "", empresa_localidad: "", empresa_telefono: "",
})

const emptyForm = (): FormData => ({
  datos_personales: datosPersonalesVacios(),
  declaracion_jurada: {
    datos_fisicos: { titular_peso: "", titular_altura: "" },
    preguntas: PREGUNTAS_DJ.map(p => ({ pregunta: p, respuesta: "no" as const, detalle: "" })),
    enfermedades_seleccionadas: [],
    detalle_enfermedades: "",
    acepta_terminos: false,
  },
  integrantes: [],
  documentos_titular: {},
  referencias: [{ nombre: "", relacion: "", telefono: "" }],
  saludTerminos: saludTerminosVacio(),
})

const nuevoIntegrante = (): Integrante => ({
  nombre: "", apellido: "", dni: "", cuil: "", email: "",
  fecha_nacimiento: "", edad: 0, sexo: "", nacionalidad: "Argentina",
  vinculo: "hijo/a", peso: "", altura: "", documentos: {},
})

// 5 pasos reales (ver `constants/poliza.ts` ETAPAS) — antes había un paso
// "Declaración Jurada" que en producción existe como componente pero NUNCA
// se usa en el alta (sólo en la edición de una póliza ya creada, vía
// `EditarPolizaModal`). Tenerlo como paso real acá era una superficie nueva
// para disparar `requiere_auditoria_medica` que producción jamás activa por
// esta vía, además de un paso extra no solicitado.
const PASOS = [
  "Datos Personales", "Integrantes y Documentos",
  "Referencias", "Salud y Términos", "Resumen Final",
] as const

const AYUDA_PASO: Record<number, string> = {
  1: "Complete los datos personales del titular",
  2: "Cargue documentos y datos de los familiares",
  3: "Agregue al menos una referencia personal",
  4: "Cuestionario de salud por integrante",
  5: "Revise y genere la póliza",
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function PolizaForm({ cotizacion, prospecto, open, onClose, onPolizaCreada }: PolizaFormProps) {
  const [paso, setPaso] = useState(1)
  const form = useForm<FormData>({ defaultValues: emptyForm() })
  const [localidades, setLocalidades] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [polizaGenerada, setPolizaGenerada] = useState<Record<string, unknown> | null>(null)
  const [numeroPolizaEnUso, setNumeroPolizaEnUso] = useState(false)
  const [verificandoNumero, setVerificandoNumero] = useState(false)
  const [entregando, setEntregando] = useState<"email" | "whatsapp" | null>(null)
  // La vigencia se autocalcula desde la fecha de solicitud, salvo que el
  // vendedor la edite a mano: a partir de ahí no se vuelve a pisar.
  const [vigenciaEditadaManualmente, setVigenciaEditadaManualmente] = useState(false)
  const prefilled = useRef(false)

  const integrantesArray = useFieldArray({ control: form.control, name: "integrantes" })
  const referenciasArray = useFieldArray({ control: form.control, name: "referencias" })

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${getAuthToken()}` }), [])

  // Snapshots reactivos: se usan para las validaciones derivadas (obligatorios,
  // errorEdad, IMC, puedeAvanzar) y para el resumen del paso 6. Los inputs en
  // sí se controlan cada uno con su propio `FormField`.
  const dp = form.watch("datos_personales")
  const dj = form.watch("declaracion_jurada")
  const integrantes = form.watch("integrantes")
  const referencias = form.watch("referencias")
  const documentosTitular = form.watch("documentos_titular")
  const numeroPolizaVendedor = form.watch("datos_personales.numero_poliza_vendedor")

  const tipoAfiliacionId = Number(prospecto?.tipo_afiliacion_id) || 0
  const requiereDatosEmpresa = tipoAfiliacionId !== TIPO_AFILIACION_PARTICULAR

  // ─── Precarga desde prospecto/cotización ──────────────────────────────────
  useEffect(() => {
    if (!open) {
      setPaso(1); setPolizaGenerada(null); prefilled.current = false
      return
    }
    if (prefilled.current) return
    prefilled.current = true

    startTransition(() => {
      const nombreVendedor = [
        localStorage.getItem("cober_first_name"),
        localStorage.getItem("cober_last_name"),
      ].filter(Boolean).join(" ").trim()

      // % de promoción: prioriza el aplicado en los detalles, igual que prod.
      const pctDetalles = cotizacion?.detalles?.find(d => d.porcentaje_promocion)?.porcentaje_promocion
      const pct = pctDetalles ?? cotizacion?.porcentaje_promocion ?? ""

      const hoy = fechaHoyYMD()

      // Familiares que vienen de la cotización (todo lo que no sea Titular).
      const familiares = (cotizacion?.detalles ?? []).filter(d => d.vinculo !== "Titular")
      const nuevosIntegrantes: Integrante[] = familiares.map(f => {
        const partes = (f.persona ?? "").split(" ")
        return {
          ...nuevoIntegrante(),
          nombre: f.nombre ?? partes[0] ?? "",
          apellido: f.apellido ?? partes.slice(1).join(" ") ?? "",
          edad: f.edad ?? 0,
          vinculo: f.vinculo ?? "hijo/a",
        }
      })

      form.reset({
        ...emptyForm(),
        datos_personales: {
          ...datosPersonalesVacios(),
          nombre: String(prospecto?.nombre ?? ""),
          apellido: String(prospecto?.apellido ?? ""),
          dni: String(prospecto?.dni ?? ""),
          email: String(prospecto?.correo ?? prospecto?.email ?? ""),
          telefono: String(prospecto?.numero_contacto ?? prospecto?.telefono ?? ""),
          celular: String(prospecto?.numero_contacto ?? prospecto?.telefono ?? ""),
          fecha_nacimiento: String(prospecto?.fecha_nacimiento ?? ""),
          edad: String(prospecto?.edad ?? ""),
          sexo: String(prospecto?.sexo ?? ""),
          localidad: String(prospecto?.localidad ?? ""),
          asesor: nombreVendedor,
          fecha_solicitud: hoy,
          mes_ingreso: calcularMesVigencia(hoy),
          porcentaje_promocion: pct === "" ? "" : String(pct),
          forma_pago: formaPagoPorPromocion(pct) ?? "",
          tipo_afiliacion: TIPO_AFILIACION[tipoAfiliacionId] ?? "",
        },
        integrantes: nuevosIntegrantes,
      })
      setVigenciaEditadaManualmente(false)
    })

    axios.get(`${API_URL}/localidades/buenos-aires`)
      .then(r => setLocalidades(
        (r.data as ({ nombre?: string } | string)[])?.map(l => typeof l === "string" ? l : (l?.nombre ?? "")) ?? []
      ))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prospecto, cotizacion, tipoAfiliacionId])

  /** Cambiar la fecha de solicitud recalcula la vigencia, salvo edición manual. */
  const setFechaSolicitud = (value: string) => {
    form.setValue("datos_personales.fecha_solicitud", value)
    if (!vigenciaEditadaManualmente) {
      const mes = calcularMesVigencia(value)
      if (mes) form.setValue("datos_personales.mes_ingreso", mes)
    }
  }

  const resetearVigencia = () => {
    setVigenciaEditadaManualmente(false)
    const mes = calcularMesVigencia(dp.fecha_solicitud)
    if (mes) form.setValue("datos_personales.mes_ingreso", mes)
  }

  const setDocumento = useCallback((tipo: TipoDocumento, file: File | null, integranteIdx: number | null = null) => {
    if (integranteIdx === null) {
      form.setValue(`documentos_titular.${tipo}`, file)
    } else {
      form.setValue(`integrantes.${integranteIdx}.documentos.${tipo}`, file)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const agregarIntegrante = () => integrantesArray.append(nuevoIntegrante())
  const quitarIntegrante = (idx: number) => integrantesArray.remove(idx)

  // ─── Forma de pago automática por % de promoción ──────────────────────────
  useEffect(() => {
    if (dp.forma_pago) return
    const sugerida = formaPagoPorPromocion(dp.porcentaje_promocion)
    if (sugerida) form.setValue("datos_personales.forma_pago", sugerida)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dp.porcentaje_promocion, dp.forma_pago])

  // ─── Verificar que el Nº de póliza no esté en uso ─────────────────────────
  useEffect(() => {
    const numero = numeroPolizaVendedor
    if (!numero?.trim()) { setNumeroPolizaEnUso(false); setVerificandoNumero(false); return }
    setVerificandoNumero(true)
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ numero: numero.trim() })
        const polizaId = polizaGenerada?.id
        if (polizaId) params.append("excluir_id", String(polizaId))
        const res = await axios.get(
          `${API_URL}/polizas/vendedor/verificar-numero-poliza?${params}`, { headers: authHeaders }
        )
        setNumeroPolizaEnUso(!res.data?.disponible)
      } catch {
        setNumeroPolizaEnUso(false) // ante fallo de red no bloqueamos (criterio de prod)
      } finally {
        setVerificandoNumero(false)
      }
    }, 600)
    return () => clearTimeout(t)
  }, [numeroPolizaVendedor, polizaGenerada?.id, authHeaders])

  // ─── Validación del paso 1 (misma regla que producción, vía zod) ──────────
  const datosPersonalesResult = useMemo(() => datosPersonalesSchema.safeParse(dp), [dp])
  const erroresDatosPersonales = useMemo(() => {
    const map: Partial<Record<keyof DatosPersonales, string>> = {}
    if (!datosPersonalesResult.success) {
      for (const issue of datosPersonalesResult.error.issues) {
        const key = issue.path[0] as keyof DatosPersonales
        if (!map[key]) map[key] = issue.message
      }
    }
    return map
  }, [datosPersonalesResult])
  const campoObligatorio = (c: keyof DatosPersonales) => !!erroresDatosPersonales[c]

  /**
   * Valida que la fecha de nacimiento sea coherente con la edad ya cargada.
   * Réplica de `handleFechaNacimientoChange` (`PasoDatosPersonales.jsx:303-341`).
   * Devuelve el mensaje de error, o "" si está bien.
   *
   * Casos especiales de producción que hay que respetar:
   *  - edad 0 (menores de 1 año): se acepta cualquier fecha, sin rango.
   *  - edad todavía sin cargar: se pide cargar la edad primero.
   */
  const errorEdad = useMemo(() => {
    const fecha = dp.fecha_nacimiento
    if (!fecha) return ""

    const edadIngresada = parseInt(dp.edad, 10)
    if (isNaN(edadIngresada)) return "Ingrese primero la edad y luego la fecha de nacimiento."
    if (edadIngresada === 0) return ""

    const hoy = new Date()
    const fechaNac = new Date(fecha)
    if (isNaN(fechaNac.getTime())) return "Fecha de nacimiento inválida."

    // Rango válido: desde (hoy - edad - 1 año + 1 día) hasta (hoy - edad años)
    const desde = new Date(hoy.getFullYear() - edadIngresada - 1, hoy.getMonth(), hoy.getDate() + 1)
    const hasta = new Date(hoy.getFullYear() - edadIngresada, hoy.getMonth(), hoy.getDate())

    if (fechaNac >= desde && fechaNac <= hasta) return ""
    return `La fecha no corresponde a una persona de ${edadIngresada} años. Debe estar entre ${desde.toLocaleDateString("es-AR")} y ${hasta.toLocaleDateString("es-AR")}.`
  }, [dp.fecha_nacimiento, dp.edad])

  const puedeAvanzar = (): boolean => {
    switch (paso) {
      case 1:
        return datosPersonalesResult.success && !numeroPolizaEnUso && !verificandoNumero && !errorEdad
      case 2: {
        // Peso y altura del titular y de CADA integrante + DNI frente y dorso.
        if (!dj.datos_fisicos.titular_peso || !dj.datos_fisicos.titular_altura) return false
        for (const integ of integrantes) {
          if (!integ.peso || !integ.altura) return false
        }
        const titularOk = DOCUMENTOS_REQUERIDOS.every(d => !!documentosTitular[d])
        const integrantesOk = integrantes.every(i => DOCUMENTOS_REQUERIDOS.every(d => !!i.documentos[d]))
        return titularOk && integrantesOk
      }
      case 3:
        return referenciasSchema.safeParse(referencias).success
      case 4:
        return dj.acepta_terminos && Object.keys(form.getValues("saludTerminos").respuestas).length > 0
      default:
        return true
    }
  }

  // ─── Generar la póliza ─────────────────────────────────────────────────────
  const generarPoliza = async () => {
    if (!prospecto?.id || !cotizacion?.id) {
      toast.error("Falta el prospecto o la cotización")
      return
    }

    setEnviando(true)
    try {
      const requiere_auditoria_medica = requiereAuditoriaMedica({
        datosFisicos: { ...dj.datos_fisicos, integrantes: integrantes.map(i => ({ peso: i.peso, altura: i.altura })) },
        preguntasDJ: dj.preguntas,
        enfermedadesSeleccionadas: dj.enfermedades_seleccionadas,
        respuestasSalud: form.getValues("saludTerminos").respuestas,
      })

      // Los File no viajan en el JSON: los documentos van aparte por multipart.
      const integrantesSinArchivos = integrantes.map(({ documentos, ...resto }) => {
        void documentos
        return resto
      })

      const formCompleto = {
        datos_personales: {
          ...dp,
          peso: dj.datos_fisicos.titular_peso,
          altura: dj.datos_fisicos.titular_altura,
        },
        // El archivo en sí va aparte por multipart (más abajo), pero el backend
        // valida la PRESENCIA de dni_frente/dni_dorso en este JSON antes de crear
        // la póliza (`polizaModel.js` validarFormularioCompleto) — sin esta clave
        // el alta siempre devolvía 400 "Formulario incompleto", aunque el
        // vendedor sí hubiera cargado ambos DNI.
        documentos_titular: Object.fromEntries(
          TIPOS_DOCUMENTO.filter(t => documentosTitular[t]).map(t => [t, true])
        ),
        declaracion_jurada: {
          ...dj,
          datos_fisicos: {
            titular_peso: dj.datos_fisicos.titular_peso,
            titular_altura: dj.datos_fisicos.titular_altura,
            // El backend/PDF espera nombre+apellido+peso+altura por integrante acá.
            integrantes: integrantes.map(i => ({
              nombre: i.nombre, apellido: i.apellido, peso: i.peso, altura: i.altura,
            })),
          },
          requiere_auditoria_medica,
        },
        integrantes: integrantesSinArchivos,
        referencias,
        saludTerminos: {
          respuestas: form.getValues("saludTerminos").respuestas ?? {},
          coberturaAnterior: form.getValues("saludTerminos").coberturaAnterior ?? {},
          medicacion: form.getValues("saludTerminos").medicacion ?? {},
          datosAdicionales: form.getValues("saludTerminos").datosAdicionales ?? {},
        },
      }

      const { data } = await axios.post(
        `${API_URL}/polizas`,
        {
          prospecto_id: prospecto.id,
          cotizacion_id: cotizacion.id,
          form: formCompleto,
          detalles: cotizacion.detalles ?? [],
        },
        { headers: authHeaders }
      )

      const poliza = data?.data ?? data?.poliza ?? data
      const polizaId = poliza?.id
      setPolizaGenerada(poliza)
      toast.success("Póliza generada correctamente")

      // Documentos del titular
      for (const tipo of TIPOS_DOCUMENTO) {
        const file = documentosTitular[tipo]
        if (!file || !polizaId) continue
        const fd = new FormData()
        fd.append("documento", file)
        fd.append("poliza_id", String(polizaId))
        fd.append("tipo_documento", tipo)
        await axios.post(`${API_URL}/poliza-documentos/upload`, fd, {
          headers: { ...authHeaders, "Content-Type": "multipart/form-data" },
          timeout: 60_000,
        }).catch(() => toast.error(`No se pudo subir ${ETIQUETAS_DOCUMENTO[tipo]} del titular`))
      }

      // Documentos de los integrantes
      for (let i = 0; i < integrantes.length; i++) {
        for (const tipo of TIPOS_DOCUMENTO) {
          const file = integrantes[i].documentos[tipo]
          if (!file || !polizaId) continue
          const fd = new FormData()
          fd.append("documento", file)
          fd.append("poliza_id", String(polizaId))
          fd.append("tipo_documento", tipo)
          fd.append("integrante_index", String(i))
          await axios.post(`${API_URL}/poliza-documentos/upload`, fd, {
            headers: { ...authHeaders, "Content-Type": "multipart/form-data" },
            timeout: 60_000,
          }).catch(() => toast.error(`No se pudo subir ${ETIQUETAS_DOCUMENTO[tipo]} de ${integrantes[i].nombre}`))
        }
      }

      onPolizaCreada(poliza)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } }
      toast.error(error.response?.data?.message ?? "Error al generar la póliza")
    } finally {
      setEnviando(false)
    }
  }

  const descargarPDF = async (polizaId: number) => {
    try {
      const { data } = await axios.get(`${API_URL}/polizas/${polizaId}/pdf`, {
        headers: authHeaders, responseType: "blob",
      })
      const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }))
      const a = document.createElement("a")
      a.href = url; a.download = `Poliza_${polizaId}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Error al descargar el PDF")
    }
  }

  // POST /polizas/:id/enviar-email | /enviar-whatsapp
  // Réplica de `PasoResumen.jsx:303-459`: antes de enviar, se confirma/edita el
  // destino en un diálogo (el vendedor puede corregir un teléfono/email mal
  // cargado sin tener que salir del resumen).
  const [envioDialog, setEnvioDialog] = useState<{ via: "email" | "whatsapp"; valor: string; polizaId: number } | null>(null)

  const abrirEnvioDialog = (via: "email" | "whatsapp", polizaId: number) => {
    const valor = via === "email" ? (dp.email || prospecto?.email || "") : (dp.celular || dp.telefono || prospecto?.telefono || "")
    setEnvioDialog({ via, valor, polizaId })
  }

  const enviarPoliza = async (via: "email" | "whatsapp", polizaId: number, destino: string) => {
    setEntregando(via)
    try {
      await axios.post(
        `${API_URL}/polizas/${polizaId}/enviar-${via}`,
        via === "email" ? { email: destino } : { telefono: destino },
        { headers: authHeaders }
      )
      toast.success(`Póliza enviada por ${via === "email" ? "email" : "WhatsApp"}`)
    } catch {
      toast.error(`Error al enviar por ${via === "email" ? "email" : "WhatsApp"}`)
    } finally {
      setEntregando(null)
    }
  }

  // ─── Render de campos reutilizables ───────────────────────────────────────
  const inputDocumento = (tipo: TipoDocumento, integranteIdx: number | null, actual: File | null | undefined) => {
    const id = `doc-${integranteIdx ?? "titular"}-${tipo}`
    const requerido = DOCUMENTOS_REQUERIDOS.includes(tipo)
    return (
      <div key={tipo} className="space-y-1">
        <FormLabel htmlFor={id} className="text-xs">
          {ETIQUETAS_DOCUMENTO[tipo]} {requerido ? "*" : "(opcional)"}
        </FormLabel>
        <Input
          id={id} type="file" accept="image/*,.pdf"
          aria-invalid={requerido && !actual}
          onChange={e => setDocumento(tipo, e.target.files?.[0] ?? null, integranteIdx)}
        />
        {actual && <p className="text-[11px] text-muted-foreground truncate">{actual.name}</p>}
      </div>
    )
  }

  // ─── PASO 1: Datos personales ─────────────────────────────────────────────
  const imcTitular = calcularIMC(dj.datos_fisicos.titular_peso, dj.datos_fisicos.titular_altura)

  const renderPaso1 = () => (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField control={form.control} name="datos_personales.numero_poliza_vendedor" render={({ field }) => (
          <FormItem>
            <FormLabel>Nº Póliza Vendedor *</FormLabel>
            <FormControl>
              <Input {...field} aria-invalid={numeroPolizaEnUso || campoObligatorio("numero_poliza_vendedor")} />
            </FormControl>
            {verificandoNumero && <p className="text-xs text-muted-foreground">Verificando disponibilidad…</p>}
            {!verificandoNumero && numeroPolizaEnUso && <FormMessage>Este número de póliza ya está en uso.</FormMessage>}
            {!numeroPolizaEnUso && <FormMessage>{erroresDatosPersonales.numero_poliza_vendedor}</FormMessage>}
          </FormItem>
        )} />

        <FormField control={form.control} name="datos_personales.asesor" render={({ field }) => (
          <FormItem><FormLabel>Asesor</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />

        <FormField control={form.control} name="datos_personales.fecha_solicitud" render={({ field }) => (
          <FormItem>
            <FormLabel>Fecha de solicitud</FormLabel>
            <FormControl>
              <Input type="date" {...field} onChange={e => setFechaSolicitud(e.target.value)} />
            </FormControl>
            <p className="text-[11px] text-muted-foreground">
              Del 1 al 13 la cobertura arranca el mismo mes; del 14 en adelante, el mes siguiente.
            </p>
          </FormItem>
        )} />

        <FormField control={form.control} name="datos_personales.mes_ingreso" render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel>Mes de vigencia *</FormLabel>
              {vigenciaEditadaManualmente && (
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={resetearVigencia}>
                  <RotateCcw className="size-3 mr-1" />Recalcular
                </Button>
              )}
            </div>
            <FormControl>
              <Input type="month" {...field} onChange={e => { setVigenciaEditadaManualmente(true); field.onChange(e) }} />
            </FormControl>
          </FormItem>
        )} />

        <FormField control={form.control} name="datos_personales.proximo_periodo_abonar" render={({ field }) => (
          <FormItem>
            <FormLabel>Próximo período a abonar *</FormLabel>
            <FormControl><Input type="month" {...field} aria-invalid={campoObligatorio("proximo_periodo_abonar")} /></FormControl>
            <FormMessage>{erroresDatosPersonales.proximo_periodo_abonar}</FormMessage>
          </FormItem>
        )} />

        <FormItem>
          <FormLabel>Tipo de afiliación</FormLabel>
          <Input value={dp.tipo_afiliacion || "Sin datos"} readOnly className="bg-muted" />
        </FormItem>
      </div>

      <Separator />
      <p className="text-sm font-semibold">Datos del titular</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          ["nombre", "Nombre *", "text"], ["apellido", "Apellido *", "text"],
          ["dni", "DNI *", "text"], ["cuil", "CUIL *", "text"],
        ] as const).map(([campo, label, type]) => (
          <FormField key={campo} control={form.control} name={`datos_personales.${campo}`} render={({ field }) => (
            <FormItem>
              <FormLabel>{label}</FormLabel>
              <FormControl>
                <Input {...field} type={type} aria-invalid={campoObligatorio(campo)}
                  placeholder={campo === "cuil" ? "20-12345678-9" : undefined} />
              </FormControl>
              <FormMessage>{erroresDatosPersonales[campo]}</FormMessage>
            </FormItem>
          )} />
        ))}

        <FormField control={form.control} name="datos_personales.fecha_nacimiento" render={({ field }) => (
          <FormItem>
            <FormLabel>Fecha de nacimiento *</FormLabel>
            <FormControl>
              <Input type="date" {...field} aria-invalid={campoObligatorio("fecha_nacimiento") || !!errorEdad} />
            </FormControl>
            <FormMessage>{errorEdad || erroresDatosPersonales.fecha_nacimiento}</FormMessage>
          </FormItem>
        )} />

        <FormField control={form.control} name="datos_personales.edad" render={({ field }) => {
          // Réplica de `PasoDatosPersonales.jsx:886-899`: editable sólo cuando
          // vale 0/vacío (menor de 1 año o prospecto sin edad cargada). Una vez
          // cargada queda de sólo lectura, para no pisar el dato del prospecto.
          const editable = field.value === "0" || field.value === ""
          return (
            <FormItem>
              <FormLabel>Edad</FormLabel>
              <FormControl>
                <Input
                  type={editable ? "number" : "text"}
                  value={editable ? "" : field.value}
                  onChange={e => field.onChange(e.target.value || "0")}
                  disabled={!editable}
                  placeholder={editable ? "Menor de 1 año" : undefined}
                  min={0}
                  max={120}
                />
              </FormControl>
            </FormItem>
          )
        }} />

        <FormField control={form.control} name="datos_personales.sexo" render={({ field }) => (
          <FormItem>
            <FormLabel>Sexo *</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger aria-invalid={campoObligatorio("sexo")}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              </FormControl>
              <SelectContent><SelectGroup>{SEXOS.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
            <FormMessage>{erroresDatosPersonales.sexo}</FormMessage>
          </FormItem>
        )} />

        <FormField control={form.control} name="datos_personales.estado_civil" render={({ field }) => (
          <FormItem>
            <FormLabel>Estado civil *</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger aria-invalid={campoObligatorio("estado_civil")}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              </FormControl>
              <SelectContent><SelectGroup>{ESTADOS_CIVILES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
            <FormMessage>{erroresDatosPersonales.estado_civil}</FormMessage>
          </FormItem>
        )} />

        <FormField control={form.control} name="datos_personales.nacionalidad" render={({ field }) => (
          <FormItem>
            <FormLabel>Nacionalidad *</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger aria-invalid={campoObligatorio("nacionalidad")}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              </FormControl>
              <SelectContent><SelectGroup>{NACIONALIDADES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
            <FormMessage>{erroresDatosPersonales.nacionalidad}</FormMessage>
          </FormItem>
        )} />

        <FormField control={form.control} name="datos_personales.condicion_iva" render={({ field }) => (
          <FormItem>
            <FormLabel>Condición IVA *</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger aria-invalid={campoObligatorio("condicion_iva")}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              </FormControl>
              <SelectContent><SelectGroup>{CONDICIONES_IVA.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
            <FormMessage>{erroresDatosPersonales.condicion_iva}</FormMessage>
          </FormItem>
        )} />

        <FormField control={form.control} name="datos_personales.tipo_domicilio" render={({ field }) => (
          <FormItem>
            <FormLabel>Tipo de domicilio *</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger aria-invalid={campoObligatorio("tipo_domicilio")}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              </FormControl>
              <SelectContent><SelectGroup>{TIPOS_DOMICILIO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
            <FormMessage>{erroresDatosPersonales.tipo_domicilio}</FormMessage>
          </FormItem>
        )} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <FormField control={form.control} name="datos_personales.direccion" render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Dirección *</FormLabel>
            <FormControl><Input {...field} aria-invalid={campoObligatorio("direccion")} /></FormControl>
            <FormMessage>{erroresDatosPersonales.direccion}</FormMessage>
          </FormItem>
        )} />
        <FormField control={form.control} name="datos_personales.numero" render={({ field }) => (
          <FormItem>
            <FormLabel>Número *</FormLabel>
            <FormControl><Input {...field} aria-invalid={campoObligatorio("numero")} /></FormControl>
            <FormMessage>{erroresDatosPersonales.numero}</FormMessage>
          </FormItem>
        )} />
        <FormField control={form.control} name="datos_personales.piso" render={({ field }) => (
          <FormItem><FormLabel>Piso</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="datos_personales.dpto" render={({ field }) => (
          <FormItem><FormLabel>Dpto</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="datos_personales.cod_postal" render={({ field }) => (
          <FormItem>
            <FormLabel>Cód. postal *</FormLabel>
            <FormControl><Input {...field} aria-invalid={campoObligatorio("cod_postal")} /></FormControl>
            <FormMessage>{erroresDatosPersonales.cod_postal}</FormMessage>
          </FormItem>
        )} />
      </div>

      <FormField control={form.control} name="datos_personales.localidad" render={({ field }) => (
        <FormItem>
          <FormLabel>Localidad *</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger aria-invalid={campoObligatorio("localidad")}><SelectValue placeholder="Seleccionar localidad" /></SelectTrigger>
            </FormControl>
            <SelectContent><SelectGroup>{localidades.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
          <FormMessage>{erroresDatosPersonales.localidad}</FormMessage>
        </FormItem>
      )} />

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField control={form.control} name="datos_personales.email" render={({ field }) => (
          <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="datos_personales.telefono" render={({ field }) => (
          <FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="datos_personales.celular" render={({ field }) => (
          <FormItem><FormLabel>Celular</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="datos_personales.porcentaje_promocion" render={({ field }) => (
          <FormItem><FormLabel>% Promoción</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
        )} />
        <FormField control={form.control} name="datos_personales.obra_social" render={({ field }) => (
          <FormItem>
            <FormLabel>Obra social</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
              <SelectContent><SelectGroup>
                {OBRAS_SOCIALES.map(o => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectGroup></SelectContent>
            </Select>
          </FormItem>
        )} />
        {dp.obra_social === "Otra" && (
          <FormField control={form.control} name="datos_personales.obra_social_otra" render={({ field }) => (
            <FormItem>
              <FormLabel>¿Cuál? *</FormLabel>
              <FormControl><Input {...field} aria-invalid={campoObligatorio("obra_social_otra")} /></FormControl>
              <FormMessage>{erroresDatosPersonales.obra_social_otra}</FormMessage>
            </FormItem>
          )} />
        )}
      </div>

      <FormField control={form.control} name="datos_personales.forma_pago" render={({ field }) => (
        <FormItem>
          <FormLabel>Forma de pago *</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger aria-invalid={campoObligatorio("forma_pago")}><SelectValue placeholder="Seleccionar forma de pago" /></SelectTrigger>
            </FormControl>
            <SelectContent><SelectGroup>{FORMAS_PAGO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
          <FormMessage>{erroresDatosPersonales.forma_pago}</FormMessage>
        </FormItem>
      )} />

      {/* Bloque empresa: sólo para afiliación "Con recibo de sueldo" */}
      {requiereDatosEmpresa && (
        <>
          <Separator />
          <p className="text-sm font-semibold">Datos de la empresa empleadora</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["empresa_razon_social", "Razón social"],
              ["empresa_cuit", "CUIT"],
              ["empresa_direccion", "Dirección"],
              ["empresa_codigo_postal", "Código postal"],
              ["empresa_localidad", "Localidad"],
              ["empresa_telefono", "Teléfono"],
            ] as const).map(([campo, label]) => (
              <FormField key={campo} control={form.control} name={`datos_personales.${campo}`} render={({ field }) => (
                <FormItem><FormLabel>{label}</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )} />
            ))}
          </div>
        </>
      )}

      {!datosPersonalesResult.success && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Faltan {Object.keys(erroresDatosPersonales).length} campo(s) obligatorio(s) para continuar.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )

  // ─── PASO 3: Integrantes y documentos ─────────────────────────────────────
  const renderPaso3 = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Titular</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField control={form.control} name="declaracion_jurada.datos_fisicos.titular_peso" render={({ field }) => (
              <FormItem>
                <FormLabel>Peso (kg) *</FormLabel>
                <FormControl><Input type="number" {...field} aria-invalid={!field.value} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="declaracion_jurada.datos_fisicos.titular_altura" render={({ field }) => (
              <FormItem>
                <FormLabel>Altura (cm) *</FormLabel>
                <FormControl><Input type="number" {...field} aria-invalid={!field.value} /></FormControl>
              </FormItem>
            )} />
          </div>
          {imcTitular !== null && (
            <p className="text-xs text-muted-foreground">
              IMC: <strong>{imcTitular}</strong>
              {imcTitular > 30 && (
                <Badge variant="destructive" className="ml-2 text-[10px]">Requiere auditoría médica</Badge>
              )}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            {TIPOS_DOCUMENTO.map(t => inputDocumento(t, null, documentosTitular[t]))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Integrantes del grupo familiar</p>
        <Button type="button" variant="outline" size="sm" onClick={agregarIntegrante}>
          + Agregar integrante
        </Button>
      </div>

      {integrantesArray.fields.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">Sin integrantes (sólo titular)</p>
      )}

      {integrantesArray.fields.map((rowField, idx) => {
        const integ = integrantes[idx]
        const imc = calcularIMC(integ?.peso, integ?.altura)
        return (
          <Card key={rowField.id} className="relative">
            <CardHeader>
              <CardTitle className="text-sm">
                Integrante {idx + 1}{integ?.nombre ? ` — ${integ.nombre} ${integ.apellido}` : ""}
              </CardTitle>
              <Button type="button" variant="ghost" size="icon"
                className="absolute right-3 top-3 size-7"
                aria-label={`Quitar integrante ${idx + 1}`}
                onClick={() => quitarIntegrante(idx)}>
                <X className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField control={form.control} name={`integrantes.${idx}.nombre`} render={({ field }) => (
                  <FormItem><FormLabel>Nombre *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name={`integrantes.${idx}.apellido`} render={({ field }) => (
                  <FormItem><FormLabel>Apellido *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name={`integrantes.${idx}.dni`} render={({ field }) => (
                  <FormItem><FormLabel>DNI</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name={`integrantes.${idx}.cuil`} render={({ field }) => (
                  <FormItem><FormLabel>CUIL</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name={`integrantes.${idx}.vinculo`} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vínculo *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectGroup>{VINCULOS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectGroup></SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name={`integrantes.${idx}.fecha_nacimiento`} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de nacimiento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} onChange={e => {
                        field.onChange(e)
                        form.setValue(`integrantes.${idx}.edad`, calcularEdad(e.target.value))
                      }} />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name={`integrantes.${idx}.sexo`} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sexo</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
                      <SelectContent><SelectGroup>{SEXOS.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectGroup></SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name={`integrantes.${idx}.nacionalidad`} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nacionalidad</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
                      <SelectContent><SelectGroup>{NACIONALIDADES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectGroup></SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name={`integrantes.${idx}.peso`} render={({ field }) => (
                  <FormItem><FormLabel>Peso (kg) *</FormLabel><FormControl><Input type="number" {...field} aria-invalid={!field.value} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name={`integrantes.${idx}.altura`} render={({ field }) => (
                  <FormItem><FormLabel>Altura (cm) *</FormLabel><FormControl><Input type="number" {...field} aria-invalid={!field.value} /></FormControl></FormItem>
                )} />
              </div>
              {imc !== null && (
                <p className="text-xs text-muted-foreground">
                  IMC: <strong>{imc}</strong>
                  {imc > 30 && <Badge variant="destructive" className="ml-2 text-[10px]">Requiere auditoría médica</Badge>}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                {TIPOS_DOCUMENTO.map(t => inputDocumento(t, idx, integ?.documentos?.[t]))}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )

  // ─── PASO 4: Referencias ──────────────────────────────────────────────────
  const renderPaso4 = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Referencias personales (1 a 3)</p>
        {referenciasArray.fields.length < 3 && (
          <Button type="button" variant="outline" size="sm"
            onClick={() => referenciasArray.append({ nombre: "", relacion: "", telefono: "" })}>
            + Agregar
          </Button>
        )}
      </div>
      {referenciasArray.fields.map((rowField, idx) => (
        <div key={rowField.id} className="relative space-y-3 rounded-lg border p-3">
          {idx > 0 && (
            <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 size-7"
              aria-label={`Quitar referencia ${idx + 1}`}
              onClick={() => referenciasArray.remove(idx)}>
              <X className="size-4" />
            </Button>
          )}
          <p className="text-sm font-medium text-muted-foreground">Referencia {idx + 1}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField control={form.control} name={`referencias.${idx}.nombre`} render={({ field }) => (
              <FormItem><FormLabel>Nombre *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name={`referencias.${idx}.relacion`} render={({ field }) => (
              <FormItem>
                <FormLabel>Relación *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
                  <SelectContent><SelectGroup>{RELACIONES_REFERENCIA.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name={`referencias.${idx}.telefono`} render={({ field }) => (
              <FormItem><FormLabel>Teléfono *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
          </div>
        </div>
      ))}
    </div>
  )

  // ─── PASO 5: Salud y términos ─────────────────────────────────────────────
  const renderPaso5 = () => (
    <PasoSaludTerminos
      titular={{ nombre: dp.nombre, apellido: dp.apellido, sexo: dp.sexo }}
      integrantes={integrantes.map(i => ({ nombre: i.nombre, apellido: i.apellido, vinculo: i.vinculo, sexo: i.sexo }))}
      value={form.watch("saludTerminos")}
      onChange={next => form.setValue("saludTerminos", next)}
      aceptaTerminos={dj.acepta_terminos}
      onAceptaTerminosChange={v => form.setValue("declaracion_jurada.acepta_terminos", v)}
    />
  )

  // ─── PASO 6: Resumen ──────────────────────────────────────────────────────
  const auditoriaPrevista = requiereAuditoriaMedica({
    datosFisicos: { ...dj.datos_fisicos, integrantes: integrantes.map(i => ({ peso: i.peso, altura: i.altura })) },
    preguntasDJ: dj.preguntas,
    enfermedadesSeleccionadas: dj.enfermedades_seleccionadas,
    respuestasSalud: form.watch("saludTerminos").respuestas,
  })

  const renderPaso6 = () => (
    <div className="space-y-4">
      {polizaGenerada ? (
        <div className="space-y-4 py-4 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-state-ok-soft">
            <Check className="size-8 text-state-ok-text" />
          </div>
          <div>
            <p className="text-xl font-bold text-state-ok-text">¡Póliza generada!</p>
            <p className="text-sm text-muted-foreground">
              Nº {String(dp.numero_poliza_vendedor || polizaGenerada.numero_poliza || polizaGenerada.id || "")}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {!!polizaGenerada.id && (
              <>
                <Button onClick={() => descargarPDF(polizaGenerada.id as number)}>
                  <Download className="size-4 mr-2" />Descargar PDF
                </Button>
                <Button variant="outline" disabled={entregando === "email"}
                  onClick={() => abrirEnvioDialog("email", polizaGenerada.id as number)}>
                  <Mail className="size-4 mr-2" />Enviar por email
                </Button>
                <Button variant="outline" disabled={entregando === "whatsapp"}
                  onClick={() => abrirEnvioDialog("whatsapp", polizaGenerada.id as number)}>
                  <MessageCircle className="size-4 mr-2" />Enviar por WhatsApp
                </Button>
              </>
            )}
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Revisá los datos antes de generar la póliza.</p>

          {auditoriaPrevista && (
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertDescription>
                Esta póliza queda marcada para <strong>auditoría médica</strong> por IMC elevado o
                respuestas afirmativas en la declaración de salud.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader><CardTitle className="text-sm">Titular</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p><strong>Nombre:</strong> {dp.nombre} {dp.apellido}</p>
              <p><strong>DNI:</strong> {dp.dni} · <strong>CUIL:</strong> {dp.cuil}</p>
              <p><strong>Email:</strong> {dp.email} · <strong>Celular:</strong> {dp.celular}</p>
              <p><strong>Domicilio:</strong> {dp.direccion} {dp.numero}, {dp.localidad} ({dp.cod_postal})</p>
              <p><strong>Forma de pago:</strong> {dp.forma_pago}</p>
              <p><strong>Vigencia:</strong> {dp.mes_ingreso} · <strong>Próximo período:</strong> {dp.proximo_periodo_abonar}</p>
            </CardContent>
          </Card>

          {requiereDatosEmpresa && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Empresa</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><strong>Razón social:</strong> {dp.empresa_razon_social || "—"}</p>
                <p><strong>CUIT:</strong> {dp.empresa_cuit || "—"}</p>
              </CardContent>
            </Card>
          )}

          {cotizacion && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Cotización</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><strong>Plan:</strong> {cotizacion.plan_nombre}</p>
                {cotizacion.prestador_nombre && <p><strong>Prestador:</strong> {cotizacion.prestador_nombre}</p>}
                <p><strong>Total final:</strong>{" "}
                  <span className="font-bold">
                    {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(cotizacion.total_final ?? 0)}
                  </span>
                </p>
              </CardContent>
            </Card>
          )}

          {integrantes.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Integrantes ({integrantes.length})</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {integrantes.map((i, idx) => (
                  <p key={idx}>{i.nombre} {i.apellido} — {i.vinculo}</p>
                ))}
              </CardContent>
            </Card>
          )}

          <Button className="w-full" disabled={enviando || !dj.acepta_terminos} onClick={generarPoliza}>
            <FileText className="size-4 mr-2" />
            {enviando ? "Generando póliza…" : "Generar póliza"}
          </Button>
        </>
      )}
    </div>
  )

  const renderPasoActual = () => {
    switch (paso) {
      case 1: return renderPaso1()
      case 2: return renderPaso3()
      case 3: return renderPaso4()
      case 4: return renderPaso5()
      case 5: return renderPaso6()
      default: return null
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={v => !v && !enviando && onClose()}>
      <DialogContent className="sm:max-w-3xl lg:max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Formulario de afiliación — Paso {paso} de {PASOS.length}
          </DialogTitle>
        </DialogHeader>

        {/* Progreso */}
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            {PASOS.map((_, i) => (
              <div key={i}
                className={`h-1.5 flex-1 rounded-full ${i < paso ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{PASOS[paso - 1]}</p>
            <p className="text-xs text-muted-foreground">{AYUDA_PASO[paso]}</p>
          </div>
        </div>

        <Form {...form}>
          <div className="py-2">{renderPasoActual()}</div>
        </Form>

        {!polizaGenerada && (
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <Button type="button" variant="outline" disabled={paso === 1}
              onClick={() => setPaso(p => Math.max(1, p - 1))}>
              <ChevronLeft className="size-4 mr-1" />Anterior
            </Button>
            {paso < PASOS.length && (
              <Button type="button" disabled={!puedeAvanzar()}
                onClick={() => setPaso(p => Math.min(PASOS.length, p + 1))}>
                Siguiente<ChevronRight className="size-4 ml-1" />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Confirmar/editar destino antes de enviar (réplica de PasoResumen.jsx:303-459) */}
    <Dialog open={!!envioDialog} onOpenChange={v => !v && setEnvioDialog(null)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {envioDialog?.via === "email" ? "Enviar por email" : "Enviar por WhatsApp"}
          </DialogTitle>
        </DialogHeader>
        {envioDialog && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="envio-destino">
                {envioDialog.via === "email" ? "Dirección de email" : "Número de teléfono (con código de país)"}
              </Label>
              <Input
                id="envio-destino"
                type={envioDialog.via === "email" ? "email" : "text"}
                autoFocus
                value={envioDialog.valor}
                onChange={e => setEnvioDialog(d => d && { ...d, valor: e.target.value })}
                placeholder={envioDialog.via === "email" ? "ejemplo@email.com" : "Ej: +5491123456789"}
              />
              <p className="text-[11px] text-muted-foreground">
                {envioDialog.via === "email"
                  ? "Se enviará la póliza como archivo adjunto."
                  : "Formato recomendado: +549XXXXXXXXXX. Se enviará un enlace para descargar la póliza."}
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setEnvioDialog(null)}>Cancelar</Button>
          <Button
            onClick={() => {
              if (!envioDialog) return
              const valor = envioDialog.valor.trim()
              if (envioDialog.via === "email") {
                if (!/\S+@\S+\.\S+/.test(valor)) { toast.error("Ingresá un email válido."); return }
              } else {
                if (valor.replace(/\s+/g, "").length < 8) { toast.error("El número parece ser demasiado corto."); return }
              }
              enviarPoliza(envioDialog.via, envioDialog.polizaId, valor)
              setEnvioDialog(null)
            }}
          >
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

export default PolizaForm
