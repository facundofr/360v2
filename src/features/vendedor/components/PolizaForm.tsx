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
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo, useRef, startTransition } from "react"
import axios from "axios"
import { toast } from "sonner"
import { ChevronRight, ChevronLeft, Check, FileText, Download, X, Mail, MessageCircle, RotateCcw, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

import {
  PREGUNTAS_DJ, ENFERMEDADES_PATOLOGIAS, ESTADOS_CIVILES, CONDICIONES_IVA,
  TIPOS_DOMICILIO, FORMAS_PAGO, NACIONALIDADES, SEXOS, VINCULOS,
  RELACIONES_REFERENCIA, TIPO_AFILIACION, TIPO_AFILIACION_CON_RECIBO,
  TIPOS_DOCUMENTO, DOCUMENTOS_REQUERIDOS, ETIQUETAS_DOCUMENTO,
  CAMPOS_OBLIGATORIOS_DATOS_PERSONALES, type TipoDocumento,
} from "@/features/vendedor/constants/poliza"
import {
  calcularMesVigencia, fechaHoyYMD, formaPagoPorPromocion, calcularIMC,
  calcularEdad, requiereAuditoriaMedica,
} from "@/features/vendedor/lib/poliza-reglas"
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

interface Integrante {
  nombre: string; apellido: string; dni: string; cuil: string; email: string
  fecha_nacimiento: string; edad: number; sexo: string; nacionalidad: string
  vinculo: string; documentos: Documentos
}

interface DatoFisicoIntegrante { nombre: string; apellido: string; peso: string; altura: string }
interface PreguntaDJ { pregunta: string; respuesta: "si" | "no"; detalle: string }

interface DeclaracionJurada {
  datos_fisicos: {
    titular_peso: string
    titular_altura: string
    integrantes: DatoFisicoIntegrante[]
  }
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
    datos_fisicos: { titular_peso: "", titular_altura: "", integrantes: [] },
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

const PASOS = [
  "Datos Personales", "Declaración Jurada", "Integrantes y Documentos",
  "Referencias", "Salud y Términos", "Resumen Final",
] as const

const AYUDA_PASO: Record<number, string> = {
  1: "Complete los datos personales del titular",
  2: "Declaración jurada de salud del grupo",
  3: "Cargue documentos y datos de los familiares",
  4: "Agregue al menos una referencia personal",
  5: "Cuestionario de salud por integrante",
  6: "Revise y genere la póliza",
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function PolizaForm({ cotizacion, prospecto, open, onClose, onPolizaCreada }: PolizaFormProps) {
  const [paso, setPaso] = useState(1)
  const [form, setForm] = useState<FormData>(emptyForm)
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

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${getAuthToken()}` }), [])

  const dp = form.datos_personales
  const dj = form.declaracion_jurada

  const tipoAfiliacionId = Number(prospecto?.tipo_afiliacion_id) || 0
  const requiereDatosEmpresa = tipoAfiliacionId === TIPO_AFILIACION_CON_RECIBO

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

      setForm(prev => {
        const integrantes: Integrante[] = familiares.map(f => {
          const partes = (f.persona ?? "").split(" ")
          return {
            nombre: f.nombre ?? partes[0] ?? "",
            apellido: f.apellido ?? partes.slice(1).join(" ") ?? "",
            dni: "", cuil: "", email: "", fecha_nacimiento: "",
            edad: f.edad ?? 0, sexo: "", nacionalidad: "Argentina",
            vinculo: f.vinculo ?? "hijo/a",
            documentos: {},
          }
        })

        return {
          ...prev,
          datos_personales: {
            ...prev.datos_personales,
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
          integrantes,
          declaracion_jurada: {
            ...prev.declaracion_jurada,
            datos_fisicos: {
              titular_peso: "", titular_altura: "",
              integrantes: integrantes.map(i => ({
                nombre: i.nombre, apellido: i.apellido, peso: "", altura: "",
              })),
            },
          },
        }
      })
    })

    axios.get(`${API_URL}/localidades/buenos-aires`)
      .then(r => setLocalidades(
        (r.data as ({ nombre?: string } | string)[])?.map(l => typeof l === "string" ? l : (l?.nombre ?? "")) ?? []
      ))
      .catch(() => {})
  }, [open, prospecto, cotizacion, tipoAfiliacionId])

  // ─── Helpers de escritura ──────────────────────────────────────────────────
  const updDP = useCallback((field: keyof DatosPersonales, value: string) => {
    setForm(prev => ({ ...prev, datos_personales: { ...prev.datos_personales, [field]: value } }))
  }, [])

  const updDJ = useCallback(<K extends keyof DeclaracionJurada>(field: K, value: DeclaracionJurada[K]) => {
    setForm(prev => ({ ...prev, declaracion_jurada: { ...prev.declaracion_jurada, [field]: value } }))
  }, [])

  /** Cambiar la fecha de solicitud recalcula la vigencia, salvo edición manual. */
  const setFechaSolicitud = (value: string) => {
    setForm(prev => {
      const mes = vigenciaEditadaManualmente
        ? prev.datos_personales.mes_ingreso
        : (calcularMesVigencia(value) || prev.datos_personales.mes_ingreso)
      return {
        ...prev,
        datos_personales: { ...prev.datos_personales, fecha_solicitud: value, mes_ingreso: mes },
      }
    })
  }

  const resetearVigencia = () => {
    setVigenciaEditadaManualmente(false)
    const mes = calcularMesVigencia(dp.fecha_solicitud)
    if (mes) updDP("mes_ingreso", mes)
  }

  const setDatoFisicoIntegrante = (idx: number, campo: "peso" | "altura", valor: string) => {
    setForm(prev => {
      const integrantes = [...prev.declaracion_jurada.datos_fisicos.integrantes]
      integrantes[idx] = { ...(integrantes[idx] ?? { nombre: "", apellido: "", peso: "", altura: "" }), [campo]: valor }
      return {
        ...prev,
        declaracion_jurada: {
          ...prev.declaracion_jurada,
          datos_fisicos: { ...prev.declaracion_jurada.datos_fisicos, integrantes },
        },
      }
    })
  }

  const setIntegrante = (idx: number, patch: Partial<Integrante>) => {
    setForm(prev => {
      const integrantes = prev.integrantes.map((it, i) => (i === idx ? { ...it, ...patch } : it))
      // Mantener sincronizados nombre/apellido con los datos físicos, igual que prod.
      const fisicos = [...prev.declaracion_jurada.datos_fisicos.integrantes]
      if (patch.nombre !== undefined || patch.apellido !== undefined) {
        fisicos[idx] = {
          ...(fisicos[idx] ?? { nombre: "", apellido: "", peso: "", altura: "" }),
          nombre: integrantes[idx].nombre,
          apellido: integrantes[idx].apellido,
        }
      }
      return {
        ...prev,
        integrantes,
        declaracion_jurada: {
          ...prev.declaracion_jurada,
          datos_fisicos: { ...prev.declaracion_jurada.datos_fisicos, integrantes: fisicos },
        },
      }
    })
  }

  const setDocumento = (tipo: TipoDocumento, file: File | null, integranteIdx: number | null = null) => {
    setForm(prev => {
      if (integranteIdx === null) {
        return { ...prev, documentos_titular: { ...prev.documentos_titular, [tipo]: file } }
      }
      return {
        ...prev,
        integrantes: prev.integrantes.map((it, i) =>
          i === integranteIdx ? { ...it, documentos: { ...it.documentos, [tipo]: file } } : it
        ),
      }
    })
  }

  const agregarIntegrante = () => {
    setForm(prev => ({
      ...prev,
      integrantes: [...prev.integrantes, {
        nombre: "", apellido: "", dni: "", cuil: "", email: "",
        fecha_nacimiento: "", edad: 0, sexo: "", nacionalidad: "Argentina",
        vinculo: "hijo/a", documentos: {},
      }],
      declaracion_jurada: {
        ...prev.declaracion_jurada,
        datos_fisicos: {
          ...prev.declaracion_jurada.datos_fisicos,
          integrantes: [...prev.declaracion_jurada.datos_fisicos.integrantes,
            { nombre: "", apellido: "", peso: "", altura: "" }],
        },
      },
    }))
  }

  const quitarIntegrante = (idx: number) => {
    setForm(prev => ({
      ...prev,
      integrantes: prev.integrantes.filter((_, i) => i !== idx),
      declaracion_jurada: {
        ...prev.declaracion_jurada,
        datos_fisicos: {
          ...prev.declaracion_jurada.datos_fisicos,
          integrantes: prev.declaracion_jurada.datos_fisicos.integrantes.filter((_, i) => i !== idx),
        },
      },
    }))
  }

  // ─── Forma de pago automática por % de promoción ──────────────────────────
  useEffect(() => {
    if (dp.forma_pago) return
    const sugerida = formaPagoPorPromocion(dp.porcentaje_promocion)
    if (sugerida) updDP("forma_pago", sugerida)
  }, [dp.porcentaje_promocion, dp.forma_pago, updDP])

  // ─── Verificar que el Nº de póliza no esté en uso ─────────────────────────
  useEffect(() => {
    const numero = dp.numero_poliza_vendedor
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
  }, [dp.numero_poliza_vendedor, polizaGenerada?.id, authHeaders])

  // ─── Validación por paso (misma que producción) ───────────────────────────
  const faltantesDatosPersonales = useMemo(
    () => CAMPOS_OBLIGATORIOS_DATOS_PERSONALES.filter(c => !String(dp[c] ?? "").trim()),
    [dp]
  )

  const puedeAvanzar = (): boolean => {
    switch (paso) {
      case 1:
        return faltantesDatosPersonales.length === 0 && !numeroPolizaEnUso && !verificandoNumero
      case 2:
        return true // la DJ resumida no bloquea, igual que prod
      case 3: {
        // Peso y altura del titular y de CADA integrante + DNI frente y dorso.
        if (!dj.datos_fisicos.titular_peso || !dj.datos_fisicos.titular_altura) return false
        for (let i = 0; i < form.integrantes.length; i++) {
          const df = dj.datos_fisicos.integrantes[i]
          if (!df?.peso || !df?.altura) return false
        }
        const titularOk = DOCUMENTOS_REQUERIDOS.every(d => !!form.documentos_titular[d])
        const integrantesOk = form.integrantes.every(i => DOCUMENTOS_REQUERIDOS.every(d => !!i.documentos[d]))
        return titularOk && integrantesOk
      }
      case 4:
        return form.referencias.length >= 1 &&
          form.referencias.every(r => r.nombre.trim() && r.relacion.trim() && r.telefono.trim())
      case 5:
        return dj.acepta_terminos && Object.keys(form.saludTerminos.respuestas).length > 0
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
        datosFisicos: dj.datos_fisicos,
        preguntasDJ: dj.preguntas,
        enfermedadesSeleccionadas: dj.enfermedades_seleccionadas,
        respuestasSalud: form.saludTerminos.respuestas,
      })

      // Los File no viajan en el JSON: los documentos van aparte por multipart.
      const integrantesSinArchivos = form.integrantes.map((integrante, i) => {
        const { documentos, ...resto } = integrante
        void documentos
        return {
          ...resto,
          peso: dj.datos_fisicos.integrantes[i]?.peso ?? "",
          altura: dj.datos_fisicos.integrantes[i]?.altura ?? "",
        }
      })

      const formCompleto = {
        datos_personales: {
          ...form.datos_personales,
          peso: dj.datos_fisicos.titular_peso,
          altura: dj.datos_fisicos.titular_altura,
        },
        declaracion_jurada: { ...dj, requiere_auditoria_medica },
        integrantes: integrantesSinArchivos,
        referencias: form.referencias,
        saludTerminos: {
          respuestas: form.saludTerminos.respuestas ?? {},
          coberturaAnterior: form.saludTerminos.coberturaAnterior ?? {},
          medicacion: form.saludTerminos.medicacion ?? {},
          datosAdicionales: form.saludTerminos.datosAdicionales ?? {},
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
        const file = form.documentos_titular[tipo]
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
      for (let i = 0; i < form.integrantes.length; i++) {
        for (const tipo of TIPOS_DOCUMENTO) {
          const file = form.integrantes[i].documentos[tipo]
          if (!file || !polizaId) continue
          const fd = new FormData()
          fd.append("documento", file)
          fd.append("poliza_id", String(polizaId))
          fd.append("tipo_documento", tipo)
          fd.append("integrante_index", String(i))
          await axios.post(`${API_URL}/poliza-documentos/upload`, fd, {
            headers: { ...authHeaders, "Content-Type": "multipart/form-data" },
            timeout: 60_000,
          }).catch(() => toast.error(`No se pudo subir ${ETIQUETAS_DOCUMENTO[tipo]} de ${form.integrantes[i].nombre}`))
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
  const enviarPoliza = async (via: "email" | "whatsapp", polizaId: number) => {
    const destino = via === "email" ? (dp.email || prospecto?.email || "") : (dp.celular || prospecto?.telefono || "")
    if (!destino) {
      toast.error(via === "email" ? "No hay email del titular" : "No hay teléfono del titular")
      return
    }
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
  const campoObligatorio = (c: string) => faltantesDatosPersonales.includes(c as never)

  const inputDocumento = (tipo: TipoDocumento, integranteIdx: number | null, actual: File | null | undefined) => {
    const id = `doc-${integranteIdx ?? "titular"}-${tipo}`
    const requerido = DOCUMENTOS_REQUERIDOS.includes(tipo)
    return (
      <div key={tipo} className="space-y-1">
        <Label htmlFor={id} className="text-xs">
          {ETIQUETAS_DOCUMENTO[tipo]} {requerido ? "*" : "(opcional)"}
        </Label>
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
        <div className="space-y-1">
          <Label htmlFor="nro-poliza">Nº Póliza Vendedor *</Label>
          <Input
            id="nro-poliza" value={dp.numero_poliza_vendedor}
            onChange={e => updDP("numero_poliza_vendedor", e.target.value)}
            aria-invalid={numeroPolizaEnUso || campoObligatorio("numero_poliza_vendedor")}
          />
          {verificandoNumero && <p className="text-xs text-muted-foreground">Verificando disponibilidad…</p>}
          {!verificandoNumero && numeroPolizaEnUso && (
            <p className="text-xs text-destructive">Este número de póliza ya está en uso.</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="asesor">Asesor</Label>
          <Input id="asesor" value={dp.asesor} onChange={e => updDP("asesor", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fecha-solicitud">Fecha de solicitud</Label>
          <Input id="fecha-solicitud" type="date" value={dp.fecha_solicitud}
            onChange={e => setFechaSolicitud(e.target.value)} />
          <p className="text-[11px] text-muted-foreground">
            Del 1 al 13 la cobertura arranca el mismo mes; del 14 en adelante, el mes siguiente.
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor="mes-ingreso">Mes de vigencia *</Label>
            {vigenciaEditadaManualmente && (
              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]"
                onClick={resetearVigencia}>
                <RotateCcw className="size-3 mr-1" />Recalcular
              </Button>
            )}
          </div>
          <Input id="mes-ingreso" type="month" value={dp.mes_ingreso}
            onChange={e => { setVigenciaEditadaManualmente(true); updDP("mes_ingreso", e.target.value) }} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="prox-periodo">Próximo período a abonar *</Label>
          <Input id="prox-periodo" type="month" value={dp.proximo_periodo_abonar}
            onChange={e => updDP("proximo_periodo_abonar", e.target.value)}
            aria-invalid={campoObligatorio("proximo_periodo_abonar")} />
        </div>
        <div className="space-y-1">
          <Label>Tipo de afiliación</Label>
          <Input value={dp.tipo_afiliacion || "Sin datos"} readOnly className="bg-muted" />
        </div>
      </div>

      <Separator />
      <p className="text-sm font-semibold">Datos del titular</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          ["nombre", "Nombre *", "text"], ["apellido", "Apellido *", "text"],
          ["dni", "DNI *", "text"], ["cuil", "CUIL *", "text"],
          ["fecha_nacimiento", "Fecha de nacimiento *", "date"],
        ] as const).map(([campo, label, type]) => (
          <div key={campo} className="space-y-1">
            <Label htmlFor={`dp-${campo}`}>{label}</Label>
            <Input id={`dp-${campo}`} type={type} value={dp[campo]}
              onChange={e => updDP(campo, e.target.value)}
              aria-invalid={campoObligatorio(campo)}
              placeholder={campo === "cuil" ? "20-12345678-9" : undefined} />
          </div>
        ))}
        <div className="space-y-1">
          <Label htmlFor="dp-sexo">Sexo *</Label>
          <Select value={dp.sexo} onValueChange={v => updDP("sexo", v)}>
            <SelectTrigger id="dp-sexo" aria-invalid={campoObligatorio("sexo")}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent><SelectGroup>{SEXOS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="dp-estado-civil">Estado civil *</Label>
          <Select value={dp.estado_civil} onValueChange={v => updDP("estado_civil", v)}>
            <SelectTrigger id="dp-estado-civil" aria-invalid={campoObligatorio("estado_civil")}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent><SelectGroup>{ESTADOS_CIVILES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="dp-nacionalidad">Nacionalidad *</Label>
          <Select value={dp.nacionalidad} onValueChange={v => updDP("nacionalidad", v)}>
            <SelectTrigger id="dp-nacionalidad" aria-invalid={campoObligatorio("nacionalidad")}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent><SelectGroup>{NACIONALIDADES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="dp-iva">Condición IVA *</Label>
          <Select value={dp.condicion_iva} onValueChange={v => updDP("condicion_iva", v)}>
            <SelectTrigger id="dp-iva" aria-invalid={campoObligatorio("condicion_iva")}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent><SelectGroup>{CONDICIONES_IVA.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="dp-domicilio">Tipo de domicilio *</Label>
          <Select value={dp.tipo_domicilio} onValueChange={v => updDP("tipo_domicilio", v)}>
            <SelectTrigger id="dp-domicilio" aria-invalid={campoObligatorio("tipo_domicilio")}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent><SelectGroup>{TIPOS_DOMICILIO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="dp-direccion">Dirección *</Label>
          <Input id="dp-direccion" value={dp.direccion} onChange={e => updDP("direccion", e.target.value)}
            aria-invalid={campoObligatorio("direccion")} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dp-numero">Número *</Label>
          <Input id="dp-numero" value={dp.numero} onChange={e => updDP("numero", e.target.value)}
            aria-invalid={campoObligatorio("numero")} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dp-piso">Piso</Label>
          <Input id="dp-piso" value={dp.piso} onChange={e => updDP("piso", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dp-dpto">Dpto</Label>
          <Input id="dp-dpto" value={dp.dpto} onChange={e => updDP("dpto", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dp-cp">Cód. postal *</Label>
          <Input id="dp-cp" value={dp.cod_postal} onChange={e => updDP("cod_postal", e.target.value)}
            aria-invalid={campoObligatorio("cod_postal")} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="dp-localidad">Localidad *</Label>
        <Select value={dp.localidad} onValueChange={v => updDP("localidad", v)}>
          <SelectTrigger id="dp-localidad" aria-invalid={campoObligatorio("localidad")}>
            <SelectValue placeholder="Seleccionar localidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>{localidades.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="dp-email">Email</Label>
          <Input id="dp-email" type="email" value={dp.email} onChange={e => updDP("email", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dp-telefono">Teléfono</Label>
          <Input id="dp-telefono" value={dp.telefono} onChange={e => updDP("telefono", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dp-celular">Celular</Label>
          <Input id="dp-celular" value={dp.celular} onChange={e => updDP("celular", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dp-pct">% Promoción</Label>
          <Input id="dp-pct" type="number" value={dp.porcentaje_promocion}
            onChange={e => updDP("porcentaje_promocion", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dp-obra-social">Obra social</Label>
          <Select value={dp.obra_social} onValueChange={v => updDP("obra_social", v)}>
            <SelectTrigger id="dp-obra-social"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent><SelectGroup>
              {["Ninguna", "OSDE", "Swiss Medical", "Galeno", "Medicus", "IOMA", "OSECAC", "Otra"].map(o => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectGroup></SelectContent>
          </Select>
        </div>
        {dp.obra_social === "Otra" && (
          <div className="space-y-1">
            <Label htmlFor="dp-obra-social-otra">¿Cuál? *</Label>
            <Input id="dp-obra-social-otra" value={dp.obra_social_otra}
              onChange={e => updDP("obra_social_otra", e.target.value)} />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="dp-forma-pago">Forma de pago *</Label>
        <Select value={dp.forma_pago} onValueChange={v => updDP("forma_pago", v)}>
          <SelectTrigger id="dp-forma-pago" aria-invalid={campoObligatorio("forma_pago")}>
            <SelectValue placeholder="Seleccionar forma de pago" />
          </SelectTrigger>
          <SelectContent><SelectGroup>{FORMAS_PAGO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectGroup></SelectContent>
        </Select>
      </div>

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
              <div key={campo} className="space-y-1">
                <Label htmlFor={`emp-${campo}`}>{label}</Label>
                <Input id={`emp-${campo}`} value={dp[campo]} onChange={e => updDP(campo, e.target.value)} />
              </div>
            ))}
          </div>
        </>
      )}

      {faltantesDatosPersonales.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Faltan {faltantesDatosPersonales.length} campo(s) obligatorio(s) para continuar.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )

  // ─── PASO 2: Declaración jurada resumida ──────────────────────────────────
  const renderPaso2 = () => (
    <div className="space-y-4">
      {PREGUNTAS_DJ.map((pregunta, idx) => {
        const actual = dj.preguntas[idx]
        const labelId = `dj-${idx}-label`
        return (
          <div key={idx} className="rounded-lg border p-3 space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <p id={labelId} className="text-sm flex-1">{pregunta}</p>
              <ToggleGroup
                type="single" variant="outline" size="sm" spacing={1}
                aria-labelledby={labelId}
                value={actual?.respuesta ?? "no"}
                onValueChange={v => {
                  if (!v) return
                  updDJ("preguntas", dj.preguntas.map((p, i) =>
                    i === idx ? { ...p, respuesta: v as "si" | "no" } : p))
                }}
                className="shrink-0"
              >
                <ToggleGroupItem value="si" aria-label="Sí">Sí</ToggleGroupItem>
                <ToggleGroupItem value="no" aria-label="No">No</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {actual?.respuesta === "si" && idx < PREGUNTAS_DJ.length - 1 && (
              <div className="space-y-1">
                <Label htmlFor={`dj-${idx}-detalle`} className="text-xs text-muted-foreground">Detalle</Label>
                <Textarea id={`dj-${idx}-detalle`} rows={2} value={actual.detalle}
                  onChange={e => updDJ("preguntas", dj.preguntas.map((p, i) =>
                    i === idx ? { ...p, detalle: e.target.value } : p))} />
              </div>
            )}

            {/* La última pregunta despliega el listado de patologías */}
            {idx === PREGUNTAS_DJ.length - 1 && actual?.respuesta === "si" && (
              <fieldset className="space-y-2">
                <legend className="text-xs text-muted-foreground mb-1">Marcá las que correspondan</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ENFERMEDADES_PATOLOGIAS.map(enf => {
                    const id = `enf-${enf.replace(/\W+/g, "-")}`
                    return (
                      <div key={enf} className="flex items-start gap-2">
                        <Checkbox
                          id={id}
                          checked={dj.enfermedades_seleccionadas.includes(enf)}
                          onCheckedChange={checked => updDJ("enfermedades_seleccionadas",
                            checked
                              ? [...dj.enfermedades_seleccionadas, enf]
                              : dj.enfermedades_seleccionadas.filter(e => e !== enf))}
                          className="mt-0.5"
                        />
                        <Label htmlFor={id} className="text-sm font-normal leading-snug">{enf}</Label>
                      </div>
                    )
                  })}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dj-detalle-enf" className="text-xs text-muted-foreground">Detalle</Label>
                  <Textarea id="dj-detalle-enf" rows={2} value={dj.detalle_enfermedades}
                    onChange={e => updDJ("detalle_enfermedades", e.target.value)} />
                </div>
              </fieldset>
            )}
          </div>
        )
      })}
    </div>
  )

  // ─── PASO 3: Integrantes y documentos ─────────────────────────────────────
  const renderPaso3 = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Titular</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="titular-peso">Peso (kg) *</Label>
              <Input id="titular-peso" type="number" value={dj.datos_fisicos.titular_peso}
                aria-invalid={!dj.datos_fisicos.titular_peso}
                onChange={e => updDJ("datos_fisicos", { ...dj.datos_fisicos, titular_peso: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="titular-altura">Altura (cm) *</Label>
              <Input id="titular-altura" type="number" value={dj.datos_fisicos.titular_altura}
                aria-invalid={!dj.datos_fisicos.titular_altura}
                onChange={e => updDJ("datos_fisicos", { ...dj.datos_fisicos, titular_altura: e.target.value })} />
            </div>
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
            {TIPOS_DOCUMENTO.map(t => inputDocumento(t, null, form.documentos_titular[t]))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Integrantes del grupo familiar</p>
        <Button type="button" variant="outline" size="sm" onClick={agregarIntegrante}>
          + Agregar integrante
        </Button>
      </div>

      {form.integrantes.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">Sin integrantes (sólo titular)</p>
      )}

      {form.integrantes.map((integ, idx) => {
        const df = dj.datos_fisicos.integrantes[idx]
        const imc = calcularIMC(df?.peso, df?.altura)
        return (
          <Card key={idx} className="relative">
            <CardHeader>
              <CardTitle className="text-sm">
                Integrante {idx + 1}{integ.nombre ? ` — ${integ.nombre} ${integ.apellido}` : ""}
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
                <div className="space-y-1">
                  <Label htmlFor={`int-${idx}-nombre`}>Nombre *</Label>
                  <Input id={`int-${idx}-nombre`} value={integ.nombre}
                    onChange={e => setIntegrante(idx, { nombre: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`int-${idx}-apellido`}>Apellido *</Label>
                  <Input id={`int-${idx}-apellido`} value={integ.apellido}
                    onChange={e => setIntegrante(idx, { apellido: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`int-${idx}-dni`}>DNI</Label>
                  <Input id={`int-${idx}-dni`} value={integ.dni}
                    onChange={e => setIntegrante(idx, { dni: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`int-${idx}-cuil`}>CUIL</Label>
                  <Input id={`int-${idx}-cuil`} value={integ.cuil}
                    onChange={e => setIntegrante(idx, { cuil: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`int-${idx}-vinculo`}>Vínculo *</Label>
                  <Select value={integ.vinculo} onValueChange={v => setIntegrante(idx, { vinculo: v })}>
                    <SelectTrigger id={`int-${idx}-vinculo`}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup>{VINCULOS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectGroup></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`int-${idx}-fnac`}>Fecha de nacimiento</Label>
                  <Input id={`int-${idx}-fnac`} type="date" value={integ.fecha_nacimiento}
                    onChange={e => setIntegrante(idx, {
                      fecha_nacimiento: e.target.value, edad: calcularEdad(e.target.value),
                    })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`int-${idx}-sexo`}>Sexo</Label>
                  <Select value={integ.sexo} onValueChange={v => setIntegrante(idx, { sexo: v })}>
                    <SelectTrigger id={`int-${idx}-sexo`}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent><SelectGroup>{SEXOS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectGroup></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`int-${idx}-nac`}>Nacionalidad</Label>
                  <Select value={integ.nacionalidad} onValueChange={v => setIntegrante(idx, { nacionalidad: v })}>
                    <SelectTrigger id={`int-${idx}-nac`}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent><SelectGroup>{NACIONALIDADES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectGroup></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`int-${idx}-peso`}>Peso (kg) *</Label>
                  <Input id={`int-${idx}-peso`} type="number" value={df?.peso ?? ""}
                    aria-invalid={!df?.peso}
                    onChange={e => setDatoFisicoIntegrante(idx, "peso", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`int-${idx}-altura`}>Altura (cm) *</Label>
                  <Input id={`int-${idx}-altura`} type="number" value={df?.altura ?? ""}
                    aria-invalid={!df?.altura}
                    onChange={e => setDatoFisicoIntegrante(idx, "altura", e.target.value)} />
                </div>
              </div>
              {imc !== null && (
                <p className="text-xs text-muted-foreground">
                  IMC: <strong>{imc}</strong>
                  {imc > 30 && <Badge variant="destructive" className="ml-2 text-[10px]">Requiere auditoría médica</Badge>}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-3">
                {TIPOS_DOCUMENTO.map(t => inputDocumento(t, idx, integ.documentos[t]))}
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
        {form.referencias.length < 3 && (
          <Button type="button" variant="outline" size="sm"
            onClick={() => setForm(p => ({ ...p, referencias: [...p.referencias, { nombre: "", relacion: "", telefono: "" }] }))}>
            + Agregar
          </Button>
        )}
      </div>
      {form.referencias.map((ref, idx) => (
        <div key={idx} className="relative space-y-3 rounded-lg border p-3">
          {idx > 0 && (
            <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 size-7"
              aria-label={`Quitar referencia ${idx + 1}`}
              onClick={() => setForm(p => ({ ...p, referencias: p.referencias.filter((_, i) => i !== idx) }))}>
              <X className="size-4" />
            </Button>
          )}
          <p className="text-sm font-medium text-muted-foreground">Referencia {idx + 1}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor={`ref-${idx}-nombre`}>Nombre *</Label>
              <Input id={`ref-${idx}-nombre`} value={ref.nombre}
                onChange={e => setForm(p => ({ ...p, referencias: p.referencias.map((r, i) => i === idx ? { ...r, nombre: e.target.value } : r) }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`ref-${idx}-relacion`}>Relación *</Label>
              <Select value={ref.relacion}
                onValueChange={v => setForm(p => ({ ...p, referencias: p.referencias.map((r, i) => i === idx ? { ...r, relacion: v } : r) }))}>
                <SelectTrigger id={`ref-${idx}-relacion`}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent><SelectGroup>{RELACIONES_REFERENCIA.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`ref-${idx}-tel`}>Teléfono *</Label>
              <Input id={`ref-${idx}-tel`} value={ref.telefono}
                onChange={e => setForm(p => ({ ...p, referencias: p.referencias.map((r, i) => i === idx ? { ...r, telefono: e.target.value } : r) }))} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  // ─── PASO 5: Salud y términos ─────────────────────────────────────────────
  const renderPaso5 = () => (
    <PasoSaludTerminos
      titular={{ nombre: dp.nombre, apellido: dp.apellido }}
      integrantes={form.integrantes.map(i => ({ nombre: i.nombre, apellido: i.apellido, vinculo: i.vinculo }))}
      value={form.saludTerminos}
      onChange={next => setForm(p => ({ ...p, saludTerminos: next }))}
      aceptaTerminos={dj.acepta_terminos}
      onAceptaTerminosChange={v => updDJ("acepta_terminos", v)}
    />
  )

  // ─── PASO 6: Resumen ──────────────────────────────────────────────────────
  const auditoriaPrevista = requiereAuditoriaMedica({
    datosFisicos: dj.datos_fisicos,
    preguntasDJ: dj.preguntas,
    enfermedadesSeleccionadas: dj.enfermedades_seleccionadas,
    respuestasSalud: form.saludTerminos.respuestas,
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
                  onClick={() => enviarPoliza("email", polizaGenerada.id as number)}>
                  <Mail className="size-4 mr-2" />Enviar por email
                </Button>
                <Button variant="outline" disabled={entregando === "whatsapp"}
                  onClick={() => enviarPoliza("whatsapp", polizaGenerada.id as number)}>
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

          {form.integrantes.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Integrantes ({form.integrantes.length})</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {form.integrantes.map((i, idx) => (
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
      case 2: return renderPaso2()
      case 3: return renderPaso3()
      case 4: return renderPaso4()
      case 5: return renderPaso5()
      case 6: return renderPaso6()
      default: return null
    }
  }

  return (
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

        <div className="py-2">{renderPasoActual()}</div>

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
  )
}

export default PolizaForm
