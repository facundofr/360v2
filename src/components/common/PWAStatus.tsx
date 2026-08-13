import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Wifi, WifiOff, Smartphone, Download } from "lucide-react"

/**
 * Componente para mostrar el estado de la PWA (solo en desarrollo).
 * Útil para debugging en dispositivos móviles.
 */
export default function PWAStatus() {
  const [swStatus, setSwStatus] = useState<"checking" | "active" | "not-registered" | "not-supported">("checking")
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)

  useEffect(() => {
    // Verificar estado del service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          setSwStatus("active")
          setLastUpdate(new Date().toLocaleTimeString())
        } else {
          setSwStatus("not-registered")
        }
      })

      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "SW_ACTIVATED") {
          setSwStatus("active")
          setLastUpdate(new Date().toLocaleTimeString())
        }
      })
    } else {
      setSwStatus("not-supported")
    }

    // Verificar si la PWA está instalada (modo standalone)
    if (window.matchMedia?.("(display-mode: standalone)").matches) {
      setIsInstalled(true)
    }

    // Escuchar evento de instalación disponible
    const handleInstallPrompt = () => setIsInstallable(true)
    window.addEventListener("beforeinstallprompt", handleInstallPrompt)

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsInstallable(false)
    }
    window.addEventListener("appinstalled", handleAppInstalled)

    // Detectar cambios de conectividad
    const handleOnline = () => {
      setIsOnline(true)
      setLastUpdate(new Date().toLocaleTimeString())
    }
    const handleOffline = () => {
      setIsOnline(false)
      setLastUpdate(new Date().toLocaleTimeString())
    }
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Solo visible en desarrollo
  if (import.meta.env.PROD) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-1 text-xs">
      {/* Conectividad */}
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full shadow border text-white ${isOnline ? "bg-green-600" : "bg-red-600"}`}>
        {isOnline ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
        {isOnline ? "Online" : "Offline"}
      </div>

      {/* SW Status */}
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full shadow border ${swStatus === "active" ? "bg-blue-600 text-white" : "bg-gray-400 text-white"}`}>
        <Smartphone className="size-3" />
        SW: {swStatus}
      </div>

      {/* Instalación */}
      {(isInstallable || isInstalled) && (
        <Badge variant={isInstalled ? "default" : "secondary"} className="gap-1 text-[10px] px-2 py-0.5">
          <Download className="size-3" />
          {isInstalled ? "Instalada" : "Instalable"}
        </Badge>
      )}

      {lastUpdate && (
        <span className="text-[10px] text-muted-foreground px-1">
          {lastUpdate}
        </span>
      )}
    </div>
  )
}
