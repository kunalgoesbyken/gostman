import { Quit, WindowIsMaximised, WindowMinimise, WindowToggleMaximise } from "../../wailsjs/runtime/runtime"

// The Wails runtime is injected only into the desktop shell; the web build has no window to control.
export const isDesktopShell = () => typeof window !== "undefined" && typeof window.runtime?.WindowMinimise === "function"

export const windowControls = {
  minimise: WindowMinimise,
  toggleMaximise: WindowToggleMaximise,
  isMaximised: WindowIsMaximised,
  close: Quit,
}
