import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3"
import "./index.css"
import App from "./App.tsx"
import PwaUpdateToast from "@/components/common/PwaUpdateToast"
import { ThemeProvider } from "@/components/common/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ConfirmProvider } from "@/components/common/confirm-dialog"
import { AuthProvider } from "@/contexts/AuthContext"
import { NotificationProvider } from "@/contexts/NotificationContext"
import { initSentry } from "@/lib/sentry"
import { RECAPTCHA_SITE_KEY, BASENAME } from "@/lib/config"

initSentry()

// ─── Notificar actualización PWA disponible ───────────────────────────────────
function notifyPwaUpdateAvailable(registration: ServiceWorkerRegistration) {
  window.dispatchEvent(new CustomEvent("pwa-update-available", { detail: { registration } }))
}

// ─── Registro del Service Worker PWA ─────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${BASENAME}/sw.js`)
      .then((reg) => {
        console.log("[SW] Registrado:", reg.scope)

        if (reg.waiting) {
          notifyPwaUpdateAvailable(reg)
        }

        reg.addEventListener("updatefound", () => {
          const worker = reg.installing
          if (!worker) return
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              console.log("[SW] Nueva versión disponible")
              notifyPwaUpdateAvailable(reg)
            }
          })
        })

        ;(async () => {
          try {
            await fetch(`${BASENAME}/sw.js`, { cache: "no-store" })
            await reg.update()
            if (reg.waiting) notifyPwaUpdateAvailable(reg)
          } catch { /* ignore */ }
        })()

        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) {
            reg.update()
            if (reg.waiting) notifyPwaUpdateAvailable(reg)
          }
        })

        setInterval(() => { reg.update() }, 15 * 60 * 1000)

        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data?.type === "SW_ACTIVATED") {
            console.log("[SW] Activado")
          }
        })
      })
      .catch((err) => console.error("[SW] Error de registro:", err))

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "PAGE_VISIBLE",
          timestamp: Date.now(),
        })
      }
    })
  })
}

// ─── PWA install prompt ───────────────────────────────────────────────────────
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault()
  ;(window as unknown as Record<string, unknown>).__deferredInstallPrompt = e
})
window.addEventListener("appinstalled", () => {
  console.log("[PWA] App instalada exitosamente")
  ;(window as unknown as Record<string, unknown>).__deferredInstallPrompt = null
})
const appTree = (
  <BrowserRouter basename={BASENAME}>
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <TooltipProvider>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
          </TooltipProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {RECAPTCHA_SITE_KEY ? (
      <GoogleReCaptchaProvider
        reCaptchaKey={RECAPTCHA_SITE_KEY}
        language="es"
        useRecaptchaNet={false}
        useEnterprise={false}
        scriptProps={{ async: true, defer: true, appendTo: "head" }}
      >
        {appTree}
        <PwaUpdateToast />
      </GoogleReCaptchaProvider>
    ) : (
      <>
        {appTree}
        <PwaUpdateToast />
      </>
    )}
  </StrictMode>
)
