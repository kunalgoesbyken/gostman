import { useEffect, useState } from "react"

const ACTIVE_LINE_PX = 96

function activeId(headings) {
  const passed = headings.filter((heading) => heading.getBoundingClientRect().top <= ACTIVE_LINE_PX)
  return (passed.at(-1) ?? headings[0])?.id ?? null
}

export function useActiveHeading(ids) {
  const [active, setActive] = useState(null)

  useEffect(() => {
    const headings = ids.map((id) => document.getElementById(id)).filter(Boolean)
    let frame = 0
    const update = () => {
      frame = 0
      setActive(activeId(headings))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [ids])

  return active
}
