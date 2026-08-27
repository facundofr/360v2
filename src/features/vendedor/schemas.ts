import { z } from "zod"
import { CAMPOS_OBLIGATORIOS_DATOS_PERSONALES } from "@/features/vendedor/constants/poliza"

// ─────────────────────────────────────────────────────────────────────────────
// Validación declarativa de `PolizaForm`. Sólo cubre los campos de texto/select
// (los documentos son `File` y viven fuera de este schema — se validan a mano
// en `puedeAvanzar`, igual que en producción, porque un input de archivo nunca
// fue un campo "controlado" ni en la versión vieja del formulario).
//
// El chequeo cruzado edad↔fecha de nacimiento NO está acá: se mantiene como el
// `useMemo` original (ver `PolizaForm.tsx`) para no reimplementar ese cálculo
// de fechas dos veces y arriesgar que diverjan.
// ─────────────────────────────────────────────────────────────────────────────

export const datosPersonalesSchema = z
  .object({
    numero_poliza_vendedor: z.string(),
    asesor: z.string(),
    fecha_solicitud: z.string(),
    mes_ingreso: z.string(),
    proximo_periodo_abonar: z.string(),
    nombre: z.string(),
    apellido: z.string(),
    dni: z.string(),
    cuil: z.string(),
    fecha_nacimiento: z.string(),
    edad: z.string(),
    sexo: z.string(),
    estado_civil: z.string(),
    nacionalidad: z.string(),
    condicion_iva: z.string(),
    tipo_domicilio: z.string(),
    direccion: z.string(),
    numero: z.string(),
    piso: z.string(),
    dpto: z.string(),
    cod_postal: z.string(),
    localidad: z.string(),
    email: z.string(),
    telefono: z.string(),
    celular: z.string(),
    tipo_afiliacion: z.string(),
    obra_social: z.string(),
    obra_social_otra: z.string(),
    porcentaje_promocion: z.string(),
    forma_pago: z.string(),
    empresa_razon_social: z.string(),
    empresa_cuit: z.string(),
    empresa_direccion: z.string(),
    empresa_codigo_postal: z.string(),
    empresa_localidad: z.string(),
    empresa_telefono: z.string(),
  })
  .superRefine((dp, ctx) => {
    // Mismo set que `CAMPOS_OBLIGATORIOS_DATOS_PERSONALES` — una sola fuente de
    // verdad para qué es obligatorio en el paso 1.
    for (const campo of CAMPOS_OBLIGATORIOS_DATOS_PERSONALES) {
      if (!String(dp[campo] ?? "").trim()) {
        ctx.addIssue({ code: "custom", path: [campo], message: "Este campo es obligatorio." })
      }
    }
    if (dp.obra_social === "Otra" && !dp.obra_social_otra.trim()) {
      ctx.addIssue({ code: "custom", path: ["obra_social_otra"], message: "Indicá cuál es la obra social." })
    }
  })

export type DatosPersonalesValues = z.infer<typeof datosPersonalesSchema>

export const integranteFisicoSchema = z.object({
  peso: z.string().min(1, "El peso es obligatorio."),
  altura: z.string().min(1, "La altura es obligatoria."),
})

export const referenciaSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  relacion: z.string().trim().min(1, "La relación es obligatoria."),
  telefono: z.string().trim().min(1, "El teléfono es obligatorio."),
})

export const referenciasSchema = z.array(referenciaSchema).min(1, "Agregá al menos una referencia.")
