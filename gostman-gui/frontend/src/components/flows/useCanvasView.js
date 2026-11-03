import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

const MIN_ZOOM = 0.25
const FIRST_ZOOM = 0.8
const READABLE_ZOOM = 0.6
const MAX_ZOOM = 2
const WHEEL_ZOOM = 0.0015
const VIEW_MARGIN = 24
const KEEP_VISIBLE = 80
const GLIDE_MS = 250
const CLICK_SLOP = 4
const PRIMARY_BUTTON = 0
const NODE_SELECTOR = "[data-step-node]"

export const ZOOM_STEP = 1.2
export const OVERLAYS = "[role=tooltip], [role=menu], [data-canvas-control]"

const views = new Map()

const clamp = (value, lowest, highest) => Math.min(Math.max(value, lowest), highest)

function fitView(layout, viewport) {
  const scale = clamp(Math.min((viewport.width - VIEW_MARGIN) / layout.width, (viewport.height - VIEW_MARGIN) / layout.height), MIN_ZOOM, 1)
  return { x: (viewport.width - layout.width * scale) / 2, y: Math.max(VIEW_MARGIN / 2, (viewport.height - layout.height * scale) / 2), scale }
}

function startView(layout, viewport) {
  const scale = clamp((viewport.width - VIEW_MARGIN) / layout.width, FIRST_ZOOM, 1)
  const start = layout.terminals.find((terminal) => terminal.start)
  return { x: viewport.width / 2 - (start.x + start.width / 2) * scale, y: 0, scale }
}

function firstView(layout, viewport) {
  const fitted = fitView(layout, viewport)
  return fitted.scale >= READABLE_ZOOM ? fitted : startView(layout, viewport)
}

function keptInView(view, layout, viewport) {
  const width = layout.width * view.scale
  const height = layout.height * view.scale
  return {
    scale: view.scale,
    x: clamp(view.x, KEEP_VISIBLE - width, viewport.width - KEEP_VISIBLE),
    y: clamp(view.y, KEEP_VISIBLE - height, viewport.height - KEEP_VISIBLE),
  }
}

function isOutOfView(box, view, viewport) {
  const left = view.x + box.x * view.scale
  const top = view.y + box.y * view.scale
  return left + box.width * view.scale <= 0 || left >= viewport.width || top + box.height * view.scale <= 0 || top >= viewport.height
}

const countOutOfView = (layout, view, viewport) => layout.nodes.filter((box) => isOutOfView(box, view, viewport)).length

function zoomedAt(view, point, factor) {
  const scale = clamp(view.scale * factor, MIN_ZOOM, MAX_ZOOM)
  const ratio = scale / view.scale
  return { scale, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio }
}

function nudge(start, size, room) {
  if (start >= VIEW_MARGIN && start + size <= room - VIEW_MARGIN) return 0
  if (start < VIEW_MARGIN || size > room - VIEW_MARGIN * 2) return VIEW_MARGIN - start
  return room - VIEW_MARGIN - (start + size)
}

const sameHeights = (current, measured) => (
  Object.keys(current).length === Object.keys(measured).length && Object.keys(measured).every((id) => current[id] === measured[id])
)

export function useMeasuredHeights(layerRef) {
  const [heights, setHeights] = useState({})
  const latest = useRef(heights)
  useLayoutEffect(() => {
    const layer = layerRef.current
    if (!layer) return undefined
    const elements = [...layer.querySelectorAll(NODE_SELECTOR)]
    const read = () => {
      const measured = Object.fromEntries(elements.map((element) => [element.dataset.stepNode, element.offsetHeight]))
      if (sameHeights(latest.current, measured)) return
      latest.current = measured
      setHeights(measured)
    }
    read()
    const observer = new ResizeObserver(read)
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  })
  return heights
}

function useViewportSize(viewportRef) {
  const [size, setSize] = useState(null)
  useLayoutEffect(() => {
    const element = viewportRef.current
    const update = () => setSize((current) => (
      current && current.width === element.clientWidth && current.height === element.clientHeight ? current : { width: element.clientWidth, height: element.clientHeight }
    ))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [viewportRef])
  return size
}

function useWheel(viewportRef, setView) {
  useEffect(() => {
    const element = viewportRef.current
    const onWheel = (event) => {
      if (event.target.closest(OVERLAYS)) return
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      if (event.ctrlKey || event.metaKey) {
        const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        setView((current) => current && zoomedAt(current, point, Math.exp(-event.deltaY * WHEEL_ZOOM)))
        return
      }
      const isSideways = event.shiftKey && event.deltaX === 0
      const dx = isSideways ? event.deltaY : event.deltaX
      const dy = isSideways ? 0 : event.deltaY
      setView((current) => current && { ...current, x: current.x - dx, y: current.y - dy })
    }
    element.addEventListener("wheel", onWheel, { passive: false })
    return () => element.removeEventListener("wheel", onWheel)
  }, [viewportRef, setView])
}

function pinched(view, { before, after, other, rect }) {
  const spread = Math.hypot(before.x - other.x, before.y - other.y)
  if (spread === 0) return view
  const middle = { x: (after.x + other.x) / 2 - rect.left, y: (after.y + other.y) / 2 - rect.top }
  return zoomedAt(view, middle, Math.hypot(after.x - other.x, after.y - other.y) / spread)
}

const dragged = (view, { before, after }) => ({ ...view, x: view.x + after.x - before.x, y: view.y + after.y - before.y })

function moveOf(pointers, event) {
  const before = pointers.get(event.pointerId)
  const after = { x: event.clientX, y: event.clientY }
  const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)?.[1]
  return { before, after, other, rect: event.currentTarget.getBoundingClientRect() }
}

function useDrag(setView, onBackground) {
  const gesture = useRef({ pointers: new Map(), start: null })
  return {
    onPointerDown: (event) => {
      if (event.button !== PRIMARY_BUTTON || event.target.closest(`button, a, ${OVERLAYS}`)) return
      event.currentTarget.setPointerCapture(event.pointerId)
      gesture.current.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      gesture.current.start = { x: event.clientX, y: event.clientY }
    },
    onPointerMove: (event) => {
      const { pointers } = gesture.current
      if (!pointers.has(event.pointerId)) return
      const move = moveOf(pointers, event)
      const change = move.other ? pinched : dragged
      setView((current) => current && change(current, move))
      pointers.set(event.pointerId, move.after)
    },
    onPointerUp: (event) => {
      const { pointers, start } = gesture.current
      const isClick = pointers.size === 1 && start && Math.hypot(event.clientX - start.x, event.clientY - start.y) < CLICK_SLOP
      pointers.delete(event.pointerId)
      if (isClick) onBackground()
    },
    onPointerCancel: (event) => gesture.current.pointers.delete(event.pointerId),
  }
}

export function useCanvasView(viewportRef, viewKey, layout, onBackground) {
  const viewport = useViewportSize(viewportRef)
  const [view, setStoredView] = useState(() => views.get(viewKey) || null)
  const [isGliding, setGliding] = useState(false)
  const latest = useRef({ layout, viewport })
  latest.current = { layout, viewport }

  const setView = useCallback((change, glide = false) => {
    setStoredView((current) => {
      const wanted = typeof change === "function" ? change(current) : change
      const next = wanted && latest.current.viewport ? keptInView(wanted, latest.current.layout, latest.current.viewport) : wanted
      views.set(viewKey, next)
      return next
    })
    if (!glide) return
    setGliding(true)
    setTimeout(() => setGliding(false), GLIDE_MS)
  }, [viewKey])

  useEffect(() => {
    if (!view && viewport) setView(firstView(layout, viewport))
  }, [view, viewport, layout, setView])

  useWheel(viewportRef, setView)
  const pointerHandlers = useDrag(setView, onBackground)

  const zoomBy = useCallback((factor) => {
    if (!viewport) return
    setView((current) => current && zoomedAt(current, { x: viewport.width / 2, y: viewport.height / 2 }, factor), true)
  }, [viewport, setView])

  const fit = useCallback(() => viewport && setView(fitView(layout, viewport), true), [layout, viewport, setView])

  const resetZoom = useCallback(() => view && zoomBy(1 / view.scale), [view, zoomBy])

  const reveal = useCallback((box) => {
    if (!box || !view || !viewport) return
    const shiftX = nudge(view.x + box.x * view.scale, box.width * view.scale, viewport.width)
    const shiftY = nudge(view.y + box.y * view.scale, box.height * view.scale, viewport.height)
    if (shiftX !== 0 || shiftY !== 0) setView({ ...view, x: view.x + shiftX, y: view.y + shiftY }, true)
  }, [view, viewport, setView])

  const onScroll = (event) => {
    const element = event.currentTarget
    const { scrollLeft, scrollTop } = element
    if (scrollLeft === 0 && scrollTop === 0) return
    element.scrollLeft = 0
    element.scrollTop = 0
    if (document.activeElement?.closest(NODE_SELECTOR)) return
    setView((current) => current && { ...current, x: current.x - scrollLeft, y: current.y - scrollTop })
  }

  const shown = view && viewport ? keptInView(view, layout, viewport) : null
  const hidden = shown ? countOutOfView(layout, shown, viewport) : 0
  return { view: shown, hidden, isGliding, zoomBy, fit, resetZoom, reveal, handlers: { ...pointerHandlers, onScroll } }
}
