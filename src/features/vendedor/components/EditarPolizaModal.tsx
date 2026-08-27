import { useState, useEffect, startTransition } from "react"
import axios from "axios"
import { toast } from "sonner"
import { ChevronRight, ChevronLeft, Save, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog as DialogPrimitive } from "radix-ui"
import { Dialog, DialogPortal, DialogOverlay, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"
import { DocumentosPolizaPanel } from "@/features/vendedor/components/DocumentosPolizaPanel"

// ─── Opciones ─────────────────────────────────────────────────────────────────
// Vienen del módulo compartido: son datos de negocio que se guardan en la base y
// se imprimen en el PDF, así que el alta y la edición TIENEN que usar el mismo
// juego. Antes este archivo tenía las suyas propias y las formas de pago no
// coincidían con producción, de modo que editar una póliza cargada desde el
// frontend viejo dejaba el campo sin opción equivalente en el desplegable.
import {
  ESTADOS_CIVILES,
  SEXOS,
  NACIONALIDADES,
  CONDICIONES_IVA as CONDICION_IVA,
  TIPOS_DOMICILIO,
  VINCULOS,
  RELACIONES_REFERENCIA as RELACIONES_REF,
  FORMAS_PAGO,
  PREGUNTAS_DJ,
  ENFERMEDADES_PATOLOGIAS as ENFERMEDADES_LIST,
} from "@/features/vendedor/constants/poliza"

const PASOS = ["Datos Personales","Declaración Jurada","Integrantes","Documentos","Referencias","Salud y Términos"]

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface EditarPolizaModalProps {
  polizaId: number | null
  open: boolean
  onClose: () => void
  onActualizada: () => void
  /** Determina la base de API y la forma del payload de guardado — réplica de
   * `EditarPolizaModal.jsx` (v1): vendedor manda `datos_personales` aplanado +
   * `declaracion_jurada`; supervisor/backoffice mandan todo anidado +
   * `declaracion_salud` (`polizasController.js` actualizarPoliza, supervisor). */
  apiContext?: "vendedor" | "supervisor" | "backoffice"
}

type DatosPersonales = Record<string, string>
type DeclaracionJurada = {
  preguntas?: { valor: boolean; detalle?: string }[]
  enfermedades_seleccionadas?: string[]
  datos_fisicos?: { titular_peso?: string; titular_altura?: string }
}
interface Integrante { nombre: string; apellido: string; dni?: string; cuil?: string; vinculo: string; fecha_nacimiento?: string; sexo?: string; nacionalidad?: string; email?: string }
interface Referencia { nombre: string; relacion: string; telefono: string }

interface FormData {
  datos_personales: DatosPersonales
  declaracion_jurada: DeclaracionJurada
  integrantes: Integrante[]
  referencias: Referencia[]
  saludTerminos: { acepta_terminos?: boolean }
}

const emptyForm = (): FormData => ({
  datos_personales: {},
  declaracion_jurada: { preguntas: [], enfermedades_seleccionadas: [], datos_fisicos: {} },
  integrantes: [],
  referencias: [{ nombre:"", relacion:"", telefono:"" }],
  saludTerminos: {},
})

export function EditarPolizaModal({ polizaId, open, onClose, onActualizada, apiContext = "vendedor" }: EditarPolizaModalProps) {
  const [paso, setPaso] = useState(0)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [localidades, setLocalidades] = useState<string[]>([])

  const authHeaders = { Authorization: `Bearer ${getAuthToken()}` }
  const getApiBase = () => {
    if (apiContext === "supervisor") return `${API_URL}/supervisor/polizas`
    if (apiContext === "backoffice") return `${API_URL}/backoffice/polizas`
    return `${API_URL}/polizas/vendedor`
  }

  // Cargar póliza
  useEffect(() => {
    if (!open || !polizaId) return
    startTransition(() => {
      setPaso(0)
      setLoading(true)
    })
    // Cargar localidades en paralelo
    axios.get(`${API_URL}/localidades/buenos-aires`)
      .then(r => setLocalidades(r.data?.map((l: { nombre?: string } | string) => typeof l === "string" ? l : (l?.nombre ?? "")) ?? []))
      .catch(() => {})

    axios
      .get(`${getApiBase()}/${polizaId}/editar`, { headers: authHeaders })
      .then(r => {
        if (r.data?.success && r.data?.data) {
          const d = r.data.data
          const parse = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v ?? {})
          setForm({
            datos_personales: parse(d.datos_personales) as DatosPersonales,
            declaracion_jurada: parse(d.declaracion_salud) as DeclaracionJurada,
            integrantes: (parse(d.integrantes) as Integrante[]) || [],
            referencias: (parse(d.referencias) as Referencia[]) || [{ nombre:"", relacion:"", telefono:"" }],
            saludTerminos: parse(d.datos_comerciales) as Record<string, boolean>,
          })
        }
      })
      .catch(e => toast.error(e.response?.data?.message ?? "Error al cargar la póliza"))
      .finally(() => setLoading(false))
  }, [open, polizaId])

  const dp = form.datos_personales
  const dj = form.declaracion_jurada
  const updDp = (field: string, value: string) =>
    setForm(prev => ({ ...prev, datos_personales: { ...prev.datos_personales, [field]: value } }))

  // ─── Paso 0: Datos Personales ────────────────────────────────────────────────
  const renderPaso0 = () => (
    <div className="space-y-5">

      {/* Número de póliza oficial: el campo que se imprime en el PDF —
          destacado igual que en el alta (`PasoDatosPersonales.jsx:427-434`). */}
      <div className="space-y-1">
        <Label className="font-semibold">Número de Póliza Oficial</Label>
        <Input
          className="font-semibold text-base"
          value={dp.numero_poliza_vendedor ?? ""}
          onChange={e => updDp("numero_poliza_vendedor", e.target.value)}
          placeholder="Ej: POL-2024-001234"
        />
        <p className="text-xs text-muted-foreground">Aparece en los documentos oficiales y el PDF. Asegurate de que sea único.</p>
      </div>

      {/* Identidad */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">Identidad</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Nombre</Label><Input value={dp.nombre??""} onChange={e => updDp("nombre",e.target.value)} /></div>
          <div className="space-y-1"><Label>Apellido</Label><Input value={dp.apellido??""} onChange={e => updDp("apellido",e.target.value)} /></div>
          <div className="space-y-1"><Label>DNI</Label><Input value={dp.dni??""} onChange={e => updDp("dni",e.target.value)} /></div>
          <div className="space-y-1"><Label>CUIL</Label><Input value={dp.cuil??""} onChange={e => updDp("cuil",e.target.value)} /></div>
          <div className="space-y-1"><Label>Fecha de nacimiento</Label><Input type="date" value={dp.fecha_nacimiento??""} onChange={e => updDp("fecha_nacimiento",e.target.value)} /></div>
          <div className="space-y-1"><Label>Sexo</Label>
            <Select value={dp.sexo??""} onValueChange={v => updDp("sexo",v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{SEXOS.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Nacionalidad</Label>
            <Select value={dp.nacionalidad??""} onValueChange={v => updDp("nacionalidad",v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{NACIONALIDADES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Estado y condición */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">Estado y condición</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Estado Civil</Label>
            <Select value={dp.estado_civil??""} onValueChange={v => updDp("estado_civil",v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{ESTADOS_CIVILES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Condición IVA</Label>
            <Select value={dp.condicion_iva??""} onValueChange={v => updDp("condicion_iva",v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{CONDICION_IVA.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Forma de Pago</Label>
            <Select value={dp.forma_pago??""} onValueChange={v => updDp("forma_pago",v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{FORMAS_PAGO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Domicilio */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">Domicilio</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 space-y-1"><Label>Dirección</Label><Input value={dp.direccion??""} onChange={e => updDp("direccion",e.target.value)} /></div>
          <div className="space-y-1"><Label>Número</Label><Input value={dp.numero??""} onChange={e => updDp("numero",e.target.value)} /></div>
          <div className="space-y-1"><Label>Cód. Postal</Label><Input value={dp.cod_postal??""} onChange={e => updDp("cod_postal",e.target.value)} /></div>
          <div className="sm:col-span-2 space-y-1"><Label>Localidad</Label>
            <Select value={dp.localidad??""} onValueChange={v => updDp("localidad",v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar localidad" /></SelectTrigger>
              <SelectContent>{localidades.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Tipo Domicilio</Label>
            <Select value={dp.tipo_domicilio??""} onValueChange={v => updDp("tipo_domicilio",v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{TIPOS_DOMICILIO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Contacto */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">Contacto</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Email</Label><Input type="email" value={dp.email??""} onChange={e => updDp("email",e.target.value)} /></div>
          <div className="space-y-1"><Label>Celular</Label><Input value={dp.celular??""} onChange={e => updDp("celular",e.target.value)} /></div>
        </div>
      </div>

    </div>
  )

  // ─── Paso 1: Declaración Jurada ──────────────────────────────────────────────
  const updPregunta = (idx: number, field: "valor" | "detalle", value: boolean | string) => {
    const preguntasActuales = dj.preguntas ?? []
    const nuevas = [...preguntasActuales]
    nuevas[idx] = { ...nuevas[idx], [field]: value }
    setForm(prev => ({ ...prev, declaracion_jurada: { ...prev.declaracion_jurada, preguntas: nuevas } }))
  }

  const renderPaso1 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Peso titular (kg)</Label>
          <Input type="number" value={dj.datos_fisicos?.titular_peso??""} onChange={e => setForm(prev => ({ ...prev, declaracion_jurada: { ...prev.declaracion_jurada, datos_fisicos: { ...prev.declaracion_jurada.datos_fisicos, titular_peso: e.target.value } } }))} />
        </div>
        <div className="space-y-1"><Label>Altura titular (cm)</Label>
          <Input type="number" value={dj.datos_fisicos?.titular_altura??""} onChange={e => setForm(prev => ({ ...prev, declaracion_jurada: { ...prev.declaracion_jurada, datos_fisicos: { ...prev.declaracion_jurada.datos_fisicos, titular_altura: e.target.value } } }))} />
        </div>
      </div>
      {PREGUNTAS_DJ.map((pregunta, idx) => (
        <div key={idx} className="rounded-lg border p-3 space-y-2">
          <div className="flex items-start gap-3">
            <div className="flex gap-3 shrink-0">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" name={`q-${idx}`} checked={dj.preguntas?.[idx]?.valor === true} onChange={() => updPregunta(idx, "valor", true)} />Sí
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" name={`q-${idx}`} checked={dj.preguntas?.[idx]?.valor === false} onChange={() => updPregunta(idx, "valor", false)} />No
              </label>
            </div>
            <p className="text-sm">{pregunta}</p>
          </div>
          {dj.preguntas?.[idx]?.valor === true && idx < 5 && (
            <Textarea placeholder="Detallá..." rows={2} value={dj.preguntas?.[idx]?.detalle??""} onChange={e => updPregunta(idx, "detalle", e.target.value)} />
          )}
          {idx === 5 && dj.preguntas?.[idx]?.valor === true && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {ENFERMEDADES_LIST.map(enf => (
                <label key={enf} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={(dj.enfermedades_seleccionadas ?? []).includes(enf)}
                    onCheckedChange={checked => {
                      const arr = checked
                        ? [...(dj.enfermedades_seleccionadas ?? []), enf]
                        : (dj.enfermedades_seleccionadas ?? []).filter(e => e !== enf)
                      setForm(prev => ({ ...prev, declaracion_jurada: { ...prev.declaracion_jurada, enfermedades_seleccionadas: arr } }))
                    }}
                  />
                  {enf}
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )

  // ─── Paso 2: Integrantes ─────────────────────────────────────────────────────
  const renderPaso2 = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="font-semibold text-sm">Integrantes ({form.integrantes.length})</p>
        <Button variant="outline" size="sm" onClick={() => setForm(prev => ({ ...prev, integrantes: [...prev.integrantes, { nombre:"", apellido:"", vinculo:"hijo/a" }] }))}>+ Agregar</Button>
      </div>
      {form.integrantes.map((integ, idx) => (
        <div key={idx} className="rounded-lg border p-3 space-y-3 relative">
          <Button variant="ghost" size="icon" className="absolute top-2 right-2 size-7"
            onClick={() => setForm(prev => ({ ...prev, integrantes: prev.integrantes.filter((_,i) => i !== idx) }))}>
            <X className="size-4" />
          </Button>
          <p className="font-medium text-sm">Integrante {idx + 1}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Nombre</Label>
              <Input value={integ.nombre} onChange={e => setForm(prev => ({ ...prev, integrantes: prev.integrantes.map((it,i) => i === idx ? {...it, nombre: e.target.value} : it) }))} />
            </div>
            <div className="space-y-1"><Label className="text-xs">Apellido</Label>
              <Input value={integ.apellido} onChange={e => setForm(prev => ({ ...prev, integrantes: prev.integrantes.map((it,i) => i === idx ? {...it, apellido: e.target.value} : it) }))} />
            </div>
            <div className="space-y-1"><Label className="text-xs">Vínculo</Label>
              <Select value={integ.vinculo} onValueChange={v => setForm(prev => ({ ...prev, integrantes: prev.integrantes.map((it,i) => i === idx ? {...it, vinculo: v} : it) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VINCULOS.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">F. Nacimiento</Label>
              <Input type="date" value={integ.fecha_nacimiento??""} onChange={e => setForm(prev => ({ ...prev, integrantes: prev.integrantes.map((it,i) => i === idx ? {...it, fecha_nacimiento: e.target.value} : it) }))} />
            </div>
            <div className="space-y-1"><Label className="text-xs">DNI</Label>
              <Input value={integ.dni??""} onChange={e => setForm(prev => ({ ...prev, integrantes: prev.integrantes.map((it,i) => i === idx ? {...it, dni: e.target.value} : it) }))} />
            </div>
            <div className="space-y-1"><Label className="text-xs">CUIL</Label>
              <Input value={integ.cuil??""} onChange={e => setForm(prev => ({ ...prev, integrantes: prev.integrantes.map((it,i) => i === idx ? {...it, cuil: e.target.value} : it) }))} />
            </div>
            <div className="space-y-1"><Label className="text-xs">Sexo</Label>
              <Select value={integ.sexo??""} onValueChange={v => setForm(prev => ({ ...prev, integrantes: prev.integrantes.map((it,i) => i === idx ? {...it, sexo: v} : it) }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{SEXOS.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Nacionalidad</Label>
              <Select value={integ.nacionalidad??""} onValueChange={v => setForm(prev => ({ ...prev, integrantes: prev.integrantes.map((it,i) => i === idx ? {...it, nacionalidad: v} : it) }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{NACIONALIDADES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Email</Label>
              <Input type="email" value={integ.email??""} onChange={e => setForm(prev => ({ ...prev, integrantes: prev.integrantes.map((it,i) => i === idx ? {...it, email: e.target.value} : it) }))} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  // ─── Paso 3: Documentos ──────────────────────────────────────────────────────
  // Producción reutiliza `PasoIntegrantesDocumentos` con `documentosExistentes`
  // (`EditarPolizaModal.jsx:783,792`) para poder ver, reemplazar y eliminar los
  // documentos ya subidos. Acá se usa el panel compartido con esa misma función.
  const renderPasoDocumentos = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Documentos ya cargados en la póliza. Podés previsualizarlos, descargarlos,
        reemplazarlos indicando el motivo o eliminarlos.
      </p>
      <DocumentosPolizaPanel polizaId={polizaId} apiContext={apiContext} permitirEliminar />
    </div>
  )

  // ─── Paso 4: Referencias ─────────────────────────────────────────────────────
  const renderPaso3 = () => (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="font-semibold text-sm">Referencias (1-3)</p>
        {form.referencias.length < 3 && (
          <Button variant="outline" size="sm" onClick={() => setForm(prev => ({ ...prev, referencias: [...prev.referencias, { nombre:"", relacion:"", telefono:"" }] }))}>+ Agregar</Button>
        )}
      </div>
      {form.referencias.map((ref, idx) => (
        <div key={idx} className="rounded-lg border p-3 space-y-3 relative">
          {idx > 0 && <Button variant="ghost" size="icon" className="absolute top-2 right-2 size-7" onClick={() => setForm(prev => ({ ...prev, referencias: prev.referencias.filter((_,i) => i !== idx) }))}><X className="size-4" /></Button>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Nombre</Label><Input value={ref.nombre} onChange={e => setForm(prev => ({ ...prev, referencias: prev.referencias.map((r,i) => i === idx ? {...r, nombre: e.target.value} : r) }))} /></div>
            <div className="space-y-1"><Label>Relación</Label>
              <Select value={ref.relacion} onValueChange={v => setForm(prev => ({ ...prev, referencias: prev.referencias.map((r,i) => i === idx ? {...r, relacion: v} : r) }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{RELACIONES_REF.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Teléfono</Label><Input value={ref.telefono} onChange={e => setForm(prev => ({ ...prev, referencias: prev.referencias.map((r,i) => i === idx ? {...r, telefono: e.target.value} : r) }))} /></div>
          </div>
        </div>
      ))}
    </div>
  )

  // ─── Paso 4: Salud y Términos ────────────────────────────────────────────────
  const renderPaso4 = () => (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground space-y-2">
        <p className="font-semibold text-foreground">Términos y condiciones</p>
        <p>Declaro que la información actualizada es verdadera. Autorizo a COBER a verificar los datos y acepto las condiciones del plan de salud.</p>
      </div>
      <label className="flex items-start gap-3 cursor-pointer">
        <Checkbox
          checked={!!form.saludTerminos.acepta_terminos}
          onCheckedChange={v => setForm(prev => ({ ...prev, saludTerminos: { acepta_terminos: !!v } }))}
        />
        <span className="text-sm">Acepto los términos y condiciones de COBER.</span>
      </label>
    </div>
  )

  const renderPasoActual = () => {
    switch(paso) {
      case 0: return renderPaso0()
      case 1: return renderPaso1()
      case 2: return renderPaso2()
      case 3: return renderPasoDocumentos()
      case 4: return renderPaso3()
      case 5: return renderPaso4()
      default: return null
    }
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      const payload = apiContext === "vendedor"
        ? {
            ...form.datos_personales,
            declaracion_jurada: form.declaracion_jurada,
            integrantes: form.integrantes,
            referencias: form.referencias,
            saludTerminos: form.saludTerminos,
          }
        : {
            datos_personales: form.datos_personales,
            declaracion_salud: form.declaracion_jurada,
            integrantes: form.integrantes,
            referencias: form.referencias,
            datos_comerciales: form.saludTerminos,
          }
      await axios.put(`${getApiBase()}/${polizaId}/actualizar`, payload, { headers: authHeaders })
      toast.success("Póliza actualizada correctamente")
      onActualizada()
      onClose()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err.response?.data?.message ?? "Error al actualizar la póliza")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && !guardando && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className="fixed inset-0 z-50 flex flex-col bg-background outline-none duration-100 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        >
          {/* Botón cerrar */}
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon-sm" className="absolute top-3 right-3 z-10" disabled={guardando}>
              <X className="size-4" />
              <span className="sr-only">Cerrar</span>
            </Button>
          </DialogPrimitive.Close>

          {/* Header fijo */}
          <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
            <DialogTitle className="text-base sm:text-lg">Editar Póliza #{polizaId}</DialogTitle>
          </DialogHeader>

          {/* Barra de progreso fija */}
          <div className="shrink-0 space-y-2 px-6 py-3 border-b bg-muted/30">
            <div className="flex gap-1">
              {PASOS.map((_,i) => (
                <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${i < paso ? "bg-primary" : i === paso ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Paso {paso + 1} de {PASOS.length}</p>
              <p className="text-xs font-semibold text-primary">{PASOS[paso]}</p>
            </div>
          </div>

          {/* Contenido scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0 px-6 py-6">
            {loading ? (
              <div className="space-y-3 max-w-2xl mx-auto">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-10 w-1/2" />
                <p className="text-sm text-center text-muted-foreground">Cargando datos de la póliza...</p>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto">{renderPasoActual()}</div>
            )}
          </div>

          {/* Footer fijo */}
          <div className="shrink-0 flex justify-between px-6 py-4 border-t bg-background">
            <Button variant="outline" onClick={() => setPaso(p => p - 1)} disabled={paso === 0}>
              <ChevronLeft className="size-4 mr-1" />Anterior
            </Button>
            {paso < PASOS.length - 1 ? (
              <Button onClick={() => setPaso(p => p + 1)}>
                Siguiente<ChevronRight className="size-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={guardar} disabled={guardando}>
                <Save className="size-4 mr-1.5" />
                {guardando ? "Guardando..." : "Guardar cambios"}
              </Button>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
