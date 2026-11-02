import { useEffect, useRef, useState } from "react"
import { BLOCK_AXIS, clamp, paneWidthStyle, paneWidthValue, rememberPaneWidth, rememberedPaneWidth, widestPaneFor } from "../lib/layout"
import { isRtl } from "./direction"

const KEY_STEP_PX = 16
const PRIMARY_BUTTON = 0

export const RESIZE_IDLE = "idle"
const RESIZE_ACTIVE = "active"
export const RESIZE_CLOSING = "closing"

export const EDGE_END = "end"
export const EDGE_START = "start"

const inlineSign = () => (isRtl() ? -1 : 1)

const isBlock = (pane) => pane.axis === BLOCK_AXIS

const growthSign = (pane, edge) => (edge === EDGE_END ? 1 : -1) * (isBlock(pane) ? 1 : inlineSign())

const keyTargets = (pane, edge) => {
  const step = growthSign(pane, edge) * KEY_STEP_PX
  const [shrinkKey, growKey] = isBlock(pane) ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"]
  return {
    [shrinkKey]: (size) => size - step,
    [growKey]: (size) => size + step,
    Home: () => pane.min,
    End: (size, widest) => widest,
  }
}

const shownSize = (pane, element) => Math.round(element.getBoundingClientRect()[isBlock(pane) ? "height" : "width"])

const containerSize = (pane, element) => element.parentElement[isBlock(pane) ? "clientHeight" : "clientWidth"]

const pointerOffset = (pane, event) => (isBlock(pane) ? event.clientY : event.clientX)

const resizeCursor = (pane) => (isBlock(pane) ? "row-resize" : "col-resize")

function holdResizeCursor(pane, isHeld) {
  document.body.style.cursor = isHeld ? resizeCursor(pane) : ""
  document.body.style.userSelect = isHeld ? "none" : ""
}

export function usePaneResize(pane, edge, onClose) {
  const paneRef = useRef(null)
  const dragRef = useRef(null)
  const [width, setWidth] = useState(() => rememberedPaneWidth(pane))
  const [phase, setPhase] = useState(RESIZE_IDLE)
  const closeBelow = pane.min / 2
  const widestFor = (element) => widestPaneFor(pane, containerSize(pane, element))

  useEffect(() => () => {
    if (dragRef.current) holdResizeCursor(pane, false)
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
    const startWidth = shownSize(pane, element)
    dragRef.current = { startX: pointerOffset(pane, event), startWidth, width: startWidth, widest: widestFor(element), willClose: false }
    holdResizeCursor(pane, true)
    setPhase(RESIZE_ACTIVE)
  }

  const onPointerMove = (event) => {
    const drag = dragRef.current
    if (!drag) return
    const wanted = drag.startWidth + growthSign(pane, edge) * (pointerOffset(pane, event) - drag.startX)
    drag.willClose = Boolean(onClose) && wanted < closeBelow
    drag.width = clamp(wanted, pane.min, drag.widest)
    preview(drag.width)
    setPhase(drag.willClose ? RESIZE_CLOSING : RESIZE_ACTIVE)
  }

  const finishDrag = () => {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    holdResizeCursor(pane, false)
    setPhase(RESIZE_IDLE)
    if (drag.willClose) onClose()
    else if (drag.width !== drag.startWidth) commit(drag.width)
  }

  const onKeyDown = (event) => {
    const target = keyTargets(pane, edge)[event.key]
    if (!target) return
    event.preventDefault()
    const element = paneRef.current
    const widest = widestFor(element)
    commit(clamp(target(shownSize(pane, element), widest), pane.min, widest))
  }

  const separatorProps = {
    role: "separator",
    tabIndex: 0,
    "aria-orientation": isBlock(pane) ? "horizontal" : "vertical",
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
