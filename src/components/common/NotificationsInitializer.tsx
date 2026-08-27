import { useEffect } from "react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import {
  initializeNotifications,
  setupForegroundNotifications,
  onNotificationType,
} from "@/services/notificationsService"

/**
 * Componente sin UI que inicializa FCM cuando el usuario está autenticado.
 * Debe montarse dentro de <AuthProvider>.
 */
export default function NotificationsInitializer() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    let active = true

    const init = async () => {
      const granted = await initializeNotifications()
      if (!active) return

      if (granted) {
        // Notificaciones en foreground → toast con sonner
        setupForegroundNotifications((notification) => {
          toast(notification.title ?? "Cober360", {
            description: notification.body,
            duration: 5000,
          })
        })

        // Prospecto asignado
        onNotificationType("prospecto_asignado", (n) => {
          toast.info("Nuevo prospecto asignado", { description: n.body, duration: 6000 })
        })

        // Mensaje de WhatsApp
        onNotificationType("mensaje_whatsapp", (n) => {
          toast.message("Nuevo mensaje de WhatsApp", { description: n.body, duration: 5000 })
        })
      }
    }

    init()
    return () => { active = false }
  }, [user])

  return null
}
