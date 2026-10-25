const PREFERENCES_KEY = "gostman.preferences"
const DARK_QUERY = "(prefers-color-scheme: dark)"

export const THEME_CHOICES = ["system", "light", "dark"]

const listeners = new Set()

function readPreferences() {
  try {
    return JSON.parse(localStorage.getItem(PREFERENCES_KEY)) || {}
  } catch {
    return {}
  }
}

export function readTheme() {
  const { theme } = readPreferences()
  return THEME_CHOICES.includes(theme) ? theme : "system"
}

export const serverTheme = () => "system"

const isDark = (choice) => choice === "dark" || (choice === "system" && matchMedia(DARK_QUERY).matches)

const applyTheme = () => document.documentElement.classList.toggle("dark", isDark(readTheme()))

export function writeTheme(choice) {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ...readPreferences(), theme: choice }))
  } catch {
    return
  }
  applyTheme()
  listeners.forEach((listener) => listener())
}

export function subscribeTheme(listener) {
  const media = matchMedia(DARK_QUERY)
  const onStorage = (event) => {
    if (event.key !== PREFERENCES_KEY) return
    applyTheme()
    listener()
  }
  listeners.add(listener)
  media.addEventListener("change", applyTheme)
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    media.removeEventListener("change", applyTheme)
    window.removeEventListener("storage", onStorage)
  }
}
