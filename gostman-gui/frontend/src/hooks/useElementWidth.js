import { useLayoutEffect, useState } from "react"

export function useElementWidth(ref) {
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const measure = () => setWidth(element.offsetWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return width
}
