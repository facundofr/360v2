import { z } from "zod"

// ─────────────────────────────────────────────────────────────────────────────
// Schemas de zod para los modales de alta/edición de admin. Un named export
// por entidad — agregar acá el schema de cada modal migrado a la primitiva
// `form` (react-hook-form + zod), no crearlos sueltos dentro de cada componente.
// ─────────────────────────────────────────────────────────────────────────────

// Nota de convención: los campos numéricos se guardan como STRING en el
// schema (igual que el valor crudo de un <Input type="number">) y se
// validan con `.refine()`. Evita el choque de tipos input/output de
// `z.coerce.number()` con el genérico de `useForm<T>` — la conversión a
// número se hace recién al armar el payload que va al backend.
export const promocionSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  descripcion: z.string().trim().min(1, "La descripción es obligatoria."),
  descuento_porcentaje: z.string()
    .min(1, "El descuento es obligatorio.")
    .refine(v => { const n = Number(v); return !isNaN(n) && n >= 0 && n <= 100 }, "El descuento debe estar entre 0% y 100%."),
  activa: z.boolean(),
})
export type PromocionValues = z.infer<typeof promocionSchema>

// Modal "Crear/Editar usuario" de UsuariosAdmin. La contraseña sólo es
// obligatoria al crear un usuario nuevo (no al editar uno existente) — ese
// chequeo cruzado depende del modo del modal, por eso viaja como campo
// `esNuevo` dentro del propio schema (se completa al hacer `form.reset(...)`
// y se descarta al armar el payload, igual que `descuento_porcentaje` arriba).
export const usuarioSchema = z
  .object({
    first_name: z.string().min(1, "El nombre es obligatorio."),
    last_name: z.string().min(1, "El apellido es obligatorio."),
    email: z.string().min(1, "El email es obligatorio."),
    phone_number: z.string(),
    role: z.string(),
    password: z.string(),
    esNuevo: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.esNuevo && !data.password) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "La contraseña es obligatoria para usuarios nuevos." })
    }
  })
export type UsuarioValues = z.infer<typeof usuarioSchema>

export const categoriaSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  descripcion: z.string(),
  capacidad_maxima: z.string()
    .min(1, "La capacidad máxima es obligatoria.")
    .refine(v => { const n = Number(v); return !isNaN(n) && n >= 1 }, "La capacidad máxima debe ser mayor o igual a 1."),
  prioridad: z.string()
    .min(1, "La prioridad es obligatoria.")
    .refine(v => { const n = Number(v); return !isNaN(n) && n >= 1 && n <= 10 }, "La prioridad debe estar entre 1 y 10."),
  activa: z.boolean(),
})
export type CategoriaValues = z.infer<typeof categoriaSchema>

export const monotributoSchema = z.object({
  letra: z.string().trim().min(1, "La letra es obligatoria."),
  aporte_presuntivo: z.string()
    .min(1, "El aporte presuntivo es obligatorio.")
    .refine(v => { const n = Number(v); return !isNaN(n) && n > 0 }, "El aporte presuntivo debe ser mayor a 0."),
})
export type MonotributoValues = z.infer<typeof monotributoSchema>

export const prestadorSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio."),
  tipo_prestador: z.string(),
  especialidad: z.string(),
  telefono: z.string(),
  email: z.string().refine(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Email inválido."),
  direccion: z.string(),
  localidad: z.string(),
  provincia: z.string(),
  codigo_postal: z.string(),
  matricula: z.string(),
  observaciones: z.string(),
  estado: z.boolean(),
})
export type PrestadorValues = z.infer<typeof prestadorSchema>

export const nuevoPrecioSchema = z.object({
  plan_id: z.string().min(1, "Seleccioná un plan."),
  categoria_id: z.string().min(1, "Seleccioná una categoría."),
  tipo_familia_id: z.string().min(1, "Seleccioná un tipo de familia."),
  precio: z.string()
    .min(1, "El precio es obligatorio.")
    .refine(v => { const n = Number(v); return !isNaN(n) && n > 0 }, "Ingresá un precio mayor a 0."),
  anio: z.string().min(1, "El año es obligatorio."),
})
export type NuevoPrecioValues = z.infer<typeof nuevoPrecioSchema>

// Modal "Editar unidad" del Compensador de leads.
export const unidadCompensadorSchema = z.object({
  webhook_url: z.string().trim().min(1, "La URL del webhook es obligatoria."),
  webhook_header_name: z.string(),
  webhook_header_value: z.string(),
  peso_modo: z.enum(["automatico", "manual"]),
  peso_manual: z.string(),
})
export type UnidadCompensadorValues = z.infer<typeof unidadCompensadorSchema>
