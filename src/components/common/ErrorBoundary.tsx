import { Component, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: { componentStack: string }) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    if (typeof window !== "undefined" && (window as any).Sentry) {
      ;(window as any).Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } })
    }
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex items-center justify-center min-h-[60vh] p-8">
          <div className="max-w-md text-center space-y-6">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">Algo sali&oacute; mal</h2>
              <p className="text-sm text-muted-foreground">
                Ocurri&oacute; un error inesperado en esta secci&oacute;n.
                {this.state.error && (
                  <span className="block mt-1 font-mono text-xs text-muted-foreground/60">
                    {this.state.error.message}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" onClick={() => window.location.href = "/login"}>
                <Home className="size-4 mr-2" />Ir al inicio
              </Button>
              <Button onClick={this.handleReset}>
                <RefreshCw className="size-4 mr-2" />Reintentar
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
