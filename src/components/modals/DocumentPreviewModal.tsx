import * as React from "react"
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useDeviceDetection } from "@/hooks/useDeviceDetection"

interface DocumentPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  previewUrl?: string
  previewMime?: string
  documentName?: string
  onDownload?: () => void
}

export default function DocumentPreviewModal({
  open,
  onOpenChange,
  previewUrl,
  previewMime,
  documentName = "Documento",
  onDownload,
}: DocumentPreviewModalProps) {
  const [loading, setLoading] = React.useState(true)
  const { isMobile } = useDeviceDetection()

  const handleDownload = () => {
    if (onDownload) {
      onDownload()
    } else if (previewUrl) {
      const ext = previewMime === "application/pdf" ? ".pdf"
        : previewMime?.startsWith("image/") ? `.${previewMime.split("/")[1]}`
        : ""
      const fileName = `${documentName.replace(/[^a-zA-Z0-9]/g, "_")}${ext}`
      const a = document.createElement("a")
      a.href = previewUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const renderContent = () => {
    if (!previewUrl || !previewMime) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
          <FileText className="size-12" />
          <p className="text-sm">No se pudo cargar el documento</p>
        </div>
      )
    }

    if (previewMime.startsWith("image/")) {
      return (
        <div className="flex justify-center">
          <img
            src={previewUrl}
            alt={documentName}
            className="max-w-full object-contain"
            style={{ maxHeight: isMobile ? "60vh" : "70vh" }}
            onLoad={() => setLoading(false)}
          />
        </div>
      )
    }

    if (previewMime === "application/pdf") {
      if (isMobile) {
        return (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <FileText className="size-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground max-w-xs">
              En dispositivos móviles recomendamos descargar o abrir en nueva pestaña.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <Button onClick={handleDownload} className="w-full">
                <Download className="size-4 mr-2" />
                Descargar PDF
              </Button>
              <Button variant="outline" onClick={() => window.open(previewUrl, "_blank")} className="w-full">
                <ExternalLink className="size-4 mr-2" />
                Abrir en nueva pestaña
              </Button>
            </div>
          </div>
        )
      }

      return (
        <div className="relative" style={{ height: "70vh" }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          )}
          <iframe
            src={previewUrl}
            title={documentName}
            className="w-full h-full border-0 rounded"
            onLoad={() => setLoading(false)}
          />
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <FileText className="size-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Tipo de archivo no soportado para previsualización</p>
        <Button onClick={handleDownload}>
          <Download className="size-4 mr-2" />
          Descargar
        </Button>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-4" />
            {documentName}
          </DialogTitle>
        </DialogHeader>
        <div className="py-2">{renderContent()}</div>
        <DialogFooter className="flex gap-2">
          {previewUrl && previewMime !== "application/pdf" && (
            <Button variant="outline" onClick={() => window.open(previewUrl, "_blank")}>
              <ExternalLink className="size-4 mr-2" />
              Nueva pestaña
            </Button>
          )}
          <Button variant="outline" onClick={handleDownload}>
            <Download className="size-4 mr-2" />
            Descargar
          </Button>
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
