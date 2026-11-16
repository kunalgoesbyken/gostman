const MAX_SLOT_PX = 10
const BAR_SHARE = 0.75
const SHIFT_LIMIT_PX = 24
const SEARCH_STEPS = 20
const ROUNDING_PX = 1e-6

const barWidthOf = (slot) => Math.max(1, slot * BAR_SHARE)

function nondecreasing(values) {
  const blocks = []
  for (const value of values) {
    let block = { sum: value, count: 1 }
    while (blocks.length > 0 && blocks.at(-1).sum / blocks.at(-1).count > block.sum / block.count) {
      const last = blocks.pop()
      block = { sum: last.sum + block.sum, count: last.count + block.count }
    }
    blocks.push(block)
  }
  return blocks.flatMap((block) => Array(block.count).fill(block.sum / block.count))
}

function placeBars(centers, slot, start, end) {
  const last = Math.max(start, end - (centers.length - 1) * slot)
  return nondecreasing(centers.map((center, index) => center - index * slot))
    .map((shifted, index) => Math.min(last, Math.max(start, shifted)) + index * slot)
}

function layoutWith(centers, slot, left, right) {
  const width = barWidthOf(slot)
  const end = right - width / 2
  const positions = placeBars(centers, slot, left + width / 2, end)
  const fits = positions.every((position, index) => position <= end + ROUNDING_PX && Math.abs(position - centers[index]) <= SHIFT_LIMIT_PX)
  return fits ? { positions, width } : null
}

export function layoutBars(centers, { left, right }) {
  let low = 0
  let high = Math.min(MAX_SLOT_PX, (right - left) / Math.max(1, centers.length))
  const widest = layoutWith(centers, high, left, right)
  if (widest) return widest
  let best = layoutWith(centers, low, left, right) ?? { positions: centers, width: barWidthOf(low) }
  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const middle = (low + high) / 2
    const layout = layoutWith(centers, middle, left, right)
    if (layout) {
      best = layout
      low = middle
    } else {
      high = middle
    }
  }
  return best
}

export function nearestIndex(positions, x) {
  let low = 0
  let high = positions.length - 1
  if (high < 0) return null
  while (low < high) {
    const middle = (low + high) >> 1
    if (positions[middle] < x) low = middle + 1
    else high = middle
  }
  if (low > 0 && x - positions[low - 1] <= positions[low] - x) return low - 1
  return low
}
