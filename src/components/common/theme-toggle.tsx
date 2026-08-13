"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { SunIcon, MoonIcon } from "lucide-react"
import { useTheme } from "@/components/common/theme-provider"

export function ThemeToggle({
  icon,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { icon?: React.ReactNode }) {
  const { theme, setTheme } = useTheme()

  const [resolved, setResolved] = React.useState<"dark" | "light">(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : "light"
  )

  React.useEffect(() => {
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      const handler = () => setResolved(mq.matches ? "dark" : "light")
      handler()
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    }

    setResolved(theme === "dark" ? "dark" : "light")
  }, [theme])

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault()
    setTheme(resolved === "dark" ? "light" : "dark")
  }

  const defaultIcon = resolved === "dark" ? (
    <SunIcon />
  ) : (
    <MoonIcon />
  )

  return (
    <Button
      onClick={toggle}
      size="icon"
      variant="ghost"
      className={className}
      aria-label="Toggle theme"
      {...props}
    >
      {icon ?? defaultIcon}
    </Button>
  )
}

export default ThemeToggle
