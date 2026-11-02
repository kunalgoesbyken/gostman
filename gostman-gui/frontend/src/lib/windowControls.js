import { Quit, WindowIsMaximised, WindowMinimise, WindowToggleMaximise } from "../../wailsjs/runtime/runtime"

export const isDesktopShell = () => typeof window !== "undefined" && typeof window.runtime?.WindowMinimise === "function"

export const windowControls = {
  minimise: WindowMinimise,
  toggleMaximise: WindowToggleMaximise,
  isMaximised: WindowIsMaximised,
  close: Quit,
}

export const resizeWindowFrom = (edge) => window.WailsInvoke?.(`resize:${edge}`)

export const isDragRegion = (element) => getComputedStyle(element).getPropertyValue("--wails-draggable").trim() === "drag"
