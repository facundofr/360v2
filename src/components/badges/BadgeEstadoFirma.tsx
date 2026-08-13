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
    variant: "secondary" as const,
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-200",
    Icon: Clock,
    title: "La póliza fue enviada y está esperando la firma del prospecto",
  },
  signed: {
    label: "Póliza firmada",
    variant: "secondary" as const,
    className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200",
    Icon: CheckCircle,
    title: "La póliza ha sido firmada exitosamente por el prospecto",
  },
  rejected: {
    label: "Firma rechazada",
    variant: "destructive" as const,
    className: "",
    Icon: XCircle,
    title: "El prospecto rechazó la firma de la póliza",
  },
  expired: {
    label: "Firma expirada",
    variant: "secondary" as const,
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
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
    className: "",
    Icon: AlertTriangle,
    title: "",
  }

  const { label, variant, className: cfgClass, Icon, title } = config

  return (
    <Badge variant={variant} className={`inline-flex items-center gap-1 ${cfgClass} ${className}`} title={title}>
      <Icon className="size-3" />
      {label}
    </Badge>
  )
}
