export const MIN_REQUEST_HEIGHT_PX = 232
export const MIN_RESPONSE_HEIGHT_PX = 120
export const TOOLBAR_HEIGHT_PX = 40
const NARROW_VIEWPORT_QUERY = "(max-width: 767px)"

export const isNarrowViewport = () => typeof window !== "undefined" && window.matchMedia(NARROW_VIEWPORT_QUERY).matches
