const ROUNDING_PX = 0.5

function fitCount(widths, room, gap) {
  let used = 0
  let count = 0
  for (const width of widths) {
    used += (count > 0 ? gap : 0) + width
    if (used > room + ROUNDING_PX) break
    count += 1
  }
  return count
}

export function visibleIndexes({ widths, moreWidth, room, gap, activeIndex }) {
  const indexes = widths.map((_, index) => index)
  if (fitCount(widths, room, gap) === widths.length) return indexes
  const roomBesideMore = room - moreWidth - gap
  const shown = indexes.slice(0, fitCount(widths, roomBesideMore, gap))
  if (activeIndex < 0 || shown.includes(activeIndex)) return shown
  const fitsWithActive = () => fitCount([...shown, activeIndex].map((index) => widths[index]), roomBesideMore, gap) === shown.length + 1
  while (shown.length > 0 && !fitsWithActive()) shown.pop()
  return [...shown, activeIndex]
}
