// ─── Servicio de notificaciones push (Firebase FCM) ──────────────────────────
import { initializeApp, getApps, getApp } from "firebase/app"
import { getMessaging, getToken, onMessage } from "firebase/messaging"
import axios from "axios"
import { API_URL } from "@/lib/config"
import { getAuthHeaders, getFcmToken, setFcmToken, clearFcmToken } from "@/lib/auth"

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

type NotificationPayload = {
  title?: string
  body?:  string
  data:   Record<string, string>
  timestamp: Date
}

type NotificationCallback = (notification: NotificationPayload) => void

let messagingInstance: ReturnType<typeof getMessaging> | null = null
const notificationCallbacks: Record<string, NotificationCallback> = {}

// ─── Inicializar Firebase y pedir permisos ────────────────────────────────────
export async function initializeNotifications(): Promise<boolean> {
  try {
    if (!("Notification" in window)) {
      console.warn("[FCM] Navegador sin soporte de notificaciones")
      return false
    }

    // Registrar SW de Firebase en background
    if ("serviceWorker" in navigator) {
      try {
        await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" })
      } catch (err) {
        console.warn("[FCM] Error registrando SW:", err)
      }
    }

    // Inicializar Firebase (evitar duplicados)
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
    messagingInstance = getMessaging(app)

    if (Notification.permission === "granted") {
      await registrarTokenFCM()
      return true
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission()
      if (permission === "granted") {
        await new Promise((r) => setTimeout(r, 500))
        await registrarTokenFCM()
        return true
      }
    }

    console.warn("[FCM] Permiso denegado")
    return false
  } catch (err) {
    console.error("[FCM] Error inicializando:", err)
    return false
  }
}

// ─── Registrar token FCM en el backend ───────────────────────────────────────
export async function registrarTokenFCM(): Promise<string | null> {
  try {
    if (!messagingInstance) return null
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
    if (!vapidKey) { console.warn("[FCM] VAPID key no configurada"); return null }

    const token = await getToken(messagingInstance, { vapidKey })
    if (!token) { console.warn("[FCM] No se pudo obtener token"); return null }

    setFcmToken(token)
    await axios.post(
      `${API_URL}/fcm/register`,
      {
        token,
        deviceInfo: {
          device:     navigator.userAgent,
          platform:   navigator.platform,
          appVersion: navigator.appVersion,
        },
      },
      { headers: getAuthHeaders() }
    )
    return token
  } catch (err) {
    console.error("[FCM] Error registrando token:", err)
    return null
  }
}

// ─── Desregistrar token FCM (logout) ─────────────────────────────────────────
export async function desregistrarTokenFCM(): Promise<void> {
  try {
    const token = getFcmToken()
    if (!token) return
    await axios.post(`${API_URL}/fcm/unregister`, { token }, { headers: getAuthHeaders() })
    clearFcmToken()
  } catch (err) {
    console.error("[FCM] Error desregistrando token:", err)
  }
}

// ─── Diagnóstico (paridad con producción) ────────────────────────────────────

/** Lista los tokens FCM registrados del usuario actual. */
export async function listarTokensFCM(): Promise<unknown[]> {
  try {
    const { data } = await axios.get(`${API_URL}/fcm/tokens`, { headers: getAuthHeaders() })
    return data?.tokens ?? data?.data ?? []
  } catch (err) {
    console.error("[FCM] Error listando tokens:", err)
    return []
  }
}

/** Dispara una notificación de prueba contra el token actual. */
export async function enviarNotificacionPrueba(): Promise<boolean> {
  try {
    const token = getFcmToken()
    await axios.post(`${API_URL}/fcm/test`, token ? { token } : {}, { headers: getAuthHeaders() })
    return true
  } catch (err) {
    console.error("[FCM] Error enviando notificación de prueba:", err)
    return false
  }
}

// ─── Listener de notificaciones en foreground ────────────────────────────────
export function setupForegroundNotifications(callback: NotificationCallback): void {
  if (!messagingInstance) { console.warn("[FCM] Messaging no inicializado"); return }
  onMessage(messagingInstance, (payload) => {
    const notification: NotificationPayload = {
      title:     payload.notification?.title,
      body:      payload.notification?.body,
      data:      (payload.data ?? {}) as Record<string, string>,
      timestamp: new Date(),
    }
    callback(notification)
    // También disparar callbacks por tipo
    const tipo = notification.data.tipo
    if (tipo && notificationCallbacks[tipo]) notificationCallbacks[tipo](notification)
  })
}

// ─── Registrar callback por tipo de notificación ─────────────────────────────
export function onNotificationType(tipo: string, callback: NotificationCallback): void {
  notificationCallbacks[tipo] = callback
}
