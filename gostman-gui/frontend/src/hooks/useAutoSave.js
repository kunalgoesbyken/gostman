import { useCallback, useEffect, useRef } from "react"

const NOT_TRACKED = Symbol("not-tracked")

export function useAutoSave(value, save, delayMs = 0) {
  const savedValue = useRef(NOT_TRACKED)
  const latestValue = useRef(value)
  latestValue.current = value

  const flush = useCallback(() => {
    if (savedValue.current === latestValue.current) return
    savedValue.current = latestValue.current
    save(latestValue.current)
  }, [save])

  useEffect(() => {
    if (savedValue.current === NOT_TRACKED) {
      savedValue.current = value
      return undefined
    }
    const timer = setTimeout(flush, delayMs)
    return () => clearTimeout(timer)
  }, [value, flush, delayMs])

  useEffect(() => {
    window.addEventListener("pagehide", flush)
    return () => {
      window.removeEventListener("pagehide", flush)
      flush()
    }
  }, [flush])
}
