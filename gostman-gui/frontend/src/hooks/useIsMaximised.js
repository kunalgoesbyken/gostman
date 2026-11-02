import { useCallback, useEffect, useState } from "react"
import { windowControls } from "../lib/windowControls"

export function useIsMaximised() {
  const [isMaximised, setIsMaximised] = useState(false)

  const refresh = useCallback(() => {
    Promise.resolve(windowControls.isMaximised()).then(setIsMaximised).catch(() => {})
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener("resize", refresh)
    return () => window.removeEventListener("resize", refresh)
  }, [refresh])

  return isMaximised
}
