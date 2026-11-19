const WINDOW_ATTRIBUTE = 'data-window'
const WINDOW_SELECTOR = `[${WINDOW_ATTRIBUTE}]`
const TRAY_ATTRIBUTE = 'data-tray-item'
const FIRST_WINDOW_LAYER = 31

const modals = []
const listeners = new Set()
let windowOrder = []
let minimizedOrder = []

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

export const minimizedWindows = () => minimizedOrder

export const windowLayer = (order, id) => FIRST_WINDOW_LAYER + Math.max(order.indexOf(id), 0)

const withoutWindow = (ids, id) => ids.filter((open) => open !== id)

const elementOf = (attribute, id) => document.querySelector(`[${attribute}="${id}"]`)

export const frontWindow = () => windowOrder.findLast((id) => !minimizedOrder.includes(id))

export function raiseWindow(id) {
  if (frontWindow() === id) return
  windowOrder = [...withoutWindow(windowOrder, id), id]
  minimizedOrder = withoutWindow(minimizedOrder, id)
  notify()
}

export function dropWindow(id) {
  windowOrder = withoutWindow(windowOrder, id)
  minimizedOrder = withoutWindow(minimizedOrder, id)
  notify()
}

export function minimizeWindow(id) {
  if (minimizedOrder.includes(id)) return
  if (elementOf(WINDOW_ATTRIBUTE, id)?.contains(document.activeElement)) elementOf(TRAY_ATTRIBUTE, id)?.focus()
  minimizedOrder = [...minimizedOrder, id]
  notify()
}

export function showWindow(id) {
  raiseWindow(id)
  const element = elementOf(WINDOW_ATTRIBUTE, id)
  if (element && !element.contains(document.activeElement)) element.focus()
}

export const windowProps = (id) => ({ [WINDOW_ATTRIBUTE]: id })

export const trayProps = (id) => ({ [TRAY_ATTRIBUTE]: id })

export const isInWindow = (target) => Boolean(target?.closest?.(WINDOW_SELECTOR))
