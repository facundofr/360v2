// Tipos y valores por defecto del bloque `saludTerminos`.
//
// Viven acá y no en `PasoSaludTerminos.tsx` porque un archivo de componente que
// además exporta valores rompe el fast refresh de Vite (regla
// react-refresh/only-export-components).
//
// La forma la dicta `polizaPDFController.js`, que lee todo indexado por
// integrante: `respuestas[i]`, `coberturaAnterior[i]`, `medicacion[i]`,
// `datos_adicionales[i]`.

import type { RespuestasPorIntegrante } from "@/features/vendedor/lib/poliza-reglas"

export interface CoberturaAnterior {
  cobertura: string
  fecha_desde: string
  fecha_hasta: string
  motivo_baja: string
}

export interface DatosAdicionales {
  declaracion_adicional: string
  medico_tratante: string
  instituciones_anteriores: string
}

export interface SaludTerminos {
  respuestas: RespuestasPorIntegrante
  coberturaAnterior: Record<string, CoberturaAnterior>
  medicacion: Record<string, { detalle: string }>
  datosAdicionales: Record<string, DatosAdicionales>
}

export interface IntegranteSalud {
  nombre: string
  apellido: string
  vinculo: string
}

/** Defaults iguales a los de producción. */
export const COBERTURA_VACIA: CoberturaAnterior = {
  cobertura: "Sin cobertura anterior",
  fecha_desde: "",
  fecha_hasta: "",
  motivo_baja: "",
}

export const DATOS_ADICIONALES_VACIOS: DatosAdicionales = {
  declaracion_adicional: "",
  medico_tratante: "",
  instituciones_anteriores: "",
}

export const saludTerminosVacio = (): SaludTerminos => ({
  respuestas: {},
  coberturaAnterior: {},
  medicacion: {},
  datosAdicionales: {},
})
