import { useState, useRef } from "react"
import axios from "axios"
import { toast } from "sonner"
import { Upload, Check } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface CargarPolizaFirmadaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  polizaId: number
  numeroPoliza?: string
  onSuccess?: () => void
}

export function CargarPolizaFirmadaModal({
  open,
  onOpenChange,
  polizaId,
  numeroPoliza,
  onSuccess,
}: CargarPolizaFirmadaModalProps) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [cargando, setCargando] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleArchivoSeleccionado = (file: File | null) => {
    if (!file) { setArchivo(null); return }
    if (file.type !== "application/pdf") {
      toast.error("Solo se aceptan archivos PDF")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo no puede ser mayor a 10MB")
      return
    }
    setArchivo(file)
  }

  const handleCargar = async () => {
    if (!archivo) { toast.warning("Seleccioná un archivo PDF"); return }
    setCargando(true)
    setProgreso(0)
    try {
      const formData = new FormData()
      formData.append("poliza_id", String(polizaId))
      formData.append("poliza_firmada", archivo)
      await axios.post(`${API_URL}/polizas/documentos/firmada/cargar`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        onUploadProgress: (e) => {
          setProgreso(Math.round(((e.loaded ?? 0) * 100) / (e.total ?? 1)))
        },
      })
      toast.success("Póliza firmada cargada exitosamente")
      handleReset()
      onOpenChange(false)
      onSuccess?.()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error).message ??
        "Error al cargar"
      toast.error(`Error: ${msg}`)
    } finally {
      setCargando(false)
    }
  }

  const handleReset = () => {
    setArchivo(null)
    setProgreso(0)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!cargando) { handleReset(); onOpenChange(v) }
      }}
    >
      <DialogContent className="sm:max-w-xl lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4" />
            Cargar Póliza Firmada
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            <strong>Póliza:</strong> {numeroPoliza ?? `ID ${polizaId}`}
          </p>
          <p className="text-xs text-muted-foreground">
            Subí la póliza firmada en formato PDF. Solo PDF, máximo 10MB.
          </p>

          {!archivo ? (
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/40 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f) handleArchivoSeleccionado(f)
              }}
            >
              <Upload className="size-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">Hacé clic o arrastrá el archivo</p>
              <p className="text-xs text-muted-foreground mt-1">Solo archivos PDF (máximo 10MB)</p>
            </div>
          ) : (
            <div className="rounded-lg border border-state-ok/30 bg-state-ok-soft p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-state-ok-text">
                  <Check className="size-4 shrink-0" />
                  <span className="font-medium truncate max-w-[240px]">{archivo.name}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={handleReset}
                  disabled={cargando}
                >
                  Cambiar
                </Button>
              </div>
              {cargando && progreso > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Cargando: {progreso}%</p>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${progreso}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => handleArchivoSeleccionado(e.target.files?.[0] ?? null)}
            className="hidden"
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => { handleReset(); onOpenChange(false) }}
              disabled={cargando}
            >
              Cancelar
            </Button>
            <Button onClick={handleCargar} disabled={!archivo || cargando}>
              {cargando ? (
                "Cargando..."
              ) : (
                <>
                  <Upload className="size-3.5 mr-1.5" />
                  Cargar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
