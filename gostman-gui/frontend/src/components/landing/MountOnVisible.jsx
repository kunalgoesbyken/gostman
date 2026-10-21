import { useEffect, useRef, useState } from "react"

const ROOT_MARGIN = "600px 0px"

export function MountOnVisible({ children, minHeight = 320 }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(typeof IntersectionObserver === "undefined")

  useEffect(() => {
    if (visible) return undefined
    const node = ref.current
    if (!node) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setVisible(true)
        observer.disconnect()
      },
      { rootMargin: ROOT_MARGIN }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [visible])

  if (visible) return children
  return <div ref={ref} style={{ minHeight }} aria-hidden="true" />
}
