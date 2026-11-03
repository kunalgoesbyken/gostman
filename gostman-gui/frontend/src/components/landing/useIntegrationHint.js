import { useEffect, useRef, useState } from "react"
import { placeHint } from "./hintPlacement"

const isPointer = (event) => event.pointerType === "mouse" || event.pointerType === "pen"
const isTouch = (event) => event.pointerType === "touch"

const TILE_ATTRIBUTE = "data-integration"

export function useIntegrationHint() {
  const wrapperRef = useRef(null)
  const touchReveal = useRef(false)
  const [hint, setHint] = useState(null)
  const shown = hint !== null

  const hide = () => setHint(null)

  const show = (tool, element) => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const viewport = { width: document.documentElement.clientWidth, height: window.innerHeight }
    setHint({ tool, position: placeHint(element.getBoundingClientRect(), wrapper.getBoundingClientRect(), viewport) })
  }

  useEffect(() => {
    if (!shown) return undefined
    const closeOnEscape = (event) => event.key === "Escape" && setHint(null)
    const closeOutside = (event) => !event.target.closest?.(`[${TILE_ATTRIBUTE}]`) && setHint(null)
    const close = () => setHint(null)
    document.addEventListener("keydown", closeOnEscape)
    document.addEventListener("pointerdown", closeOutside)
    window.addEventListener("resize", close)
    return () => {
      document.removeEventListener("keydown", closeOnEscape)
      document.removeEventListener("pointerdown", closeOutside)
      window.removeEventListener("resize", close)
    }
  }, [shown])

  const tileProps = (tool) => ({
    [TILE_ATTRIBUTE]: "",
    onPointerEnter: (event) => isPointer(event) && show(tool, event.currentTarget),
    onPointerLeave: (event) => isPointer(event) && hide(),
    onPointerDown: (event) => {
      touchReveal.current = isTouch(event) && hint?.tool.brand !== tool.brand
      if (isTouch(event)) show(tool, event.currentTarget)
    },
    onPointerCancel: () => {
      touchReveal.current = false
    },
    onKeyDown: () => {
      touchReveal.current = false
    },
    onClick: (event) => {
      if (!touchReveal.current) return
      touchReveal.current = false
      event.preventDefault()
    },
    onFocus: (event) => show(tool, event.currentTarget),
    onBlur: hide,
  })

  return { wrapperRef, hint, tileProps }
}
