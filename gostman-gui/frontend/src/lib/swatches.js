import { hslTriplet, isHexColor } from './color.js'
import { lookup } from './dataUtils.js'

export const SWATCHES = {
  red: '#ef4444',
  orange: '#f97316',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  gray: '#6b7280',
}

export const SWATCH_NAMES = Object.keys(SWATCHES)

const NEUTRAL_SWATCH = 'gray'
const AUTOMATIC_SWATCHES = SWATCH_NAMES.filter((name) => name !== NEUTRAL_SWATCH)

const textHash = (text) => Array.from(text).reduce((hash, char) => (hash * 31 + char.codePointAt(0)) >>> 0, 0)

export const automaticSwatch = (text) => AUTOMATIC_SWATCHES[textHash(text) % AUTOMATIC_SWATCHES.length]

export const isSwatchName = (value) => lookup(SWATCHES, value) !== undefined

export const isColorChoice = (value) => isSwatchName(value) || isHexColor(value)

export const cleanColorChoice = (value) => {
  if (isSwatchName(value)) return value
  return isHexColor(value) ? value.toLowerCase() : ''
}

export const colorHex = (value) => lookup(SWATCHES, value) ?? (isHexColor(value) ? value.toLowerCase() : '')

export const colorTriplet = (value) => {
  const hex = colorHex(value)
  return hex ? hslTriplet(hex) : ''
}
