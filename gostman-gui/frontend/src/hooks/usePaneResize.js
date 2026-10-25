import { useEffect, useRef, useState } from "react"
import { clamp, paneWidthStyle, paneWidthValue, rememberPaneWidth, rememberedPaneWidth, widestPaneFor } from "../lib/layout"
import { isRtl } from "./direction"

const KEY_STEP_PX = 16
const PRIMARY_BUTTON = 0

export const RESIZE_IDLE = "idle"
const RESIZE_ACTIVE = "active"
export const RESIZE_CLOSING = "closing"

export const EDGE_END = "end"
export const EDGE_START = "start"

const inlineSign = () => (isRtl() ? -1 : 1)

const growthSign = (edge) => (edge === EDGE_END ? 1 : -1) * inlineSign()

const keyTargets = (edge, min) => ({
  ArrowLeft: (width) => width - growthSign(edge) * KEY_STEP_PX,
  ArrowRight: (width) => width + growthSign(edge) * KEY_STEP_PX,
  Home: () => min,
  End: (width, widest) => widest,
})

const shownWidth = (pane) => Math.round(pane.getBoundingClientRect().width)

function holdResizeCursor(isHeld) {
  document.body.style.cursor = isHeld ? "col-resize" : ""
  document.body.style.userSelect = isHeld ? "none" : ""
}

export function usePaneResize(pane, edge, onClose) {
  const paneRef = useRef(null)
  const dragRef = useRef(null)
  const [width, setWidth] = useState(() => rememberedPaneWidth(pane))
  const [phase, setPhase] = useState(RESIZE_IDLE)
  const closeBelow = pane.min / 2
  const widestFor = (element) => widestPaneFor(pane, element.parentElement.clientWidth)

  useEffect(() => () => {
    if (dragRef.current) holdResizeCursor(false)
  }, [])

  const commit = (next) => {
    setWidth(next)
    rememberPaneWidth(pane, next)
  }

  const preview = (next) => paneRef.current.style.setProperty(pane.widthVar, paneWidthValue(pane, next))

  const onPointerDown = (event) => {
    if (event.button !== PRIMARY_BUTTON || dragRef.current) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const element = paneRef.current
    const startWidth = shownWidth(element)
    dragRef.current = { startX: event.clientX, startWidth, width: startWidth, widest: widestFor(element), willClose: false }
    holdResizeCursor(true)
    setPhase(RESIZE_ACTIVE)
  }

  const onPointerMove = (event) => {
    const drag = dragRef.current
    if (!drag) return
    const wanted = drag.startWidth + growthSign(edge) * (event.clientX - drag.startX)
    drag.willClose = Boolean(onClose) && wanted < closeBelow
    drag.width = clamp(wanted, pane.min, drag.widest)
    preview(drag.width)
    setPhase(drag.willClose ? RESIZE_CLOSING : RESIZE_ACTIVE)
  }

  const finishDrag = () => {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    holdResizeCursor(false)
    setPhase(RESIZE_IDLE)
    if (drag.willClose) onClose()
    else if (drag.width !== drag.startWidth) commit(drag.width)
  }

  const onKeyDown = (event) => {
    const target = keyTargets(edge, pane.min)[event.key]
    if (!target) return
    event.preventDefault()
    const element = paneRef.current
    const widest = widestFor(element)
    commit(clamp(target(shownWidth(element), widest), pane.min, widest))
  }

  const separatorProps = {
    role: "separator",
    tabIndex: 0,
    "aria-orientation": "vertical",
    "aria-valuemin": pane.min,
    "aria-valuemax": pane.max,
    "aria-valuenow": width,
    onPointerDown,
    onPointerMove,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    onLostPointerCapture: finishDrag,
    onKeyDown,
    onDoubleClick: () => commit(pane.fallback),
  }

  return { paneRef, style: paneWidthStyle(pane, width), phase, separatorProps }
}
