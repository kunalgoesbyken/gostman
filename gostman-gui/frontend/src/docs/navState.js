const NAV_KEY = "gostman.docs.nav"
const EMPTY = "{}"

const listeners = new Set()

export function readNavState() {
  try {
    return localStorage.getItem(NAV_KEY) || EMPTY
  } catch {
    return EMPTY
  }
}

export const serverNavState = () => EMPTY

export function parseNavState(text) {
  try {
    const state = JSON.parse(text)
    return { groups: state.groups ?? {}, pages: state.pages ?? {} }
  } catch {
    return { groups: {}, pages: {} }
  }
}

export function toggleNavEntry(kind, key, open) {
  const state = parseNavState(readNavState())
  const next = { ...state, [kind]: { ...state[kind], [key]: open } }
  try {
    localStorage.setItem(NAV_KEY, JSON.stringify(next))
  } catch {
    return
  }
  listeners.forEach((listener) => listener())
}

export function subscribeNavState(listener) {
  const onStorage = (event) => {
    if (event.key === NAV_KEY) listener()
  }
  listeners.add(listener)
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}
