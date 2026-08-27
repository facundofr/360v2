import * as React from "react"
import axios from "axios"
import { toast } from "sonner"
import { Upload, Plus, Trash2, FileText, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface Poliza {
  id: number
  numero_poliza_oficial?: string
  numero_poliza?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  poliza: Poliza
  apiContext?: "vendedor" | "supervisor" | "backoffice"
  onDocumentosActualizados?: () => void
}

interface Item {
  id: number
  file: File | null
  titulo: string
}

const TIPOS_PERMITIDOS = [
  "image/jpeg", "image/png", "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

const MAX_FILES = 10
const MAX_SIZE = 10 * 1024 * 1024

export function SubirDocumentosLibresModal({ open, onOpenChange, poliza, apiContext = "vendedor", onDocumentosActualizados }: Props) {
  const [items, setItems] = React.useState<Item[]>([{ id: 1, file: null, titulo: "" }])
  const [loading, setLoading] = React.useState(false)
  const [progreso, setProgreso] = React.useState(0)
  const [progresoMensaje, setProgresoMensaje] = React.useState("")
  const nextId = React.useRef(2)
  const fileInputRefs = React.useRef<Record<number, HTMLInputElement | null>>({})

  const getEndpointBase = () => {
    if (apiContext === "supervisor" || apiContext === "backoffice") {
      return `${API_URL}/supervisor/polizas`
    }
    return `${API_URL}/vendedor/polizas`
  }

  const handleClose = () => {
    if (loading) return
    setItems([{ id: 1, file: null, titulo: "" }])
    setProgreso(0)
    setProgresoMensaje("")
    nextId.current = 2
    onOpenChange(false)
  }

  const agregarItem = () => {
    if (items.length >= MAX_FILES) {
      toast.warning(`Podés subir hasta ${MAX_FILES} documentos por vez.`)
      return
    }
    const id = nextId.current++
    setItems(prev => [...prev, { id, file: null, titulo: "" }])
  }

  const eliminarItem = (id: number) => {
    if (items.length === 1) return
    setItems(prev => prev.filter(item => item.id !== id))
  }

  const handleFileChange = (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_SIZE) {
      toast.error("El tamaño máximo permitido es 10MB.")
      e.target.value = ""
      return
    }

    if (!TIPOS_PERMITIDOS.includes(file.type)) {
      toast.error("Solo se permiten archivos JPG, PNG, PDF, DOC y DOCX.")
      e.target.value = ""
      return
    }

    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const tituloSugerido = item.titulo.trim() ? item.titulo : file.name.replace(/\.[^.]+$/, "")
      return { ...item, file, titulo: tituloSugerido }
    }))
  }

  const handleTituloChange = (id: number, valor: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, titulo: valor } : item))
  }

  const validar = (): boolean => {
    const itemsConArchivo = items.filter(i => i.file)
    if (itemsConArchivo.length === 0) {
      toast.warning("Seleccioná al menos un archivo para subir.")
      return false
    }
    for (const item of itemsConArchivo) {
      if (!item.titulo.trim()) {
        toast.warning("Todos los archivos deben tener un título.")
        return false
      }
      if (item.titulo.trim().length > 100) {
        toast.warning("El título no puede superar los 100 caracteres.")
        return false
      }
    }
    return true
  }

  const handleSubir = async () => {
    if (!validar()) return

    const itemsConArchivo = items.filter(i => i.file)
    setLoading(true)
    setProgreso(0)
    setProgresoMensaje("Preparando archivos...")

    const token = getAuthToken()
    const baseUrl = getEndpointBase()
    const errores: string[] = []
    let subidos = 0

    for (let i = 0; i < itemsConArchivo.length; i++) {
      const item = itemsConArchivo[i]
      setProgresoMensaje(`Subiendo "${item.titulo}" (${i + 1}/${itemsConArchivo.length})...`)

      try {
        const fd = new FormData()
        fd.append("documentos", item.file!)
        fd.append("tipos_documento", JSON.stringify(["documento_adicional"]))
        fd.append("observaciones", item.titulo.trim())

        await axios.post(`${baseUrl}/${poliza.id}/documentos/multiple`, fd, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        })

        subidos++
        setProgreso(Math.round(((i + 1) / itemsConArchivo.length) * 100))
      } catch (err) {
        if (axios.isAxiosError(err)) {
          errores.push(`"${item.titulo}": ${err.response?.data?.message || err.message}`)
        } else {
          errores.push(`"${item.titulo}": Error desconocido`)
        }
      }
    }

    setLoading(false)

    if (errores.length > 0 && subidos === 0) {
      toast.error(`Error al subir: ${errores.join("; ")}`)
      return
    }

    if (subidos > 0) {
      if (errores.length > 0) {
        toast.warning(`${subidos} documento${subidos !== 1 ? "s" : ""} subido${subidos !== 1 ? "s" : ""}, ${errores.length} con error.`)
      } else {
        toast.success(`${subidos} documento${subidos !== 1 ? "s" : ""} subido${subidos !== 1 ? "s" : ""} correctamente.`)
      }
      if (onDocumentosActualizados) onDocumentosActualizados()
      handleClose()
    }
  }

  const itemsConArchivo = items.filter(i => i.file).length
  const todosConTitulo = items.filter(i => i.file).every(i => i.titulo.trim())

  const formatBytes = (b: number) => {
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
    return `${(b / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4 text-primary" />
            Agregar Documentos
            {poliza && (
              <Badge variant="secondary" className="text-xs">
                Póliza #{poliza.numero_poliza_oficial || poliza.numero_poliza}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <Alert className="mb-2">
          <AlertDescription className="text-xs">
            <strong>Instrucciones:</strong> Seleccioná cada archivo y editá el título para identificarlo fácilmente.
            Formatos: JPG, PNG, PDF, DOC, DOCX. Máximo 10MB por archivo.
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-3">
          {items.map((item, index) => (
            <div key={item.id} className="border rounded-lg p-3 space-y-2" style={{ backgroundColor: item.file ? "#f8fff8" : "transparent" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Documento {index + 1}</span>
                {items.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive"
                    onClick={() => eliminarItem(item.id)}
                    disabled={loading}
                    title="Eliminar esta fila"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Título <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Ej: Análisis de sangre, Certificado médico..."
                  value={item.titulo}
                  onChange={(e) => handleTituloChange(item.id, e.target.value)}
                  maxLength={100}
                  disabled={loading}
                  className={item.file && !item.titulo.trim() ? "border-destructive" : ""}
                />
                {item.titulo.trim() && (
                  <p className="text-[10px] text-muted-foreground">{100 - item.titulo.length} caracteres restantes</p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Archivo <span className="text-destructive">*</span>
                </Label>
                {item.file ? (
                  <div className="flex items-center gap-2 p-2 border rounded bg-background">
                    <FileText className="size-4 text-state-ok-text shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.file.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatBytes(item.file.size)}</p>
                    </div>
                    <CheckCircle className="size-4 text-state-ok-text shrink-0" />
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => {
                      setItems(prev => prev.map(i => i.id === item.id ? { ...i, file: null } : i))
                      if (fileInputRefs.current[item.id]) {
                        fileInputRefs.current[item.id]!.value = ""
                      }
                    }} disabled={loading}>
                      Cambiar
                    </Button>
                  </div>
                ) : (
                  <Input
                    ref={(el) => { fileInputRefs.current[item.id] = el }}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                    onChange={(e) => handleFileChange(item.id, e)}
                    disabled={loading}
                    className="text-xs"
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={agregarItem} disabled={loading || items.length >= MAX_FILES} className="gap-1 self-start">
          <Plus className="size-3" />
          Agregar otro documento
          {items.length >= MAX_FILES && <span className="text-muted-foreground">(máx. {MAX_FILES})</span>}
        </Button>

        {loading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium">{progresoMensaje}</span>
              <span>{progreso}%</span>
            </div>
            <Progress value={progreso} className="h-2" />
          </div>
        )}

        <DialogFooter className="gap-2">
          <div className="flex-1">
            {itemsConArchivo > 0 && (
              <Badge variant={todosConTitulo ? "default" : "secondary"} className="text-xs">
                {itemsConArchivo} archivo{itemsConArchivo !== 1 ? "s" : ""} seleccionado{itemsConArchivo !== 1 ? "s" : ""}
                {!todosConTitulo && " · Faltan títulos"}
              </Badge>
            )}
          </div>
          <Button variant="outline" onClick={handleClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubir} disabled={loading || itemsConArchivo === 0 || !todosConTitulo}>
            {loading ? (
              <><Loader2 className="size-4 animate-spin mr-1" />Subiendo...</>
            ) : (
              <><Upload className="size-4 mr-1" />Subir {itemsConArchivo > 0 ? `${itemsConArchivo} documento${itemsConArchivo !== 1 ? "s" : ""}` : "documentos"}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
