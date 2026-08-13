import { useEffect, useRef, useCallback } from "react"
import axios from "axios"
import { ENDPOINTS } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

interface HeartbeatOptions {
  interval?: number
  enabled?: boolean
  currentPage?: string
}

export function useHeartbeat(options: HeartbeatOptions = {}) {
  const {
    interval = 30000,
    enabled = true,
    currentPage = window.location.pathname,
  } = options

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastHeartbeatRef = useRef<number | null>(null)

  const sendHeartbeat = useCallback(
    async (page = currentPage, action = "heartbeat") => {
      try {
        const token = getAuthToken()
        if (!token) return false

        const now = Date.now()
        if (lastHeartbeatRef.current && now - lastHeartbeatRef.current < 25000) {
          return false
        }

        const response = await axios.post(
          `${ENDPOINTS.ADMIN}/users/heartbeat`,
          { page, action, timestamp: new Date().toISOString() },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: 5000,
          }
        )

        if (response.data.success) {
          lastHeartbeatRef.current = now
          return true
        }
        return false
      } catch (error: unknown) {
        if (
          axios.isAxiosError(error) &&
          error.response?.status === 401
        ) {
          localStorage.removeItem("cober_token")
          window.location.assign("/login")
        }
        return false
      }
    },
    [currentPage]
  )

  const startHeartbeat = useCallback(() => {
    if (!enabled) return
    sendHeartbeat(currentPage, "page_enter")
    intervalRef.current = setInterval(() => {
      sendHeartbeat()
    }, interval)
  }, [enabled, sendHeartbeat, currentPage, interval])

  const stopHeartbeat = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (enabled) startHeartbeat()
    return () => stopHeartbeat()
  }, [enabled, startHeartbeat, stopHeartbeat])

  return { sendHeartbeat, startHeartbeat, stopHeartbeat }
}
