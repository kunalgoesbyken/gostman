const CHANNEL_MAX = 255

export function parseTriplet(text) {
  const [hue, saturation, lightness] = text.trim().split(/\s+/).map((part) => Number.parseFloat(part))
  return { hue, saturation: saturation / 100, lightness: lightness / 100 }
}

export function toRgb({ hue, saturation, lightness }) {
  const chroma = saturation * Math.min(lightness, 1 - lightness)
  const channel = (offset) => {
    const sector = (offset + hue / 30) % 12
    return lightness - chroma * Math.max(-1, Math.min(sector - 3, 9 - sector, 1))
  }
  return [channel(0), channel(8), channel(4)].map((value) => Math.round(value * CHANNEL_MAX))
}

export const tripletToRgb = (text) => toRgb(parseTriplet(text))

export const rgbToHex = (rgb) => `#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}`

export const tripletToHex = (text, alpha) => {
  const hex = rgbToHex(tripletToRgb(text))
  return alpha === undefined ? hex : hex + Math.round(alpha * CHANNEL_MAX).toString(16).padStart(2, '0')
}

export const blend = (foreground, background, alpha) => foreground.map((value, index) => Math.round(value * alpha + background[index] * (1 - alpha)))

const linear = (value) => {
  const unit = value / CHANNEL_MAX
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
}

const luminance = ([red, green, blue]) => 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)

export function contrastRatio(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}
