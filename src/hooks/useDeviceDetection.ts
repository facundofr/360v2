import { useState, useEffect } from "react"

interface DeviceInfo {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  screenWidth: number
  screenHeight: number
  userAgent: string
  isIOS: boolean
  isAndroid: boolean
  orientation: "portrait" | "landscape"
}

export function useDeviceDetection(breakpoint = 768): DeviceInfo {
  const getInfo = (): DeviceInfo => {
    const ua = navigator.userAgent
    const w = window.innerWidth
    const h = window.innerHeight
    return {
      isMobile: w < breakpoint,
      isTablet: w >= breakpoint && w < 1024,
      isDesktop: w >= 1024,
      screenWidth: w,
      screenHeight: h,
      userAgent: ua,
      isIOS: /iPad|iPhone|iPod/.test(ua),
      isAndroid: /Android/.test(ua),
      orientation: w > h ? "landscape" : "portrait",
    }
  }

  const [info, setInfo] = useState<DeviceInfo>(getInfo)

  useEffect(() => {
    const handleResize = () => setInfo(getInfo())
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [breakpoint])  // eslint-disable-line

  return info
}
