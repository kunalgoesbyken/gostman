import { isBrowserAppleTouch } from "./detectOs"

const NO_INPUT_ZOOM = "maximum-scale=1"

export function preventInputZoom() {
  const meta = document.querySelector('meta[name="viewport"]')
  if (!meta || !isBrowserAppleTouch()) return undefined
  const original = meta.content
  meta.content = `${original}, ${NO_INPUT_ZOOM}`
  return () => {
    meta.content = original
  }
}
