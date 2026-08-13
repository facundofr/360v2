import * as React from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, X } from "lucide-react"

export default function PwaUpdateToast() {
  const [open, setOpen] = React.useState(false)
  const registrationRef = React.useRef<ServiceWorkerRegistration | null>(null)

  const applyUpdate = React.useCallback(async () => {
    try {
      const reg = registrationRef.current
      if (!reg) return
      const waitingWorker = reg.waiting
      if (waitingWorker) {
        waitingWorker.postMessage({ type: "SKIP_WAITING" })
        const onControllerChange = () => {
          navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
          window.location.reload()
        }
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)
      } else {
        await reg.update()
        window.location.reload()
      }
    } catch {
      window.location.reload()
    }
  }, [])

  React.useEffect(() => {
    const onUpdateAvailable = (e: Event) => {
      const detail = (e as CustomEvent).detail
      registrationRef.current = detail?.registration || null
      setOpen(true)
    }
    window.addEventListener("pwa-update-available", onUpdateAvailable as EventListener)
    return () => window.removeEventListener("pwa-update-available", onUpdateAvailable as EventListener)
  }, [])

  if (!open) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[99999] w-full max-w-sm px-4 animate-in slide-in-from-bottom-2">
      <Alert className="bg-[#2D3047] text-white border-0 shadow-xl">
        <AlertDescription className="flex items-center justify-between gap-2">
          <span className="text-sm">Hay una nueva versión disponible</span>
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="h-7 text-xs text-white/70 hover:text-white hover:bg-white/10" onClick={() => setOpen(false)}>
              <X className="size-3 mr-1" />Más tarde
            </Button>
            <Button size="sm" className="h-7 text-xs bg-[#8B7EC8] hover:bg-[#7a6bb9] text-white" onClick={applyUpdate}>
              <RefreshCw className="size-3 mr-1" />Actualizar
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}
