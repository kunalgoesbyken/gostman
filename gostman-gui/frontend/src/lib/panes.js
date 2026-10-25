import { focusableWithin, isVisible } from './focusable'

export const PANE_ADDRESS = 'address'
export const PANE_SIDEBAR = 'sidebar'

const PANE_ORDER = [PANE_SIDEBAR, 'tabs', PANE_ADDRESS, 'request', 'response']
const ENTRY_PREFERENCES = ['[data-pane-entry]:not([tabindex="-1"])', '[role=tab][tabindex="0"]']

const lastFocused = new Map()
let lastPane = null
let isJumping = false

const paneElement = (name) => document.querySelector(`[data-pane="${name}"]`)

const presentPanes = () => PANE_ORDER.map(paneElement).filter(Boolean)

function rememberedIn(pane) {
  const element = lastFocused.get(pane.dataset.pane)
  const isAvailable = element?.isConnected && pane.contains(element) && isVisible(element) && element.getAttribute('tabindex') !== '-1'
  return isAvailable ? element : null
}

function entryOf(pane) {
  const preferred = ENTRY_PREFERENCES.map((selector) => focusableWithin(pane, selector)[0]).find(Boolean)
  return rememberedIn(pane) || preferred || focusableWithin(pane)[0] || null
}

export function watchPaneFocus() {
  const remember = (event) => {
    const pane = event.target.closest?.('[data-pane]')
    if (!pane) return
    lastPane = pane.dataset.pane
    if (!isJumping) lastFocused.set(lastPane, event.target)
  }
  document.addEventListener('focusin', remember)
  return () => document.removeEventListener('focusin', remember)
}

function focusEntry(pane) {
  const entry = entryOf(pane)
  isJumping = true
  entry?.focus()
  isJumping = false
  return Boolean(entry)
}

const wrap = (index, count) => ((index % count) + count) % count

export function focusPane(name) {
  const pane = paneElement(name)
  if (pane) focusEntry(pane)
}

export function focusAddress() {
  paneElement(PANE_ADDRESS)?.querySelector('[data-pane-entry]')?.focus()
}

export const focusAddressSoon = () => requestAnimationFrame(focusAddress)

export const focusOrigin = () => ({ element: document.activeElement, pane: document.activeElement?.closest?.('[data-pane]')?.dataset.pane })

export function returnFocusTo({ element, pane }) {
  if (element instanceof HTMLElement && element.isConnected) element.focus()
  else focusPane(pane || lastPane || PANE_ADDRESS)
}

export function cyclePane(step) {
  const panes = presentPanes()
  const current = panes.findIndex((pane) => pane.contains(document.activeElement))
  const start = current < 0 ? (step > 0 ? -1 : panes.length) : current
  for (let offset = 1; offset <= panes.length; offset += 1) {
    if (focusEntry(panes[wrap(start + step * offset, panes.length)])) return
  }
}
