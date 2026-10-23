const overflows = (strip) => strip.scrollWidth > strip.clientWidth

function nearestLeft(strip, start, width) {
  if (start < strip.scrollLeft) return start
  if (start + width > strip.scrollLeft + strip.clientWidth) return start + width - strip.clientWidth
  return strip.scrollLeft
}

export function scrollIntoStrip(item, { center = false, behavior = "auto" } = {}) {
  const strip = item.parentElement
  if (!overflows(strip)) return
  const start = item.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft
  const left = center ? start - (strip.clientWidth - item.offsetWidth) / 2 : nearestLeft(strip, start, item.offsetWidth)
  if (left !== strip.scrollLeft) strip.scrollTo({ left, behavior })
}
