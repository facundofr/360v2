import { useState, useEffect, useCallback } from "react"

export function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(!document.hidden)

  const handleChange = useCallback(() => setIsVisible(!document.hidden), [])
  const setVisible   = useCallback(() => setIsVisible(true), [])
  const setHidden    = useCallback(() => setIsVisible(false), [])

  useEffect(() => {
    document.addEventListener("visibilitychange", handleChange)
    window.addEventListener("focus", setVisible)
    window.addEventListener("blur",  setHidden)
    return () => {
      document.removeEventListener("visibilitychange", handleChange)
      window.removeEventListener("focus", setVisible)
      window.removeEventListener("blur",  setHidden)
    }
  }, [handleChange, setVisible, setHidden])

  return isVisible
}

export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [breakpoint])

  return isMobile
}
