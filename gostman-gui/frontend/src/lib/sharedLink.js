import { findShareReference } from './share'

const CLIENT_PATH = '/web'

const listeners = new Set()
let pending = ''

export const clientUrl = (origin) => `${origin}${CLIENT_PATH}`

function withoutFragment() {
  const { pathname, search } = window.location
  window.history.replaceState(window.history.state, '', `${pathname}${search}`)
}

function capture() {
  const reference = findShareReference(window.location.hash)
  if (reference === null) return
  withoutFragment()
  pending = reference
  listeners.forEach((notify) => notify())
}

export function watchSharedLinks() {
  capture()
  window.addEventListener('hashchange', capture)
}

export function subscribeToSharedLink(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const pendingSharedLink = () => pending

export function forgetSharedLink() {
  pending = ''
  listeners.forEach((notify) => notify())
}
