import { readStored, writeStored } from "./storage"

export const MIN_REQUEST_HEIGHT_PX = 232
export const MIN_RESPONSE_HEIGHT_PX = 120
export const DEFAULT_RESPONSE_SHARE = 55
export const SIDEBAR_MIN_WIDTH_PX = 224
export const SIDEBAR_MAX_WIDTH_PX = 480
export const SIDEBAR_DEFAULT_WIDTH_PX = 288
export const SIDEBAR_WIDTH_VAR = "--sidebar-width"
const MIN_MAIN_WIDTH_PX = 480
const NARROW_VIEWPORT_QUERY = "(max-width: 767px)"
const RESPONSE_SHARE_KEY = "gostman.responseShare"
const SIDEBAR_WIDTH_KEY = "gostman.sidebarWidth"
const SIDEBAR_OPEN_KEY = "gostman.sidebarOpen"
const MIN_SHARE = 5
const MAX_SHARE = 95

export const isNarrowViewport = () => typeof window !== "undefined" && window.matchMedia(NARROW_VIEWPORT_QUERY).matches

export const clamp = (value, lowest, highest) => Math.max(lowest, Math.min(highest, value))

function storedNumber(key, lowest, highest, fallback) {
  const value = Number(readStored(key))
  return value >= lowest && value <= highest ? value : fallback
}

export const rememberedResponseShare = () => storedNumber(RESPONSE_SHARE_KEY, MIN_SHARE, MAX_SHARE, DEFAULT_RESPONSE_SHARE)

export const rememberResponseShare = (share) => writeStored(RESPONSE_SHARE_KEY, String(Math.round(share)))

export const rememberedSidebarWidth = () => storedNumber(SIDEBAR_WIDTH_KEY, SIDEBAR_MIN_WIDTH_PX, SIDEBAR_MAX_WIDTH_PX, SIDEBAR_DEFAULT_WIDTH_PX)

export const rememberSidebarWidth = (width) => writeStored(SIDEBAR_WIDTH_KEY, String(Math.round(width)))

export const rememberedSidebarOpen = () => !isNarrowViewport() && readStored(SIDEBAR_OPEN_KEY) !== "false"

export function rememberSidebarOpen(isOpen) {
  if (!isNarrowViewport()) writeStored(SIDEBAR_OPEN_KEY, String(isOpen))
}

export const widestSidebarFor = (containerWidth) => clamp(containerWidth - MIN_MAIN_WIDTH_PX, SIDEBAR_MIN_WIDTH_PX, SIDEBAR_MAX_WIDTH_PX)

export const sidebarWidthValue = (width) => `min(${width}px, 100% - ${MIN_MAIN_WIDTH_PX}px)`

export const sidebarWidthStyle = (width) => ({ [SIDEBAR_WIDTH_VAR]: sidebarWidthValue(width) })
