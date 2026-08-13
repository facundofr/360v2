import axios from "axios"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

const getAuthHeader = () => ({
  Authorization: `Bearer ${getAuthToken()}`,
})

export const refritosService = {
  cargarArchivo: async (archivo: File) => {
    const formData = new FormData()
    formData.append("archivo", archivo)
    const { data } = await axios.post(`${API_URL}/admin/refritos/cargar`, formData, {
      headers: { ...getAuthHeader(), "Content-Type": "multipart/form-data" },
    })
    return data
  },

  obtenerEstadisticas: async () => {
    const { data } = await axios.get(`${API_URL}/admin/refritos/estadisticas`, {
      headers: getAuthHeader(),
    })
    return data
  },

  obtenerRefritosVendedor: async (vendedorId: number) => {
    const { data } = await axios.get(`${API_URL}/admin/refritos/vendedor/${vendedorId}`, {
      headers: getAuthHeader(),
    })
    return data
  },

  obtenerHistorial: async (prospectoId: number) => {
    const { data } = await axios.get(`${API_URL}/admin/refritos/historial/${prospectoId}`, {
      headers: getAuthHeader(),
    })
    return data
  },

  reasignarRefrito: async (prospectoId: number) => {
    const { data } = await axios.post(
      `${API_URL}/admin/refritos/reasignar`,
      { prospectoId },
      { headers: getAuthHeader() }
    )
    return data
  },

  /** Saca al prospecto del circuito de refritos (POST .../eliminar-flujo). */
  eliminarDelFlujo: async (prospectoId: number) => {
    const { data } = await axios.post(
      `${API_URL}/admin/refritos/eliminar-flujo`,
      { prospectoId },
      { headers: getAuthHeader() }
    )
    return data
  },

  /** Reporte de refritos agrupado por vendedor (GET .../reporte-vendedores). */
  obtenerReporteVendedores: async () => {
    const { data } = await axios.get(`${API_URL}/admin/refritos/reporte-vendedores`, {
      headers: getAuthHeader(),
    })
    return data?.reporte ?? data?.data ?? []
  },
}
