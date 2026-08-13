import axios from "axios"
import { toast } from "sonner"
import { API_URL, BASENAME } from "@/lib/config"
import { getAuthToken, clearSession } from "@/lib/auth"

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
})

api.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      axios.isAxiosError(error) &&
      (error.response?.status === 401 || error.response?.status === 403)
    ) {
      const msg: string = error.response?.data?.message ?? ""
      const isTokenError =
        msg === "Token no proporcionado" ||
        msg === "Token inválido" ||
        msg === "jwt expired" ||
        msg === "Unauthorized"
      if (isTokenError) {
        clearSession()
        delete axios.defaults.headers.common["Authorization"]
        toast.error("Tu sesión ha expirado. Redirigiendo al login...")
        // La app monta bajo BASENAME: un assign("/login") pelado rompe la ruta.
        setTimeout(() => window.location.assign(`${BASENAME}/login`), 1500)
      }
    }
    return Promise.reject(error)
  }
)

export default api
