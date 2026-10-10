const APPLE_PLATFORMS = ['mac', 'iphone', 'ipad']

const platformName = () => (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase()

const isApplePlatform = () => APPLE_PLATFORMS.some((name) => platformName().includes(name))

export const shortcutLabel = (key) => (isApplePlatform() ? `⌘${key}` : `Ctrl+${key}`)
