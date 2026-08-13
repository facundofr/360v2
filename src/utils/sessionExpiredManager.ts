// ─── Gestor global de sesión expirada ─────────────────────────────────────────
// Previene múltiples modales de sesión expirada desde diferentes fuentes

type ExpiredCallback = (source: string) => void

class SessionExpiredManager {
  private modalShown = false
  private callbacks = new Map<string, ExpiredCallback>()

  registerCallback(source: string, callback: ExpiredCallback) {
    this.callbacks.set(source, callback)
  }

  unregisterCallback(source: string) {
    this.callbacks.delete(source)
  }

  handleExpired(_source?: string): boolean {
    void _source
    if (this.modalShown) return false

    this.modalShown = true

    this.callbacks.forEach((callback, callbackSource) => {
      try {
        callback(callbackSource)
      } catch (error) {
        console.error(`Error en callback de sesión expirada para ${callbackSource}:`, error)
      }
    })

    return true
  }

  reset() {
    this.modalShown = false
  }

  isModalShown(): boolean {
    return this.modalShown
  }
}

const sessionExpiredManager = new SessionExpiredManager()
export default sessionExpiredManager
