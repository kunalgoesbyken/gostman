export const TIMEOUT_MS = 10_000
export const MIN_TIMEOUT_MS = 1_000
export const MAX_TIMEOUT_MS = 120_000
export const MAX_SENDS = 50
export const SEND_TIMEOUT_MS = 5_000
export const MAX_FLOW_STEPS = 1_000
export const MAX_LOG_ENTRIES = 500
export const MAX_LOG_CHARS = 10_000
export const MAX_VISUAL_CHARS = 1_000_000
export const MAX_MODULE_FILES = 200
export const MAX_MODULE_BYTES = 1_000_000
export const MAX_MODULE_DEPTH = 32

const scriptTimeout = (milliseconds) => {
  const requested = Math.trunc(Number(milliseconds)) || 0
  return requested > 0 ? Math.min(Math.max(requested, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS) : TIMEOUT_MS
}

const timedOut = (milliseconds) => `The script ran for more than ${milliseconds / 1000} seconds and was stopped.`

export const scriptAllowance = (milliseconds) => {
  const limit = scriptTimeout(milliseconds)
  return { limit, message: timedOut(limit) }
}
