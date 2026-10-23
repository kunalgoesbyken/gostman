import { useEffect, useMemo, useRef } from "react"

const RESET_DELAY_MS = 700

export function useTypeahead() {
  const typed = useRef("")
  const timer = useRef(0)

  useEffect(() => () => clearTimeout(timer.current), [])

  return useMemo(() => ({
    isTyping: () => typed.current !== "",
    type: (character) => {
      clearTimeout(timer.current)
      typed.current += character
      timer.current = setTimeout(() => {
        typed.current = ""
      }, RESET_DELAY_MS)
      return typed.current
    },
  }), [])
}
