export const MIN_REQUEST_HEIGHT_PX = 232
export const MIN_RESPONSE_HEIGHT_PX = 120
export const TOOLBAR_HEIGHT_PX = 40
export const DEFAULT_RESPONSE_SHARE = 55
const NARROW_VIEWPORT_QUERY = "(max-width: 767px)"
const RESPONSE_SHARE_KEY = "gostman.responseShare"
const MIN_SHARE = 5
const MAX_SHARE = 95

export const isNarrowViewport = () => typeof window !== "undefined" && window.matchMedia(NARROW_VIEWPORT_QUERY).matches

export function rememberedResponseShare() {
  try {
    const share = Number(localStorage.getItem(RESPONSE_SHARE_KEY))
    return share >= MIN_SHARE && share <= MAX_SHARE ? share : DEFAULT_RESPONSE_SHARE
  } catch {
    return DEFAULT_RESPONSE_SHARE
  }
}

export function rememberResponseShare(share) {
  try {
    localStorage.setItem(RESPONSE_SHARE_KEY, String(Math.round(share)))
  } catch {
    return
  }
}
