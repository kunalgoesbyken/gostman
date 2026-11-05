const IDLE_TIMEOUT_MS = 3000

const savesData = () => Boolean(navigator.connection?.saveData)

export function whenIdle(task) {
  if (savesData()) return () => {}
  return onIdle(task)
}

export function onIdle(task) {
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MS })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(task, IDLE_TIMEOUT_MS)
  return () => window.clearTimeout(id)
}

export function whenLoadedAndIdle(task) {
  if (document.readyState === "complete") return whenIdle(task)
  let cancel = () => {}
  const start = () => {
    cancel = whenIdle(task)
  }
  window.addEventListener("load", start, { once: true })
  return () => {
    window.removeEventListener("load", start)
    cancel()
  }
}
