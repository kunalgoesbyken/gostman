import { isDesktopApp } from './platform.js'

export function reportWindowTheme(theme) {
  if (!isDesktopApp()) return
  import('../../wailsjs/go/main/App.js').then(({ SaveWindowTheme }) => SaveWindowTheme(theme)).catch(() => {})
}
