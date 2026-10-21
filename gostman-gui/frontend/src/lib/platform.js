const APPLE_PLATFORMS = ['mac', 'iphone', 'ipad']

const platformName = () => (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase()

export const isApplePlatform = () => APPLE_PLATFORMS.some((name) => platformName().includes(name))

export const isDesktopApp = () => typeof window !== 'undefined' && Boolean(window.go)

export const shortcutLabel = (key) => (isApplePlatform() ? `⌘${key}` : `Ctrl+${key}`)
