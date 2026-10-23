const PROBE_FONT_SIZE = '32px'
const PROBE_TEXT = 'mmmmmmmmmmlli10OQ@WwYy字あ한ب'
const GENERIC_FAMILIES = ['monospace', 'serif', 'sans-serif']

export const FONT_SLOTS = { interfaceFont: 'ui', codeFont: 'mono' }

const cssString = (text) => `"${text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`

const fontStack = (name, fallback) => `${cssString(name)}, ${fallback}`

let probe

function textWidth(fontFamily) {
  probe ??= document.createElement('canvas').getContext('2d')
  probe.font = `${PROBE_FONT_SIZE} ${fontFamily}`
  return probe.measureText(PROBE_TEXT).width
}

const isBundledFont = (name) => [...document.fonts].some((face) => face.family.replaceAll('"', '') === name)

const isSystemFont = (name) => GENERIC_FAMILIES.some((generic) => textWidth(fontStack(name, generic)) !== textWidth(generic))

export const isFontInstalled = (name) => isBundledFont(name) || isSystemFont(name)

export function applyFont(root, slot, name) {
  const property = `--font-${slot}`
  if (!name) return root.style.removeProperty(property)
  root.style.setProperty(property, fontStack(name, `var(${property}-default)`))
}

export const canListInstalledFonts = () => typeof window.queryLocalFonts === 'function'

export async function listInstalledFonts() {
  const fonts = await window.queryLocalFonts()
  return [...new Set(fonts.map((font) => font.family))].sort((first, second) => first.localeCompare(second))
}
