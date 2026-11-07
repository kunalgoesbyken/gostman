import { useLayoutEffect, useState } from "react"

const SEPARATOR = "\n"

let measuringContext = null

const contextFor = (style) => {
  measuringContext ??= document.createElement("canvas").getContext("2d")
  measuringContext.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  return measuringContext
}

const roomInside = (element, style) => element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)

function fittingIndex(element, candidates) {
  const style = getComputedStyle(element)
  const context = contextFor(style)
  const room = roomInside(element, style)
  const index = candidates.findIndex((text) => context.measureText(text).width <= room)
  return index === -1 ? candidates.length - 1 : index
}

export function useFittingText(ref, candidates) {
  const [index, setIndex] = useState(0)
  const key = candidates.join(SEPARATOR)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const texts = key.split(SEPARATOR)
    const fit = () => setIndex(fittingIndex(element, texts))
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    document.fonts?.addEventListener("loadingdone", fit)
    return () => {
      observer.disconnect()
      document.fonts?.removeEventListener("loadingdone", fit)
    }
  }, [ref, key])

  return candidates[index]
}
