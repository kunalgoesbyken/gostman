const IDLE_TIMEOUT_MS = 3000

const savesData = () => Boolean(navigator.connection?.saveData)

export function whenIdle(task) {
  if (savesData()) return () => {}
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MS })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(task, IDLE_TIMEOUT_MS)
  return () => window.clearTimeout(id)
}
