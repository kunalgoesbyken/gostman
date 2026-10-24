import { useRef, useState, useSyncExternalStore } from "react"
import { parseJSON } from "../lib/dataUtils"
import { readStored, removeStored, writeStored } from "../lib/storage"

const STORAGE_PREFIX = "gostman.window."
const MARGIN_PX = 8
const KEY_STEP_PX = 16
const DEFAULT_MIN_WIDTH_PX = 360
const DEFAULT_MIN_HEIGHT_PX = 240
const PRIMARY_BUTTON = 0
const COMPACT_QUERY = "(max-width: 639px)"
const MOVE = "move"
const START = "start"
const END = "end"
const RECT_KEYS = ["x", "y", "width", "height"]
const CONTROLS = "a, button, input, select, textarea, label, [role=radio], [role=tab], [contenteditable=true]"
const ARROWS = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } }
const EDGE_SIDES = { n: ["y", START], s: ["y", END], w: ["x", START], e: ["x", END] }
const AXES = { x: { size: "width", min: "minWidth" }, y: { size: "height", min: "minHeight" } }

export const RESIZE_EDGES = ["n", "e", "s", "w", "ne", "se", "sw", "nw"]

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const ignoreChanges = () => () => {}

function subscribeToResize(onChange) {
  window.addEventListener("resize", onChange)
  return () => window.removeEventListener("resize", onChange)
}

function subscribeToCompact(onChange) {
  const media = window.matchMedia(COMPACT_QUERY)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

const viewportWidth = () => window.innerWidth
const viewportHeight = () => window.innerHeight
const isCompact = () => window.matchMedia(COMPACT_QUERY).matches
const emptyViewport = () => 0
const compactOnServer = () => true

function readRect(id) {
  const rect = parseJSON(readStored(STORAGE_PREFIX + id) ?? "", null)
  if (!RECT_KEYS.every((key) => Number.isFinite(rect?.[key]))) return null
  return Object.fromEntries(RECT_KEYS.map((key) => [key, rect[key]]))
}

const rememberRect = (id, rect) => writeStored(STORAGE_PREFIX + id, JSON.stringify(rect))

const forgetRect = (id) => removeStored(STORAGE_PREFIX + id)

function fitted(rect, viewport, limits) {
  const roomWidth = viewport.width - MARGIN_PX * 2
  const roomHeight = viewport.height - MARGIN_PX * 2
  const width = Math.round(clamp(rect.width, Math.min(limits.minWidth, roomWidth), roomWidth))
  const height = Math.round(clamp(rect.height, Math.min(limits.minHeight, roomHeight), roomHeight))
  return {
    x: Math.round(clamp(rect.x, MARGIN_PX, viewport.width - MARGIN_PX - width)),
    y: Math.round(clamp(rect.y, MARGIN_PX, viewport.height - MARGIN_PX - height)),
    width,
    height,
  }
}

const centred = ({ width, height }, viewport, limits) =>
  fitted({ width, height, x: (viewport.width - width) / 2, y: (viewport.height - height) / 2 }, viewport, limits)

const moved = (rect, delta, viewport, limits) => fitted({ ...rect, x: rect.x + delta.x, y: rect.y + delta.y }, viewport, limits)

function resizedSpan(position, size, delta, side, minSize, extent) {
  if (side === END) return { position, size: clamp(size + delta, minSize, extent - MARGIN_PX - position) }
  const end = position + size
  const start = clamp(position + delta, MARGIN_PX, end - minSize)
  return { position: start, size: end - start }
}

function resized(rect, edge, delta, viewport, limits) {
  const next = [...edge].reduce((current, letter) => {
    const [axis, side] = EDGE_SIDES[letter]
    const { size, min } = AXES[axis]
    const span = resizedSpan(current[axis], current[size], delta[axis], side, limits[min], viewport[size])
    return { ...current, [axis]: span.position, [size]: span.size }
  }, rect)
  return fitted(next, viewport, limits)
}

const startsOnControl = (event) => Boolean(event.target.closest(CONTROLS))

export function useFloatingWindow(options) {
  const isRequested = Boolean(options)
  const compact = useSyncExternalStore(isRequested ? subscribeToCompact : ignoreChanges, isCompact, compactOnServer)
  const width = useSyncExternalStore(isRequested ? subscribeToResize : ignoreChanges, viewportWidth, emptyViewport)
  const height = useSyncExternalStore(isRequested ? subscribeToResize : ignoreChanges, viewportHeight, emptyViewport)
  const [chosen, setChosen] = useState(() => (isRequested ? readRect(options.id) : null))
  const gesture = useRef(null)
  if (!isRequested || compact) return null

  const viewport = { width, height }
  const limits = { minWidth: options.minWidth ?? DEFAULT_MIN_WIDTH_PX, minHeight: options.minHeight ?? DEFAULT_MIN_HEIGHT_PX }
  const rect = chosen ? fitted(chosen, viewport, limits) : centred(options, viewport, limits)

  const choose = (next) => {
    setChosen(next)
    rememberRect(options.id, next)
  }

  const restore = () => {
    setChosen(null)
    forgetRect(options.id)
  }

  const begin = (edge) => (event) => {
    if (event.button !== PRIMARY_BUTTON) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = { edge, originX: event.clientX, originY: event.clientY, rect, latest: null }
  }

  const track = (event) => {
    const current = gesture.current
    if (!current) return
    const delta = { x: event.clientX - current.originX, y: event.clientY - current.originY }
    current.latest = current.edge === MOVE
      ? moved(current.rect, delta, viewport, limits)
      : resized(current.rect, current.edge, delta, viewport, limits)
    setChosen(current.latest)
  }

  const finish = () => {
    const current = gesture.current
    gesture.current = null
    if (current?.latest) rememberRect(options.id, current.latest)
  }

  const nudge = (event) => {
    if (event.key === "Home") {
      event.preventDefault()
      restore()
      return
    }
    const direction = ARROWS[event.key]
    if (!direction || event.altKey || event.ctrlKey || event.metaKey) return
    event.preventDefault()
    const delta = { x: direction.x * KEY_STEP_PX, y: direction.y * KEY_STEP_PX }
    choose(event.shiftKey ? resized(rect, direction.x ? "e" : "s", delta, viewport, limits) : moved(rect, delta, viewport, limits))
  }

  const dragProps = (edge) => ({ onPointerDown: begin(edge), onPointerMove: track, onLostPointerCapture: finish })
  const moveProps = dragProps(MOVE)

  return {
    style: { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
    gripProps: { ...moveProps, onKeyDown: nudge },
    edgeProps: dragProps,
    headerProps: {
      ...moveProps,
      onPointerDown: (event) => {
        if (!startsOnControl(event)) moveProps.onPointerDown(event)
      },
      onDoubleClick: (event) => {
        if (!startsOnControl(event)) restore()
      },
    },
  }
}
