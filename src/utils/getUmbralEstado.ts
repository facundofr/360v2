export type EstadoUmbral = "ok" | "warn" | "risk"

/**
 * Clasifica un porcentaje contra dos cortes configurables. Reemplaza los
 * semáforos verde/amarillo/rojo duplicados en monitoreo y seguridad — cada
 * caso define sus propios cortes (CPU/RAM/disco vs. severidad de seguridad),
 * pero la forma es siempre la misma.
 */
export function getUmbralEstado(
  pct: number,
  cortes: { warn: number; risk: number } = { warn: 60, risk: 80 }
): EstadoUmbral {
  if (pct >= cortes.risk) return "risk"
  if (pct >= cortes.warn) return "warn"
  return "ok"
}

export const ESTADO_BG_SOLID: Record<EstadoUmbral, string> = {
  ok: "bg-state-ok",
  warn: "bg-state-warn",
  risk: "bg-state-risk",
}

export const ESTADO_TEXT: Record<EstadoUmbral, string> = {
  ok: "text-state-ok-text",
  warn: "text-state-warn-text",
  risk: "text-state-risk-text",
}
