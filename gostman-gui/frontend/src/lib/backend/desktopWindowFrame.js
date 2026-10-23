import { SaveSystemTitleBar, WindowFrame } from '../../../wailsjs/go/main/App'

function createWindowFrame() {
  let frame = null
  const listeners = new Set()

  const publish = (next) => {
    frame = next
    listeners.forEach((listener) => listener())
    return next
  }

  Promise.resolve().then(WindowFrame).then(publish).catch(() => {})

  return {
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    current: () => frame,
    setSystemTitleBar: (enabled) => SaveSystemTitleBar(enabled).then(publish),
  }
}

export const desktopWindowFrame = createWindowFrame()
