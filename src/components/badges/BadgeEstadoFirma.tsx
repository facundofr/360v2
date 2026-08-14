import { Badge } from "@/components/ui/badge"
import { CheckCircle, Clock, XCircle, AlertTriangle } from "lucide-react"

type EstadoFirma = "pending" | "signed" | "rejected" | "expired" | null | undefined

interface BadgeEstadoFirmaProps {
  poliza?: { estado_firma?: EstadoFirma }
  estado?: EstadoFirma
  className?: string
}

const CONFIG = {
  pending: {
    label: "Pendiente de firma",
    variant: "warn" as const,
    Icon: Clock,
    title: "La póliza fue enviada y está esperando la firma del prospecto",
  },
  signed: {
    label: "Póliza firmada",
    variant: "ok" as const,
    Icon: CheckCircle,
    title: "La póliza ha sido firmada exitosamente por el prospecto",
  },
  rejected: {
    label: "Firma rechazada",
    variant: "risk" as const,
    Icon: XCircle,
    title: "El prospecto rechazó la firma de la póliza",
  },
  expired: {
    label: "Firma expirada",
    variant: "secondary" as const,
    Icon: AlertTriangle,
    title: "El plazo para firmar la póliza ha expirado",
  },
} as const

export function BadgeEstadoFirma({ poliza, estado, className = "" }: BadgeEstadoFirmaProps) {
  const estadoFirma = (poliza?.estado_firma ?? estado) as EstadoFirma
  if (!estadoFirma) return null

  const config = CONFIG[estadoFirma] ?? {
    label: "Estado desconocido",
    variant: "secondary" as const,
    Icon: AlertTriangle,
    title: "",
  }

  const { label, variant, Icon, title } = config

  return (
    <Badge variant={variant} className={`inline-flex items-center gap-1 ${className}`} title={title}>
      <Icon className="size-3" />
      {label}
    </Badge>
  )
}
