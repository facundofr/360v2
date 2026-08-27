import * as Sentry from "@sentry/react"

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined

export function initSentry() {
  if (!SENTRY_DSN) {
    console.warn("[Sentry] VITE_SENTRY_DSN no definido — Sentry desactivado")
    return
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
    release: `cober360-v2@${import.meta.env.VITE_APP_VERSION ?? "dev"}`,
  })

  console.log("[Sentry] Inicializado correctamente")
}
