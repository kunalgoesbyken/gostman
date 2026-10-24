import { MIN_TEXT_CONTRAST, hslTriplet, readableOn, textColorOn } from './color.js'
import { MODES, effectiveColors } from './themes.js'

export const CUSTOM_ACCENT = 'custom'

export const ACCENT_PROPERTIES = MODES.flatMap((mode) => [`--${mode}-primary`, `--${mode}-ring`, `--${mode}-primary-foreground`])

export const accentShade = (theme, mode, color) => readableOn(color, effectiveColors(theme, mode, 'window').background, MIN_TEXT_CONTRAST)

function modeProperties(preferences, mode) {
  const shade = accentShade(preferences, mode, preferences.accentColor)
  const triplet = hslTriplet(shade)
  return [[`--${mode}-primary`, triplet], [`--${mode}-ring`, triplet], [`--${mode}-primary-foreground`, hslTriplet(textColorOn(shade))]]
}

export function accentProperties(preferences) {
  if (preferences.accent !== CUSTOM_ACCENT) return {}
  return Object.fromEntries(MODES.flatMap((mode) => modeProperties(preferences, mode)))
}
