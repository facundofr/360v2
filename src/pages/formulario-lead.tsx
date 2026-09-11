import { useState, useEffect } from "react"
import axios from "axios"
import { toast } from "sonner"
import { Plus, Trash2, Users, Phone, Mail, MapPin, UserPlus, MessageCircle, PhoneCall, CheckCircle2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { API_URL, ENDPOINTS } from "@/lib/config"

/** Número dedicado del validador de WhatsApp (igual que `FormularioLead.jsx`). */
const NUMERO_VALIDADOR_WHATSAPP = "5491137658137"

const CATEGORIAS_MONOTRIBUTO = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "A exento", "B exento"]
const VINCULOS = [
  { value: "pareja/conyuge", label: "Pareja/Cónyuge" },
  { value: "hijo/a", label: "Hijo/a" },
  { value: "familiar a cargo", label: "Familiar a cargo" },
]
const TIPOS_AFILIACION = [
  { id: 1, etiqueta: "Particular/Autónomo", requiere_sueldo: false, requiere_categoria: false },
  { id: 2, etiqueta: "Con recibo de sueldo", requiere_sueldo: true, requiere_categoria: false },
  { id: 3, etiqueta: "Monotributista", requiere_sueldo: false, requiere_categoria: true },
]

interface Familiar {
  vinculo: string
  nombre: string
  edad: string
  tipo_afiliacion_id: string
  sueldo_bruto: string
  categoria_monotributo: string
}

interface FormState {
  nombre: string
  apellido: string
  edad: string
  tipo_afiliacion_id: string
  sueldo_bruto: string
  categoria_monotributo: string
  numero_contacto: string
  correo: string
  localidad: string
  familiares: Familiar[]
}

export default function FormularioLeadPage() {
  const [form, setForm] = useState<FormState>({
    nombre: "",
    apellido: "",
    edad: "",
    tipo_afiliacion_id: "",
    sueldo_bruto: "",
    categoria_monotributo: "",
    numero_contacto: "",
    correo: "",
    localidad: "",
    familiares: [],
  })
  const [familiar, setFamiliar] = useState<Familiar>({
    vinculo: "",
    nombre: "",
    edad: "",
    tipo_afiliacion_id: "",
    sueldo_bruto: "",
    categoria_monotributo: "",
  })
  const [localidades, setLocalidades] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [mostrarFamiliar, setMostrarFamiliar] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [cotizaciones, setCotizaciones] = useState<Record<string, unknown>[]>([])
  const [showPreferencia, setShowPreferencia] = useState(false)
  const [guardandoPreferencia, setGuardandoPreferencia] = useState(false)
  const [prospectoData, setProspectoData] = useState<{
    prospectoId: number | string
    numero_contacto: string
    correo: string
  } | null>(null)

  useEffect(() => {
    axios
      .get(`${API_URL}/localidades/buenos-aires`)
      .then((res) => setLocalidades(res.data.map((l: { nombre: string } | string) => (typeof l === "string" ? l : l.nombre))))
      .catch(() => setLocalidades([]))
  }, [])

  const tipoAfilPrincipal = TIPOS_AFILIACION.find((t) => t.id === Number(form.tipo_afiliacion_id))
  const tipoAfilFamiliar = TIPOS_AFILIACION.find((t) => t.id === Number(familiar.tipo_afiliacion_id))

  const agregarFamiliar = () => {
    if (!familiar.vinculo || !familiar.nombre || !familiar.edad || Number(familiar.edad) <= 0) {
      toast.error("Vínculo, nombre y edad válida son obligatorios.")
      return
    }
    if (familiar.vinculo === "pareja/conyuge" && !familiar.tipo_afiliacion_id) {
      toast.error("El tipo de afiliación es obligatorio para pareja/cónyuge")
      return
    }
    // Regla de negocio real (`formModel.js` validarFamiliar): hijo/a se cubre
    // como tal hasta los 25 años inclusive; más allá va como familiar a cargo.
    if (familiar.vinculo === "hijo/a" && Number(familiar.edad) > 25) {
      toast.error('Un hijo/a puede tener hasta 25 años inclusive. Para mayores, seleccioná "Familiar a cargo".')
      return
    }
    setForm({ ...form, familiares: [...form.familiares, { ...familiar }] })
    setFamiliar({ vinculo: "", nombre: "", edad: "", tipo_afiliacion_id: "", sueldo_bruto: "", categoria_monotributo: "" })
    setMostrarFamiliar(false)
    toast.success("Familiar agregado")
  }

  const eliminarFamiliar = (idx: number) => {
    setForm({ ...form, familiares: form.familiares.filter((_, i) => i !== idx) })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    // El backend exige `correo` y `tipo_afiliacion_id` de forma estricta en
    // `createLead` (`formModel.js:298-320`, con `throw` plano, no en el array
    // de `errores`) — si faltan, el alta siempre devuelve un 500 genérico sin
    // pista de qué corregir. `localidad` también es obligatoria (`formModel.js:113`).
    if (!form.nombre || !form.apellido || !form.edad || !form.numero_contacto || !form.correo || !form.tipo_afiliacion_id || !form.localidad) {
      toast.error("Por favor completa los campos requeridos.")
      return
    }
    setLoading(true)
    try {
      const { data } = await axios.post(`${ENDPOINTS.LEAD}`, form)
      const prospectoId = data?.prospectoId

      // Recuperar las cotizaciones generadas para el lead (igual que prod).
      if (prospectoId) {
        try {
          const cotRes = await axios.get(`${ENDPOINTS.LEAD}/${prospectoId}/cotizaciones`)
          setCotizaciones(cotRes.data?.data ?? cotRes.data ?? [])
        } catch {
          // Sin cotizaciones igual seguimos: el asesor puede cotizar después.
        }

        // Preguntar por qué canal quiere recibir la cotización.
        setProspectoData({
          prospectoId,
          numero_contacto: form.numero_contacto,
          correo: form.correo,
        })
        setShowPreferencia(true)
      } else {
        setEnviado(true)
      }
      toast.success("¡Solicitud enviada! Nos contactaremos pronto.")
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        // 429: el rate-limit de leads (`duplicatePreventionMiddleware.js`) manda
        // el texto en `error`, no en `message`, y no lo lee nadie acá antes.
        if (err.response?.status === 429) {
          toast.error(err.response.data?.error ?? "Demasiadas solicitudes. Intentá nuevamente en unos minutos.")
          return
        }
        // 400: `formModel.js` valida en un array `errores` (formato de teléfono,
        // nombre, localidad, etc.) — mostrar solo `.message` ocultaba el motivo real.
        const errores = err.response?.data?.errores as string[] | undefined
        if (errores?.length) {
          errores.forEach(e => toast.error(e))
          return
        }
        toast.error(err.response?.data?.message ?? "Error al enviar la solicitud. Intenta nuevamente.")
        return
      }
      toast.error("Error al enviar la solicitud. Intenta nuevamente.")
    } finally {
      setLoading(false)
    }
  }

  // ─── Preferencia de entrega de la cotización ──────────────────────────────
  // POST /lead/:id/preferencia-entrega — registra por qué canal quiere que lo
  // contacten. Paridad con `FormularioLead.jsx`.
  const registrarPreferencia = async (canal: "email" | "llamada" | "whatsapp") => {
    if (!prospectoData) return
    setGuardandoPreferencia(true)
    try {
      await axios.post(`${ENDPOINTS.LEAD}/${prospectoData.prospectoId}/preferencia-entrega`, {
        canal,
        numero_contacto: prospectoData.numero_contacto,
        ...(canal === "email" ? { correo: prospectoData.correo } : {}),
      })
      if (canal === "email") toast.success("El vendedor se comunicará contigo por email")
      if (canal === "llamada") toast.success("Un agente se comunicará contigo pronto")
    } catch {
      // En WhatsApp abrimos igual aunque falle el registro (criterio de prod).
      if (canal !== "whatsapp") {
        toast.error("No se pudo registrar la preferencia. Intentá nuevamente.")
        setGuardandoPreferencia(false)
        return
      }
    }

    if (canal === "whatsapp") {
      const mensaje = encodeURIComponent("Hola, quiero recibir mi cotización")
      window.open(`https://wa.me/${NUMERO_VALIDADOR_WHATSAPP}?text=${mensaje}`, "_blank")
    }

    setGuardandoPreferencia(false)
    setShowPreferencia(false)
    setProspectoData(null)
    setEnviado(true)
  }

  // ─── Modal de preferencia de entrega ──────────────────────────────────────
  const modalPreferencia = (
    <Dialog open={showPreferencia} onOpenChange={(o) => { if (!o) { setShowPreferencia(false); setEnviado(true) } }}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>¿Cómo querés recibir tu cotización?</DialogTitle>
          <DialogDescription>
            {cotizaciones.length > 0
              ? `Preparamos ${cotizaciones.length} opción${cotizaciones.length !== 1 ? "es" : ""} para vos. Elegí por dónde te contactamos.`
              : "Elegí por qué canal preferís que te contactemos."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            disabled={guardandoPreferencia}
            onClick={() => registrarPreferencia("whatsapp")}
          >
            <MessageCircle className="size-4 mr-2 text-green-600" />
            <span className="text-left">
              <span className="block font-medium">WhatsApp</span>
              <span className="block text-xs text-muted-foreground">Recibí la cotización al instante</span>
            </span>
          </Button>
          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            disabled={guardandoPreferencia}
            onClick={() => registrarPreferencia("email")}
          >
            <Mail className="size-4 mr-2 text-muted-foreground" />
            <span className="text-left">
              <span className="block font-medium">Email</span>
              <span className="block text-xs text-muted-foreground">{prospectoData?.correo || "A tu correo"}</span>
            </span>
          </Button>
          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            disabled={guardandoPreferencia}
            onClick={() => registrarPreferencia("llamada")}
          >
            <PhoneCall className="size-4 mr-2 text-muted-foreground" />
            <span className="text-left">
              <span className="block font-medium">Llamada</span>
              <span className="block text-xs text-muted-foreground">Un agente te contacta</span>
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )

  if (enviado) {
    return (
      <main className="grid min-h-svh place-items-center px-6 py-10">
        <div className="w-full max-w-[420px] text-center">
          {/* El ícono va dibujado y suelto: la ficha circular de color era
              decoración alrededor de un ícono que ya se veía. */}
          <CheckCircle2 className="mx-auto mb-3 size-8 text-state-ok-text" aria-hidden="true" />
          <h2 className="text-[21px] font-bold tracking-[-0.025em]">¡Solicitud enviada!</h2>
          <p className="mx-auto mt-2 max-w-[46ch] text-[12.5px] text-muted-foreground">
            Recibimos tu información. Un asesor de COBER Salud se va a poner en contacto a la brevedad.
          </p>
          <Badge variant="outline" className="mt-4">
            <Phone aria-hidden="true" /> +1 (616) 207-1267
          </Badge>
        </div>
      </main>
    )
  }

  return (
    /* El degradado azul no era del sistema: esta app es violeta, y el único
       plano de color de la marca es la cabecera del panel. Papel hundido y
       filete alcanzan para separar el formulario del fondo. */
    <div className="min-h-svh bg-paper-sunk px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-7">
          <h1 className="text-[27px] font-extrabold tracking-[-0.03em] text-primary">COBER Salud</h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">Solicitud de cobertura médica</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              Tus datos
            </CardTitle>
            <CardDescription>Completá el formulario y te contactamos para cotizarte</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Datos personales */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    required
                    placeholder="Tu nombre"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="apellido">Apellido *</Label>
                  <Input
                    id="apellido"
                    value={form.apellido}
                    onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                    required
                    placeholder="Tu apellido"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="edad">Edad *</Label>
                  <Input
                    id="edad"
                    type="number"
                    min="0"
                    max="120"
                    value={form.edad}
                    onChange={(e) => setForm({ ...form, edad: e.target.value })}
                    required
                    placeholder="Tu edad"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Tipo de afiliación *</Label>
                  <Select
                    value={form.tipo_afiliacion_id}
                    onValueChange={(v) =>
                      setForm({ ...form, tipo_afiliacion_id: v, sueldo_bruto: "", categoria_monotributo: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_AFILIACION.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.etiqueta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {tipoAfilPrincipal?.requiere_sueldo && (
                <div className="space-y-1">
                  <Label>Sueldo bruto</Label>
                  <Input
                    type="number"
                    value={form.sueldo_bruto}
                    onChange={(e) => setForm({ ...form, sueldo_bruto: e.target.value })}
                    placeholder="Ingresa tu sueldo bruto"
                  />
                </div>
              )}

              {tipoAfilPrincipal?.requiere_categoria && (
                <div className="space-y-1">
                  <Label>Categoría monotributo</Label>
                  <Select
                    value={form.categoria_monotributo}
                    onValueChange={(v) => setForm({ ...form, categoria_monotributo: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_MONOTRIBUTO.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Contacto */}
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="contacto" className="flex items-center gap-1">
                    <Phone className="size-3" /> Teléfono *
                  </Label>
                  <Input
                    id="contacto"
                    type="tel"
                    value={form.numero_contacto}
                    onChange={(e) => setForm({ ...form, numero_contacto: e.target.value })}
                    required
                    placeholder="+54 11 1234-5678"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="correo" className="flex items-center gap-1">
                    <Mail className="size-3" /> Email *
                  </Label>
                  <Input
                    id="correo"
                    type="email"
                    value={form.correo}
                    onChange={(e) => setForm({ ...form, correo: e.target.value })}
                    required
                    placeholder="tu@email.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="flex items-center gap-1">
                  <MapPin className="size-3" /> Localidad *
                </Label>
                <Select
                  value={form.localidad}
                  onValueChange={(v) => setForm({ ...form, localidad: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tu localidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {localidades.map((loc) => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Familiares */}
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-medium text-sm">Integrantes del grupo familiar</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMostrarFamiliar(true)}
                  >
                    <UserPlus className="size-4 mr-1" /> Agregar familiar
                  </Button>
                </div>

                {form.familiares.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {form.familiares.map((fam, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div className="text-sm">
                          <span className="font-medium">{fam.nombre}</span>{" "}
                          <Badge variant="outline" className="text-xs">{fam.vinculo}</Badge>{" "}
                          <span className="text-muted-foreground">{fam.edad} años</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive"
                          onClick={() => eliminarFamiliar(idx)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {mostrarFamiliar && (
                  <Card className="border-dashed">
                    <CardContent className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Vínculo *</Label>
                          <Select
                            value={familiar.vinculo}
                            onValueChange={(v) => setFamiliar({ ...familiar, vinculo: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                              {VINCULOS.map((v) => (
                                <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Nombre *</Label>
                          <Input
                            value={familiar.nombre}
                            onChange={(e) => setFamiliar({ ...familiar, nombre: e.target.value })}
                            placeholder="Nombre"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Edad *</Label>
                          <Input
                            type="number"
                            value={familiar.edad}
                            onChange={(e) => setFamiliar({ ...familiar, edad: e.target.value })}
                            placeholder="Edad"
                          />
                        </div>
                        {/* Obligatorio solo para pareja/cónyuge; opcional (y soportado
                            igual por el backend) para hijo/a y familiar a cargo con
                            recibo/monotributo propio (`formModel.js` validarFamiliar). */}
                        {["pareja/conyuge", "hijo/a", "familiar a cargo"].includes(familiar.vinculo) && (
                          <div className="space-y-1">
                            <Label>Tipo de afiliación{familiar.vinculo === "pareja/conyuge" ? " *" : " (opcional)"}</Label>
                            <Select
                              value={familiar.tipo_afiliacion_id}
                              onValueChange={(v) =>
                                setFamiliar({ ...familiar, tipo_afiliacion_id: v, sueldo_bruto: "", categoria_monotributo: "" })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                {TIPOS_AFILIACION.map((t) => (
                                  <SelectItem key={t.id} value={String(t.id)}>{t.etiqueta}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      {tipoAfilFamiliar?.requiere_sueldo && (
                        <div className="space-y-1">
                          <Label>Sueldo bruto</Label>
                          <Input
                            type="number"
                            value={familiar.sueldo_bruto}
                            onChange={(e) => setFamiliar({ ...familiar, sueldo_bruto: e.target.value })}
                            placeholder="Sueldo bruto"
                          />
                        </div>
                      )}
                      {tipoAfilFamiliar?.requiere_categoria && (
                        <div className="space-y-1">
                          <Label>Categoría monotributo</Label>
                          <Select
                            value={familiar.categoria_monotributo}
                            onValueChange={(v) => setFamiliar({ ...familiar, categoria_monotributo: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Categoría" />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIAS_MONOTRIBUTO.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button type="button" size="sm" onClick={agregarFamiliar}>
                          <Plus className="size-4 mr-1" /> Agregar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setMostrarFamiliar(false)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? "Enviando..." : "Solicitar cotización"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      {modalPreferencia}
    </div>
  )
}
