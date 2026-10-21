import { SaveWindowTheme } from '../../wailsjs/go/main/App.js'
import { isDesktopApp } from './platform.js'

export function reportWindowTheme(theme) {
  if (isDesktopApp()) SaveWindowTheme(theme).catch(() => {})
}
