const DESKTOP_TOUCH_POINTS = 1
const APPLE_TOUCH_AGENT = /iphone|ipad|ipod/

const browserTraits = () => ({
  userAgent: navigator.userAgent,
  platform: navigator.userAgentData?.platform || navigator.platform,
  maxTouchPoints: navigator.maxTouchPoints,
})

export const isAppleTouch = ({ userAgent = "", platform = "", maxTouchPoints = 0 } = {}) =>
  APPLE_TOUCH_AGENT.test(userAgent.toLowerCase()) || (platform.toLowerCase().includes("mac") && maxTouchPoints > DESKTOP_TOUCH_POINTS)

export const detectOs = (traits = {}) => {
  const agent = (traits.userAgent || "").toLowerCase()
  const system = (traits.platform || "").toLowerCase()
  if (agent.includes("android") || isAppleTouch(traits)) return "other"
  if (system.includes("mac") || agent.includes("macintosh")) return "macos"
  if (system.includes("win") || agent.includes("windows")) return "windows"
  if (system.includes("linux") || agent.includes("linux") || agent.includes("x11")) return "linux"
  return "other"
}

export const detectBrowserOs = () => detectOs(browserTraits())

export const isBrowserAppleTouch = () => isAppleTouch(browserTraits())
