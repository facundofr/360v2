/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

// ─────────────────────────────────────────────────────────────────────────────
// Reemplazo de `window.confirm()` con el AlertDialog de shadcn.
//
// Producción usa SweetAlert2 (286 diálogos); v2 había caído en el `confirm()`
// gris del navegador. Esta API es promisificada para que los call sites queden
// casi iguales:
//
//     if (!(await confirm({ title: "¿Eliminar?", destructive: true }))) return
// ─────────────────────────────────────────────────────────────────────────────

export interface ConfirmOptions {
  title: string
  description?: string
  /** Texto del botón de confirmación. Default: "Confirmar". */
  confirmText?: string
  /** Texto del botón de cancelación. Default: "Cancelar". */
  cancelText?: string
  /** Pinta la acción en rojo. Usar para borrados y acciones irreversibles. */
  destructive?: boolean
}

type Resolver = (ok: boolean) => void

const ConfirmContext = React.createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<{
    open: boolean
    options: ConfirmOptions
    resolve: Resolver | null
  }>({ open: false, options: { title: "" }, resolve: null })

  const confirm = React.useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ open: true, options, resolve })
      }),
    []
  )

  const close = (ok: boolean) => {
    state.resolve?.(ok)
    setState((s) => ({ ...s, open: false, resolve: null }))
  }

  const { options } = state

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={state.open}
        onOpenChange={(open) => {
          // Cerrar con Esc / clic afuera equivale a cancelar.
          if (!open) close(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{options.title}</AlertDialogTitle>
            {options.description && (
              <AlertDialogDescription>{options.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>
              {options.cancelText ?? "Cancelar"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => close(true)}
              className={cn(
                options.destructive &&
                  buttonVariants({ variant: "destructive" })
              )}
            >
              {options.confirmText ?? "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

/** Devuelve una función `confirm(options) => Promise<boolean>`. */
export function useConfirm() {
  const ctx = React.useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm debe usarse dentro de <ConfirmProvider>")
  return ctx
}
