import { useEffect, useRef, useCallback } from "react"
import axios from "axios"
import { API_URL } from "@/lib/config"
import { getAuthToken } from "@/lib/auth"

export function useUserActivity(intervalMinutes = 2) {
  const lastActivityRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sendHeartbeat = useCallback(async () => {
    try {
      const token = getAuthToken()
      if (!token) return
      await axios.post(
        `${API_URL}/admin/users/heartbeat`,
        {
          page: window.location.pathname,
          action: "activity",
          timestamp: new Date().toISOString(),
        },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 }
      )
    } catch {
      // silencioso
    }
  }, [])

  useEffect(() => {
    lastActivityRef.current = Date.now()

    const updateActivity = () => {
      lastActivityRef.current = Date.now()
    }

    window.addEventListener("mousemove", updateActivity)
    window.addEventListener("keydown", updateActivity)
    window.addEventListener("click", updateActivity)

    intervalRef.current = setInterval(() => {
      const now = Date.now()
      const idleMs = now - lastActivityRef.current
      const intervalMs = intervalMinutes * 60 * 1000
      if (idleMs < intervalMs) {
        sendHeartbeat()
      }
    }, intervalMinutes * 60 * 1000)

    return () => {
      window.removeEventListener("mousemove", updateActivity)
      window.removeEventListener("keydown", updateActivity)
      window.removeEventListener("click", updateActivity)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [intervalMinutes, sendHeartbeat])
}
