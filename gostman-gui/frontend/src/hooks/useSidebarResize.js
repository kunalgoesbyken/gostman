import { useEffect, useRef, useState } from "react"
import {
  SIDEBAR_DEFAULT_WIDTH_PX,
  SIDEBAR_MAX_WIDTH_PX,
  SIDEBAR_MIN_WIDTH_PX,
  SIDEBAR_WIDTH_VAR,
  clamp,
  rememberSidebarWidth,
  rememberedSidebarWidth,
  sidebarWidthStyle,
  sidebarWidthValue,
  widestSidebarFor,
} from "../lib/layout"
import { isRtl } from "./direction"

const KEY_STEP_PX = 16
const CLOSE_BELOW_PX = SIDEBAR_MIN_WIDTH_PX / 2
const PRIMARY_BUTTON = 0

export const RESIZE_IDLE = "idle"
const RESIZE_ACTIVE = "active"
export const RESIZE_CLOSING = "closing"

const inlineSign = () => (isRtl() ? -1 : 1)

const KEY_TARGETS = {
  ArrowLeft: (width) => width - inlineSign() * KEY_STEP_PX,
  ArrowRight: (width) => width + inlineSign() * KEY_STEP_PX,
  Home: () => SIDEBAR_MIN_WIDTH_PX,
  End: (width, widest) => widest,
}

const shownWidth = (aside) => Math.round(aside.getBoundingClientRect().width)

const widestFor = (aside) => widestSidebarFor(aside.parentElement.clientWidth)

function holdResizeCursor(isHeld) {
  document.body.style.cursor = isHeld ? "col-resize" : ""
  document.body.style.userSelect = isHeld ? "none" : ""
}

export function useSidebarResize(onClose) {
  const asideRef = useRef(null)
  const dragRef = useRef(null)
  const [width, setWidth] = useState(rememberedSidebarWidth)
  const [phase, setPhase] = useState(RESIZE_IDLE)

  useEffect(() => () => {
    if (dragRef.current) holdResizeCursor(false)
  }, [])

  const commit = (next) => {
    setWidth(next)
    rememberSidebarWidth(next)
  }

  const preview = (next) => asideRef.current.style.setProperty(SIDEBAR_WIDTH_VAR, sidebarWidthValue(next))

  const onPointerDown = (event) => {
    if (event.button !== PRIMARY_BUTTON || dragRef.current) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const aside = asideRef.current
    const startWidth = shownWidth(aside)
    dragRef.current = { startX: event.clientX, startWidth, width: startWidth, widest: widestFor(aside), willClose: false }
    holdResizeCursor(true)
    setPhase(RESIZE_ACTIVE)
  }

  const onPointerMove = (event) => {
    const drag = dragRef.current
    if (!drag) return
    const wanted = drag.startWidth + inlineSign() * (event.clientX - drag.startX)
    drag.willClose = wanted < CLOSE_BELOW_PX
    drag.width = clamp(wanted, SIDEBAR_MIN_WIDTH_PX, drag.widest)
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
    const target = KEY_TARGETS[event.key]
    if (!target) return
    event.preventDefault()
    const aside = asideRef.current
    const widest = widestFor(aside)
    commit(clamp(target(shownWidth(aside), widest), SIDEBAR_MIN_WIDTH_PX, widest))
  }

  const separatorProps = {
    role: "separator",
    tabIndex: 0,
    "aria-orientation": "vertical",
    "aria-valuemin": SIDEBAR_MIN_WIDTH_PX,
    "aria-valuemax": SIDEBAR_MAX_WIDTH_PX,
    "aria-valuenow": width,
    onPointerDown,
    onPointerMove,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    onLostPointerCapture: finishDrag,
    onKeyDown,
    onDoubleClick: () => commit(SIDEBAR_DEFAULT_WIDTH_PX),
  }

  return { asideRef, style: sidebarWidthStyle(width), phase, separatorProps }
}
