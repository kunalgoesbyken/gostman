const HORIZONTAL = 'horizontal'
const VERTICAL = 'vertical'

export const ORIENTATION = { horizontal: HORIZONTAL, vertical: VERTICAL, both: 'both' }

const STEPS = {
  ArrowLeft: { axis: HORIZONTAL, step: -1 },
  ArrowRight: { axis: HORIZONTAL, step: 1 },
  ArrowUp: { axis: VERTICAL, step: -1 },
  ArrowDown: { axis: VERTICAL, step: 1 },
}

export const hasModifier = (event) => event.altKey || event.ctrlKey || event.metaKey || event.shiftKey

const isRightToLeft = (element) => getComputedStyle(element).direction === 'rtl'

function stepFor(event, orientation) {
  const move = STEPS[event.key]
  if (!move || (orientation !== ORIENTATION.both && move.axis !== orientation)) return 0
  return move.axis === HORIZONTAL && isRightToLeft(event.currentTarget) ? -move.step : move.step
}

function targetIndex(event, index, count, orientation) {
  if (event.key === 'Home') return 0
  if (event.key === 'End') return count - 1
  const step = stepFor(event, orientation)
  return step === 0 ? -1 : (index + step + count) % count
}

const enabledItems = (container, selector) => [...container.querySelectorAll(selector)].filter((item) => !item.disabled)

export function moveFocus(event, { selector, orientation, activate = false }) {
  if (hasModifier(event)) return
  const items = enabledItems(event.currentTarget, selector)
  const index = items.indexOf(event.target.closest(selector))
  if (index < 0) return
  const next = targetIndex(event, index, items.length, orientation)
  if (next < 0) return
  event.preventDefault()
  if (next === index) return
  items[next].focus()
  if (activate) items[next].click()
}

export const isFocusLost = () => !document.activeElement || document.activeElement === document.body

export const tabStopOf = (values, current) => (values.includes(current) ? current : values[0])
