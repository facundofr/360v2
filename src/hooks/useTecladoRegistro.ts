import { useEffect } from "react"

/**
 * EL PADRÓN — el turno completo se trabaja sin mouse.
 *
 * `/` lleva el foco al buscador y selecciona lo que haya escrito; `J` y `K`
 * recorren los asientos del registro parándose en la casilla de marcado, que
 * es el punto de entrada de la fila.
 *
 * Los selectores son los del registro (`[data-buscador]` y `.reg-row.reg-entry`),
 * así que el hook sirve igual en cualquier página que monte uno: no sabe nada
 * de prospectos ni de pólizas. Si hay dos registros en pantalla —nunca pasa
 * hoy— recorrería los dos como una sola lista, que es lo que uno esperaría.
 *
 * No hace nada mientras se está escribiendo: una `j` en un comentario es una
 * letra, no un atajo.
 */
export function useTecladoRegistro(activo = true) {
  useEffect(() => {
    if (!activo) return

    function onKey(e: KeyboardEvent) {
      const foco = document.activeElement
      const escribiendo = foco instanceof HTMLElement &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName) || foco.isContentEditable)

      if (e.key === "/" && !escribiendo) {
        const buscador = document.querySelector<HTMLInputElement>("[data-buscador]")
        if (buscador) { e.preventDefault(); buscador.focus(); buscador.select() }
        return
      }
      if (escribiendo) return

      if (e.key === "j" || e.key === "k") {
        const filas = Array.from(document.querySelectorAll<HTMLElement>(".reg-row.reg-entry"))
        if (!filas.length) return
        e.preventDefault()
        const aqui = foco instanceof HTMLElement ? foco.closest(".reg-row.reg-entry") : null
        const at = aqui ? filas.indexOf(aqui as HTMLElement) : -1
        const sig = e.key === "j" ? Math.min(at + 1, filas.length - 1) : Math.max(at - 1, 0)
        filas[sig].querySelector<HTMLElement>("button[role=checkbox]")?.focus()
        filas[sig].scrollIntoView({ block: "nearest" })
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [activo])
}
