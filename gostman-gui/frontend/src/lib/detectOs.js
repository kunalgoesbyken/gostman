const DESKTOP_TOUCH_POINTS = 1

export const detectOs = ({ userAgent = "", platform = "", maxTouchPoints = 0 } = {}) => {
  const agent = userAgent.toLowerCase()
  const system = platform.toLowerCase()
  if (/android|iphone|ipad|ipod/.test(agent)) return "other"
  if (system.includes("mac") && maxTouchPoints > DESKTOP_TOUCH_POINTS) return "other"
  if (system.includes("mac") || agent.includes("macintosh")) return "macos"
  if (system.includes("win") || agent.includes("windows")) return "windows"
  if (system.includes("linux") || agent.includes("linux") || agent.includes("x11")) return "linux"
  return "other"
}

export const detectBrowserOs = () =>
  detectOs({
    userAgent: navigator.userAgent,
    platform: navigator.userAgentData?.platform || navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  })
