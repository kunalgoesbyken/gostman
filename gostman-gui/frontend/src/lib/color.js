const HEX_COLOR = /^#[0-9a-f]{6}$/i
const WHITE = '#ffffff'
const BLACK = '#000000'

export const MIN_TEXT_CONTRAST = 4.5

export const isHexColor = (value) => typeof value === 'string' && HEX_COLOR.test(value)

export function parseHexInput(text) {
  const candidate = `#${text.trim().replace(/^#/, '')}`.toLowerCase()
  return isHexColor(candidate) ? candidate : null
}

const channelsOf = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)

const clampUnit = (value) => Math.min(1, Math.max(0, value))

const toHex = (channels) => `#${channels.map((channel) => Math.round(clampUnit(channel) * 255).toString(16).padStart(2, '0')).join('')}`

const toLinear = (channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)

const toGamma = (channel) => (channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055)

function relativeLuminance(hex) {
  const [red, green, blue] = channelsOf(hex).map(toLinear)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export function contrastRatio(first, second) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

export const isDarkColor = (hex) => contrastRatio(hex, WHITE) > contrastRatio(hex, BLACK)

export const textColorOn = (hex) => (isDarkColor(hex) ? WHITE : BLACK)

function toOklab(hex) {
  const [red, green, blue] = channelsOf(hex).map(toLinear)
  const long = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue)
  const medium = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue)
  const short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue)
  return [
    0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short,
    1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short,
    0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short,
  ]
}

function fromOklab([lightness, a, b]) {
  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ]
  return toHex(linear.map((channel) => toGamma(clampUnit(channel))))
}

export function mixColors(from, to, amount) {
  const start = toOklab(from)
  const end = toOklab(to)
  return fromOklab(start.map((value, index) => value + (end[index] - value) * amount))
}

const SEARCH_STEPS = 16

export function readableOn(color, background, minimum) {
  if (contrastRatio(color, background) >= minimum) return color
  const target = isDarkColor(background) ? WHITE : BLACK
  let [low, high] = [0, 1]
  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const middle = (low + high) / 2
    if (contrastRatio(mixColors(color, target, middle), background) >= minimum) high = middle
    else low = middle
  }
  return mixColors(color, target, high)
}

const oneDecimal = (value) => Math.round(value * 10) / 10

const hueChannel = (hue, saturation, lightness, offset) => {
  const turn = (offset + hue / 30) % 12
  const reach = saturation * Math.min(lightness, 1 - lightness)
  return lightness - reach * Math.max(-1, Math.min(turn - 3, 9 - turn, 1))
}

export function tripletToHex(triplet) {
  const [hue, saturation, lightness] = triplet.trim().split(/\s+/).map((part) => parseFloat(part))
  if ([hue, saturation, lightness].some(Number.isNaN)) return null
  return toHex([0, 8, 4].map((offset) => hueChannel(hue, saturation / 100, lightness / 100, offset)))
}

function hueOf([red, green, blue], max, delta) {
  if (delta === 0) return 0
  if (max === red) return 60 * (((green - blue) / delta + 6) % 6)
  if (max === green) return 60 * ((blue - red) / delta + 2)
  return 60 * ((red - green) / delta + 4)
}

export function hslTriplet(hex) {
  const channels = channelsOf(hex)
  const max = Math.max(...channels)
  const min = Math.min(...channels)
  const delta = max - min
  const lightness = (max + min) / 2
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))
  return `${oneDecimal(hueOf(channels, max, delta))} ${oneDecimal(saturation * 100)}% ${oneDecimal(lightness * 100)}%`
}
