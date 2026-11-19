const WINDOW_ATTRIBUTE = 'data-window'
const WINDOW_SELECTOR = `[${WINDOW_ATTRIBUTE}]`
const FIRST_WINDOW_LAYER = 31

const modals = []
const listeners = new Set()
let windowOrder = []

export function holdModal(ref) {
  modals.push(ref)
  return () => modals.splice(modals.indexOf(ref), 1)
}

export const isTopModal = (ref) => modals[modals.length - 1] === ref

export const hasModal = () => modals.length > 0

const notify = () => listeners.forEach((listener) => listener())

export function subscribeToWindows(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const openWindows = () => windowOrder

export const windowLayer = (order, id) => FIRST_WINDOW_LAYER + Math.max(order.indexOf(id), 0)

export function raiseWindow(id) {
  if (windowOrder[windowOrder.length - 1] === id) return
  windowOrder = [...windowOrder.filter((open) => open !== id), id]
  notify()
}

export function dropWindow(id) {
  windowOrder = windowOrder.filter((open) => open !== id)
  notify()
}

export function showWindow(id) {
  raiseWindow(id)
  const element = document.querySelector(`[${WINDOW_ATTRIBUTE}="${id}"]`)
  if (element && !element.contains(document.activeElement)) element.focus()
}

export const windowProps = (id) => ({ [WINDOW_ATTRIBUTE]: id })

export const isInWindow = (target) => Boolean(target?.closest?.(WINDOW_SELECTOR))
