import { isPlainObject } from './dataUtils.js'
import { SHORTCUT_TEXT } from './shortcutText.js'

const { keys: KEY_TEXT } = SHORTCUT_TEXT

const IME_KEY_CODE = 229
const MAX_IDENTITY_LENGTH = 32
const MODIFIER_NAMES = ['mod', 'ctrl', 'alt', 'shift']
const MODIFIER_KEYS = ['Control', 'Shift', 'Alt', 'AltGraph', 'Meta', 'OS']
const UNIDENTIFIED_KEYS = ['Dead', 'Process', 'Unidentified']
const FUNCTION_KEYS = Array.from({ length: 12 }, (_, index) => `f${index + 1}`)
const SPACE_KEY = ' '
const SPACE_NAME = 'space'
const LATIN_LETTER = /^[a-z]$/i
const ASCII_SYMBOL = /^[\x21-\x7e]$/
const LETTER_CODE = /^Key([A-Z])$/
const DIGIT_CODE = /^Digit[1-9]$/

const SYMBOL_CODES = {
  BracketLeft: '[',
  BracketRight: ']',
  Slash: '/',
  Backslash: '\\',
  Comma: ',',
  Period: '.',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Minus: '-',
  Equal: '=',
}

export const digitCode = (position) => `Digit${position}`

export const isDigitChord = (chord) => DIGIT_CODE.test(chord.code ?? '')

const withKeys = (flags, keys) => keys.map((key) => ({ ...flags, key }))

const DIGIT_CODES = Array.from({ length: 9 }, (_, index) => digitCode(index + 1))

const EDITING_CHORDS = [...withKeys({ mod: true }, ['c', 'v', 'x', 'a', 'z', 'y']), ...withKeys({ mod: true, shift: true }, ['z'])]

const BROWSER_CHORDS = [
  ...withKeys({ mod: true }, ['w', 't', 'n', 'q', 'pageup', 'pagedown']),
  ...withKeys({ mod: true, shift: true }, ['t', 'n', 'w']),
  ...withKeys({ ctrl: true }, ['tab']),
  ...withKeys({ ctrl: true, shift: true }, ['tab']),
  ...DIGIT_CODES.map((code) => ({ mod: true, code })),
]

const APPLE_SYSTEM_CHORDS = withKeys({ mod: true }, ['q', 'h', 'm', SPACE_NAME])

const letterOfCode = (code) => LETTER_CODE.exec(code ?? '')?.[1].toLowerCase()

const pressedKey = (event) => (event.key === SPACE_KEY ? SPACE_NAME : event.key.toLowerCase())

const impliesShift = (chord) => !chord.shift && chord.key?.length === 1 && !LATIN_LETTER.test(chord.key)

const compact = (flags) => Object.fromEntries(Object.entries(flags).filter(([, isOn]) => isOn))

const isImeEvent = (event) => Boolean(event.isComposing) || event.keyCode === IME_KEY_CODE

function keyMatches(chord, event) {
  if (chord.code) return event.code === chord.code
  if (pressedKey(event) === chord.key) return true
  return !LATIN_LETTER.test(event.key) && letterOfCode(event.code) === chord.key
}

function modifiersMatch(chord, event, isApple) {
  const wantsControl = Boolean(chord.ctrl || (chord.mod && !isApple))
  const wantsCommand = Boolean(chord.mod && isApple)
  const shiftMatches = impliesShift(chord) || event.shiftKey === Boolean(chord.shift)
  return event.ctrlKey === wantsControl && event.metaKey === wantsCommand && event.altKey === Boolean(chord.alt) && shiftMatches
}

export const matchesChord = (chord, event, isApple) => (
  !isImeEvent(event) && modifiersMatch(chord, event, isApple) && keyMatches(chord, event)
)

const identityOf = (chord) => {
  if (!chord.code) return chord.key
  return letterOfCode(chord.code) ?? SYMBOL_CODES[chord.code] ?? chord.code
}

export function chordSignature(chord, isApple) {
  const command = isApple ? 'meta' : 'ctrl'
  const flags = [chord.mod && command, chord.ctrl && 'ctrl', chord.alt && 'alt', chord.shift && 'shift'].filter(Boolean)
  return `${[...new Set(flags)].sort().join('+')}:${identityOf(chord)}`
}

const keyPartOf = (event) => {
  if (LATIN_LETTER.test(event.key)) return { key: event.key.toLowerCase() }
  const letter = letterOfCode(event.code)
  if (letter) return { key: letter }
  if (DIGIT_CODE.test(event.code)) return { code: event.code }
  if (event.key === SPACE_KEY || (event.key.length > 1 && !UNIDENTIFIED_KEYS.includes(event.key))) return { key: pressedKey(event) }
  if (ASCII_SYMBOL.test(event.key)) return { key: event.key }
  return event.code ? { code: event.code } : null
}

export const chordModifiers = (chord) => compact(Object.fromEntries(MODIFIER_NAMES.map((name) => [name, chord[name]])))

export const eventModifiers = (event, isApple) => compact({
  mod: isApple ? event.metaKey : event.ctrlKey,
  ctrl: isApple && event.ctrlKey,
  alt: event.altKey,
  shift: event.shiftKey,
})

const modifierError = (event, isApple) => {
  if (isApple && event.metaKey && event.ctrlKey) return 'ambiguousModifiers'
  if (!isApple && event.metaKey) return 'metaUnsupported'
  if (!isApple && event.ctrlKey && event.altKey) return 'altGraph'
  return null
}

const needsModifier = (chord) => !(chord.mod || chord.ctrl || chord.alt || FUNCTION_KEYS.includes(chord.key))

export function chordFromEvent(event, isApple) {
  const modifiers = eventModifiers(event, isApple)
  const keyPart = MODIFIER_KEYS.includes(event.key) || isImeEvent(event) ? null : keyPartOf(event)
  if (!keyPart) return { modifiers }
  const error = modifierError(event, isApple)
  if (error) return { error }
  const chord = { ...modifiers, ...keyPart }
  return needsModifier(chord) ? { error: 'needsModifier' } : { chord }
}

export function reservedReason(chord, { isDesktop, isApple }) {
  const isReserved = (list) => list.some((reserved) => chordSignature(reserved, isApple) === chordSignature(chord, isApple))
  if (isReserved(EDITING_CHORDS)) return 'editing'
  if (!isDesktop && isReserved(BROWSER_CHORDS)) return 'browser'
  if (isApple && isReserved(APPLE_SYSTEM_CHORDS)) return 'system'
  return null
}

const modifierLabels = (chord, isApple) => {
  const symbols = isApple ? KEY_TEXT.apple : KEY_TEXT.plain
  const labels = []
  if (chord.ctrl || (chord.mod && !isApple)) labels.push(symbols.ctrl)
  if (chord.mod && isApple) labels.push(symbols.meta)
  if (chord.alt) labels.push(symbols.alt)
  if (chord.shift) labels.push(symbols.shift)
  return labels
}

const keyLabel = (chord) => {
  if (chord.code) return SYMBOL_CODES[chord.code] ?? chord.code.replace(/^(Digit|Key)/, '')
  return KEY_TEXT.names[chord.key] ?? chord.key.toUpperCase()
}

const joinLabels = (labels, isApple) => labels.join(isApple ? '' : '+')

export const chordLabel = (chord, isApple) => joinLabels([...modifierLabels(chord, isApple), keyLabel(chord)], isApple)

export function modifiersPrefix(chord, isApple) {
  const labels = modifierLabels(chord, isApple)
  return labels.length === 0 ? '' : joinLabels(labels, isApple) + (isApple ? '' : '+')
}

function sanitizeChord(raw) {
  if (!isPlainObject(raw)) return undefined
  const identities = ['key', 'code'].filter((field) => typeof raw[field] === 'string' && raw[field] !== '' && raw[field].length <= MAX_IDENTITY_LENGTH)
  if (identities.length !== 1) return undefined
  const [identity] = identities
  const flags = Object.fromEntries(MODIFIER_NAMES.filter((name) => raw[name] === true).map((name) => [name, true]))
  return { ...flags, [identity]: identity === 'key' ? raw.key.toLowerCase() : raw.code }
}

export function sanitizeOverrides(raw) {
  if (!isPlainObject(raw)) return {}
  const entries = Object.entries(raw).map(([id, value]) => [id, value === null ? null : sanitizeChord(value)])
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined))
}
