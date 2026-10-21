import { useSyncExternalStore } from 'react'

const WORKER_URL = '/sw.js'

let deferredPrompt = null
const listeners = new Set()

const notify = () => listeners.forEach((listener) => listener())

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const isInstallable = () => deferredPrompt !== null

export const useInstallable = () => useSyncExternalStore(subscribe, isInstallable, () => false)

export async function promptInstall() {
  const prompt = deferredPrompt
  if (!prompt) return
  deferredPrompt = null
  notify()
  await prompt.prompt()
}

export function watchInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const register = () => navigator.serviceWorker.register(WORKER_URL).catch(() => {})
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
