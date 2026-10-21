import { useCallback, useEffect, useRef, useState } from "react"

const MOUSE_THRESHOLD_PX = 5
const TOUCH_HOLD_MS = 320
const TOUCH_SLOP_PX = 10
const EDGE_PX = 32
const SCROLL_STEP_PX = 14
const SCROLL_INTERVAL_MS = 16
const PRIMARY_BUTTON = 0
const MOUSE = "mouse"

const distance = (session, event) => Math.hypot(event.clientX - session.startX, event.clientY - session.startY)

function scrollDirection(container, position, isVertical) {
  const { top, bottom, left, right } = container.getBoundingClientRect()
  const start = isVertical ? top : left
  const end = isVertical ? bottom : right
  if (position < start + EDGE_PX) return -1
  if (position > end - EDGE_PX) return 1
  return 0
}

export function usePointerDrag({ resolveDrop, onDrop, scrollRef, axis = "y" }) {
  const [drag, setDrag] = useState(null)
  const session = useRef(null)
  const latest = useRef({ resolveDrop, onDrop })
  latest.current = { resolveDrop, onDrop }

  const finish = useCallback(() => {
    const current = session.current
    if (!current) return
    clearTimeout(current.timer)
    clearInterval(current.scroller)
    session.current = null
    document.body.style.userSelect = ""
    setDrag(null)
  }, [])

  const suppressNextClick = useCallback(() => {
    const swallow = (event) => {
      event.stopPropagation()
      event.preventDefault()
    }
    window.addEventListener("click", swallow, { capture: true, once: true })
    setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0)
  }, [])

  const track = useCallback((point) => {
    const current = session.current
    const element = document.elementFromPoint(point.x, point.y)
    current.pointer = point
    current.drop = element ? latest.current.resolveDrop(element, point, current.source) : null
    setDrag({ source: current.source, drop: current.drop, point })
  }, [])

  const scrollBy = useCallback((current) => {
    const container = scrollRef?.current
    if (!container) return
    const isVertical = axis === "y"
    const step = scrollDirection(container, isVertical ? current.pointer.y : current.pointer.x, isVertical)
    if (step === 0) return
    if (isVertical) container.scrollTop += step * SCROLL_STEP_PX
    else container.scrollLeft += step * SCROLL_STEP_PX
    track(current.pointer)
  }, [axis, scrollRef, track])

  const activate = useCallback((point) => {
    const current = session.current
    if (!current || current.isActive) return
    current.isActive = true
    window.getSelection()?.removeAllRanges()
    document.body.style.userSelect = "none"
    current.scroller = setInterval(() => scrollBy(current), SCROLL_INTERVAL_MS)
    track(point)
  }, [scrollBy, track])

  const begin = useCallback((event, source) => {
    if (event.button !== PRIMARY_BUTTON || session.current) return
    const point = { x: event.clientX, y: event.clientY }
    const current = { source, startX: point.x, startY: point.y, pointerType: event.pointerType || MOUSE, isActive: false, pointer: point, drop: null }
    session.current = current
    if (current.pointerType !== MOUSE) current.timer = setTimeout(() => activate(point), TOUCH_HOLD_MS)
  }, [activate])

  useEffect(() => {
    const handleMove = (event) => {
      const current = session.current
      if (!current) return
      const point = { x: event.clientX, y: event.clientY }
      if (current.isActive) {
        track(point)
        return
      }
      const moved = distance(current, event)
      if (current.pointerType === MOUSE && moved > MOUSE_THRESHOLD_PX) activate(point)
      else if (current.pointerType !== MOUSE && moved > TOUCH_SLOP_PX) finish()
    }
    const handleUp = () => {
      const current = session.current
      if (!current) return
      finish()
      if (!current.isActive) return
      suppressNextClick()
      if (current.drop) latest.current.onDrop(current.source, current.drop)
    }
    const handleKey = (event) => {
      if (event.key === "Escape" && session.current) finish()
    }
    const blockTouchScroll = (event) => {
      if (session.current?.isActive && event.cancelable) event.preventDefault()
    }
    const blockMenu = (event) => {
      if (session.current?.isActive) event.preventDefault()
    }
    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    window.addEventListener("pointercancel", finish)
    window.addEventListener("keydown", handleKey)
    window.addEventListener("contextmenu", blockMenu)
    document.addEventListener("touchmove", blockTouchScroll, { passive: false })
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
      window.removeEventListener("pointercancel", finish)
      window.removeEventListener("keydown", handleKey)
      window.removeEventListener("contextmenu", blockMenu)
      document.removeEventListener("touchmove", blockTouchScroll)
      finish()
    }
  }, [activate, finish, suppressNextClick, track])

  return { drag, begin }
}
