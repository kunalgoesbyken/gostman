import { findOpenReference, toOpenCandidate } from './openSource'

const listeners = new Set()
let current = null
let queued = null

const notify = () => listeners.forEach((listener) => listener())

function withoutFragment() {
  const { pathname, search } = window.location
  window.history.replaceState(window.history.state, '', `${pathname}${search}`)
}

export function receiveOpenLink(candidate) {
  if (current === null) current = candidate
  else queued = candidate
  notify()
}

export function receiveOpenAddress(raw) {
  receiveOpenLink(toOpenCandidate(raw))
}

export function dismissOpenLink() {
  current = queued
  queued = null
  notify()
}

export const currentOpenLink = () => current

export function subscribeToOpenLink(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function captureFragment() {
  const reference = findOpenReference(window.location.hash)
  if (reference === null) return
  withoutFragment()
  receiveOpenAddress(reference)
}

export function watchOpenLinks() {
  captureFragment()
  window.addEventListener('hashchange', captureFragment)
}
