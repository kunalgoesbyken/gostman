const HINT_WIDTH = 256
const HINT_HEIGHT = 120
const GAP = 10
const MARGIN = 8

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max))

function opensAbove(tile, wrapper, viewportHeight) {
  const needed = HINT_HEIGHT + GAP
  const roomBelow = viewportHeight - tile.bottom
  const roomAbove = tile.top
  if (roomBelow < needed && roomAbove >= needed) return true
  if (roomAbove < needed && roomBelow >= needed) return false
  return tile.top + tile.height / 2 > wrapper.top + wrapper.height / 2
}

export function placeHint(tile, wrapper, viewport) {
  const width = Math.min(HINT_WIDTH, viewport.width - MARGIN * 2)
  const centre = tile.left + tile.width / 2
  const left = clamp(centre - width / 2, MARGIN, viewport.width - width - MARGIN) - wrapper.left
  if (opensAbove(tile, wrapper, viewport.height)) return { width, left, bottom: wrapper.bottom - tile.top + GAP }
  return { width, left, top: tile.bottom - wrapper.top + GAP }
}
