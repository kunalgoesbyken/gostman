const APPLE_PLATFORMS = ['mac', 'iphone', 'ipad']

const platformName = () => (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase()

let applePlatform

export const isApplePlatform = () => (applePlatform ??= APPLE_PLATFORMS.some((name) => platformName().includes(name)))

export const isDesktopApp = () => typeof window !== 'undefined' && Boolean(window.go)

export const shortcutLabel = (key) => (isApplePlatform() ? `⌘${key}` : `Ctrl+${key}`)
