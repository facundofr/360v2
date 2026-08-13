// ─────────────────────────────────────────────────────────────────────────────
// Constantes de negocio del formulario de póliza.
//
// ⚠️ ESTO NO ES CONFIGURACIÓN DE UI: son DATOS. Cada uno de estos strings se
// guarda en la base y se imprime en el PDF de afiliación que el cliente firma
// digitalmente vía VaFirma. Si divergen de producción, dos pólizas del mismo
// sistema quedan con declaraciones juradas distintas según desde qué frontend
// se cargaron.
//
// Fuente de verdad (copiar de acá, nunca inventar):
//   frontend/src/components/features/vendedor/PolizaForm.jsx                  (líneas 19-88)
//   frontend/src/components/features/vendedor/poliza-form/PasoSaludTerminos.jsx
//
// PREGUNTAS_SALUD y COBERTURAS_MEDICAS se extrajeron programáticamente del
// fuente de producción, no se transcribieron a mano.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Declaración jurada (resumen) ────────────────────────────────────────────
// OJO: la segunda pregunta dice "¿Algún integrante encuentra..." — le falta el
// "se". Es un error de tipeo que está en producción y se replica a propósito:
// el texto de la pregunta se guarda junto a cada respuesta, así que "corregirlo"
// sólo en v2 haría que los registros nuevos no matcheen con los históricos.
// Si se quiere arreglar, hay que hacerlo en los dos frontends a la vez.
export const PREGUNTAS_DJ = [
  "¿Algún integrante del grupo toma Medicación?",
  "¿Algún integrante encuentra actualmente bajo Tratamiento médico?",
  "¿Algún integrante del grupo tiene diagnosticada alguna Enfermedad en los últimos 12 meses?",
  "¿Algún integrante del grupo tiene indicado realizarse estudios, análisis y/o prácticas médicas?",
  "¿Algún integrante del grupo ha sido internado/a?",
  "¿Algún integrante del grupo posee alguna de las siguientes enfermedades, patologías y/o diagnósticos?",
] as const

export const ENFERMEDADES_PATOLOGIAS = [
  "Antecedentes Neurológicos / Psiquiátricos",
  "Alteraciones Visuales",
  "Alteraciones de nariz, garganta u oído",
  "Diabetes / Obesidad",
  "Adicciones a drogas o alcohol",
  "Alteraciones de la sangre",
  "Alteraciones Pulmonares",
  "Nódulos, Quistes o Tumores",
  "Alteraciones renales/vejiga/próstata",
  "Alteraciones ginecológicas y/u obstétricas",
  "Embarazo",
  "Afecciones musculares y/o de huesos",
  "Enfermedades congénitas o hereditarias",
] as const

// ─── Desplegables de datos personales ────────────────────────────────────────
export const ESTADOS_CIVILES = [
  "Soltero/a",
  "Casado/a",
  "Divorciado/a",
  "Viudo/a",
  "Concubinato",
  "Separado/a",
] as const

export const CONDICIONES_IVA = [
  "Responsable Inscripto",
  "Responsable No Inscripto",
  "IVA Exento",
  "Consumidor Final",
  "Responsable Monotributo",
] as const

export const TIPOS_DOMICILIO = ["Particular", "Comercial", "Legal"] as const

export const FORMAS_PAGO = [
  "Débito automático de tarjeta de crédito | Mercado Pago",
  "Débito automático de tarjeta de crédito",
  "Débito automático de cuenta (CBU)",
  "Transferencia",
  "Efectivo",
] as const

export const NACIONALIDADES = [
  "Argentina",
  "Boliviana",
  "Brasileña",
  "Chilena",
  "Colombiana",
  "Ecuatoriana",
  "Paraguaya",
  "Peruana",
  "Uruguaya",
  "Venezolana",
  "Otra",
] as const

export const SEXOS = ["Masculino", "Femenino"] as const

export const VINCULOS = ["pareja/conyuge", "hijo/a", "familiar a cargo"] as const

export const RELACIONES_REFERENCIA = [
  "Amigo/a",
  "Familiar",
  "Compañero de trabajo",
  "Vecino/a",
  "Otro",
] as const

// ─── Tipos de afiliación ─────────────────────────────────────────────────────
export const TIPO_AFILIACION: Record<number, string> = {
  1: "Particular/autónomo",
  2: "Con recibo de sueldo",
  3: "Monotributista",
}

/** El bloque de datos de la empresa sólo aplica a "Con recibo de sueldo". */
export const TIPO_AFILIACION_CON_RECIBO = 2

// ─── Pasos del alta ──────────────────────────────────────────────────────────
// Mismos 5 pasos que producción (`etapas` en PolizaForm.jsx). No son 6: el
// componente `PasoDeclaracionJurada` existe pero NO se usa en el alta, sólo en
// la edición de una póliza ya creada.
export const ETAPAS = [
  "Datos Personales",
  "Integrantes y Documentos",
  "Referencias",
  "Salud y Términos",
  "Resumen Final",
] as const

// ─── Cuestionario de salud por integrante ────────────────────────────────────
export interface PreguntaSalud {
  id: string
  categoria: CategoriaSalud
  pregunta: string
  detalle: string
}

export type CategoriaSalud =
  | "internaciones" | "general" | "estudios" | "mental" | "diabetes"
  | "sentidos" | "alergias" | "cardiacas" | "embarazo" | "fisico"
  | "neurologicas" | "respiratorias" | "otras" | "habitos"

/** Títulos de cada categoría, igual que `categorias` en PasoSaludTerminos.jsx. */
export const CATEGORIAS_SALUD: Record<CategoriaSalud, string> = {
  internaciones: "Internaciones y Cirugías",
  general:       "Enfermedades Generales",
  estudios:      "Estudios y Tratamientos",
  mental:        "Salud Mental",
  diabetes:      "Diabetes",
  sentidos:      "Vista y Audición",
  alergias:      "Alergias",
  cardiacas:     "Enfermedades Cardíacas",
  embarazo:      "Embarazo y Ginecología",
  fisico:        "Problemas Físicos",
  neurologicas:  "Enfermedades Neurológicas",
  respiratorias: "Enfermedades Respiratorias",
  otras:         "Otras Enfermedades",
  habitos:       "Hábitos y Estilo de Vida",
}

/** Orden de presentación de las categorías (el de producción). */
export const ORDEN_CATEGORIAS: CategoriaSalud[] = [
  "internaciones", "general", "estudios", "mental", "diabetes", "sentidos",
  "alergias", "cardiacas", "embarazo", "fisico", "neurologicas",
  "respiratorias", "otras", "habitos",
]

// 49 preguntas — extraídas de PasoSaludTerminos.jsx
export const PREGUNTAS_SALUD: PreguntaSalud[] = [
  { id: "internacion", categoria: "internaciones", pregunta: "¿Tuviste que ser internado en alguna oportunidad?", detalle: "Aclará motivos, mes y año" },
  { id: "internacion_colegiales", categoria: "internaciones", pregunta: "¿Fuiste internado en el Sanatorio Colegiales?", detalle: "Aclará motivo, mes y año" },
  { id: "cirugia", categoria: "internaciones", pregunta: "¿Tuviste que ser intervenido quirúrgicamente alguna vez?", detalle: "Especificar tipo, fecha y resultado" },
  { id: "secuelas", categoria: "general", pregunta: "¿Tenés secuelas o algún tipo de enfermedad?", detalle: "Describir tipo y gravedad" },
  { id: "accidentes", categoria: "general", pregunta: "¿Padeciste accidentes, fracturas o traumatismos?", detalle: "Aclará motivo, si requirieron cirugías, mes, año y si quedaron secuelas" },
  { id: "transfusiones", categoria: "general", pregunta: "¿Te realizaron transfusiones de sangre?", detalle: "Motivo y fecha" },
  { id: "estudios_anuales", categoria: "estudios", pregunta: "¿Realizaste tus análisis y estudios en el último año?", detalle: "Tipo de estudios y resultados" },
  { id: "indicacion_medica", categoria: "estudios", pregunta: "¿Tenés alguna indicación médica para los próximos meses?", detalle: "Especificá cuál y el diagnóstico presuntivo" },
  { id: "psicologico", categoria: "mental", pregunta: "¿Estás o estuviste en un tratamiento psicológico?", detalle: "Motivo y duración" },
  { id: "psiquiatrico", categoria: "mental", pregunta: "¿Estás o estuviste en un tratamiento psiquiátrico?", detalle: "Motivo, medicación y duración" },
  { id: "internacion_mental", categoria: "mental", pregunta: "¿Estuviste internado en alguna institución de Salud Mental?", detalle: "Motivo, duración y fecha" },
  { id: "diabetes", categoria: "diabetes", pregunta: "¿Tenés diabetes?", detalle: "¿Desde cuándo? ¿Tomás medicación por boca? ¿Recibís insulina? ¿Cumplís algún tipo de dieta? ¿Tenés familiares diabéticos?" },
  { id: "auditivas", categoria: "sentidos", pregunta: "¿Tenés dificultades auditivas?", detalle: "Tipo y gravedad" },
  { id: "vista", categoria: "sentidos", pregunta: "¿Tenés problemas de vista? ¿De qué tipo?", detalle: "Especificar tipo de problema" },
  { id: "lentes", categoria: "sentidos", pregunta: "¿Usás lentes de contacto o anteojos?", detalle: "Graduación aproximada" },
  { id: "glaucoma", categoria: "sentidos", pregunta: "¿Tenés glaucoma (presión alta en el ojo) o cataratas?", detalle: "Tratamiento actual" },
  { id: "alergias", categoria: "alergias", pregunta: "¿Tenés alergias?", detalle: "Tipo de alergia y tratamiento" },
  { id: "infarto", categoria: "cardiacas", pregunta: "¿Tuviste ataques cardíacos o infartos?", detalle: "Fecha y tratamiento" },
  { id: "presion_arterial", categoria: "cardiacas", pregunta: "¿Cuál es tu presión arterial actual?", detalle: "Ej: 120/80 mmHg - Indicar si es alta, baja o normal" },
  { id: "test_embarazo", categoria: "embarazo", pregunta: "¿Te realizaste algún test de embarazo en las últimas semanas?", detalle: "Resultado" },
  { id: "sintomas_embarazo", categoria: "embarazo", pregunta: "¿Presentaste náuseas o vómitos recientemente / mareos o dolores de cabeza?", detalle: "Frecuencia y intensidad" },
  { id: "embarazo_actual", categoria: "embarazo", pregunta: "¿Te encontrás cursando un embarazo ahora?", detalle: "Semanas de gestación" },
  { id: "aborto", categoria: "embarazo", pregunta: "¿Tuviste algún aborto espontáneo?", detalle: "Fecha y causa" },
  { id: "partos", categoria: "embarazo", pregunta: "¿Tuviste partos normales?", detalle: "Cantidad y fechas" },
  { id: "columna", categoria: "fisico", pregunta: "¿Tenés problemas de columna?", detalle: "Tipo de problema y tratamiento" },
  { id: "protesis", categoria: "fisico", pregunta: "¿Tenés colocada alguna prótesis?", detalle: "Tipo y ubicación" },
  { id: "deporte", categoria: "fisico", pregunta: "¿Practicás algún deporte?", detalle: "Tipo y frecuencia" },
  { id: "deporte_riesgo", categoria: "fisico", pregunta: "¿Practicás algún deporte de riesgo?", detalle: "Especificar cuál" },
  { id: "indicacion_protesis", categoria: "fisico", pregunta: "¿Tenés indicación para la colocación de alguna prótesis?", detalle: "Tipo y fecha prevista" },
  { id: "neurologicas", categoria: "neurologicas", pregunta: "¿Tenés o tuviste trastornos neurológicos o circulatorios cerebrales?", detalle: "Tipo y tratamiento" },
  { id: "epilepsia", categoria: "neurologicas", pregunta: "¿Tenés o tuviste epilepsia?", detalle: "Medicación y control" },
  { id: "respiratorias", categoria: "respiratorias", pregunta: "¿Tenés o tuviste asma, bronquitis crónica, enfisema pulmonar?", detalle: "Tipo y tratamiento" },
  { id: "tuberculosis", categoria: "respiratorias", pregunta: "¿Tenés o tuviste tuberculosis?", detalle: "Fecha y tratamiento" },
  { id: "fiebre_reumatica", categoria: "otras", pregunta: "¿Tenés o tuviste fiebre reumática o enfermedades de los huesos?", detalle: "Tipo y tratamiento" },
  { id: "hepatitis", categoria: "otras", pregunta: "¿Tenés o tuviste ictericia, hepatitis (de cualquier tipo), cirrosis?", detalle: "Tipo y tratamiento" },
  { id: "colicos", categoria: "otras", pregunta: "¿Tenés o tuviste cólicos renales o vesiculares?", detalle: "Frecuencia y tratamiento" },
  { id: "infecciones_urinarias", categoria: "otras", pregunta: "¿Tenés o tuviste infecciones urinarias repetidas?", detalle: "Frecuencia y tratamiento" },
  { id: "anemia", categoria: "otras", pregunta: "¿Tenés o tuviste pérdida de sangre o anemia?", detalle: "Causa y tratamiento" },
  { id: "transmision_sexual", categoria: "otras", pregunta: "¿Tenés enfermedades de transmisión sexual? (Sida, Hepatitis B u otras)", detalle: "Tipo y tratamiento" },
  { id: "infecciosas", categoria: "otras", pregunta: "¿Tenés o tuviste otras enfermedades infecciosas?", detalle: "Tipo y tratamiento" },
  { id: "tumores", categoria: "otras", pregunta: "¿Tenés o tuviste tumores?", detalle: "Tipo, ubicación y tratamiento" },
  { id: "tiroides", categoria: "otras", pregunta: "¿Tenés o tuviste enfermedades de las glándulas tiroides?", detalle: "Tipo y medicación" },
  { id: "gastritis", categoria: "otras", pregunta: "¿Tenés o tuviste úlceras, gastritis y/o alguna otra enfermedad del estómago?", detalle: "Tipo y tratamiento" },
  { id: "tabaquismo", categoria: "habitos", pregunta: "¿Fumás o fumaste?", detalle: "Cantidad diaria y desde cuándo" },
  { id: "alcoholismo", categoria: "habitos", pregunta: "¿Bebés alcohol habitualmente?", detalle: "Tipo y frecuencia" },
  { id: "drogas", categoria: "habitos", pregunta: "¿Consumís drogas?", detalle: "Tipo y frecuencia" },
  { id: "perdida_peso", categoria: "habitos", pregunta: "¿Perdiste peso en los últimos 6 meses sin hacer dieta?", detalle: "Cantidad y causa" },
  { id: "diagnostico_reciente", categoria: "habitos", pregunta: "¿Se te diagnosticó recientemente alguna enfermedad?", detalle: "Cuál y tratamiento" },
  { id: "discapacidad", categoria: "habitos", pregunta: "¿Tenés, tuviste o estás tramitando un certificado de discapacidad?", detalle: "Tipo y porcentaje" },
]

export const COBERTURAS_MEDICAS = [
  "Sin cobertura anterior",
  "OSDE",
  "Swiss Medical",
  "Galeno",
  "Medicus",
  "Hospital Italiano",
  "Hospital Alemán",
  "IOMA",
  "OSECAC",
  "OSDEPYM",
  "OSPLAD",
  "OSPRERA",
  "UNION PERSONAL",
  "SANCOR SALUD",
  "ACCORD SALUD",
  "FEDERADA SALUD",
  "Otra",
] as const

// ─── Documentos por persona ──────────────────────────────────────────────────
export const TIPOS_DOCUMENTO = ["dni_frente", "dni_dorso", "recibo_sueldo"] as const
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]

/** El alta no deja avanzar sin estos dos, para titular y cada integrante. */
export const DOCUMENTOS_REQUERIDOS: TipoDocumento[] = ["dni_frente", "dni_dorso"]

export const ETIQUETAS_DOCUMENTO: Record<TipoDocumento, string> = {
  dni_frente:    "DNI (frente)",
  dni_dorso:     "DNI (dorso)",
  recibo_sueldo: "Recibo de sueldo",
}

// ─── Campos obligatorios del paso 1 ──────────────────────────────────────────
// Mismo set que `validarCamposCompletos` en PasoDatosPersonales.jsx.
export const CAMPOS_OBLIGATORIOS_DATOS_PERSONALES = [
  "numero_poliza_vendedor",
  "nombre",
  "apellido",
  "dni",
  "cuil",
  "fecha_nacimiento",
  "sexo",
  "estado_civil",
  "nacionalidad",
  "condicion_iva",
  "tipo_domicilio",
  "direccion",
  "numero",
  "cod_postal",
  "localidad",
  "forma_pago",
  "proximo_periodo_abonar",
] as const
