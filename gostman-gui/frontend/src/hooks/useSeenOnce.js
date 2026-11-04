import { useEffect, useState } from "react"

export function useSeenOnce(ref) {
  const [isSeen, setIsSeen] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setIsSeen(true)
        observer.disconnect()
      },
      { rootMargin: "0px 0px -10% 0px" }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])

  return isSeen
}
