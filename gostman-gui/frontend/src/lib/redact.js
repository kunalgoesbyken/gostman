import { bytesToBase64 } from './base64'

const SCRUB_LABEL = 'secret'
const MIN_SECRET_LENGTH = 3
const LITERALS = new Set(['true', 'false', 'null', 'undefined'])
const ALIGNMENTS = 3
const BITS_PER_BYTE = 8
const BITS_PER_SYMBOL = 6
const PADDING = '='
const STRICT_RESERVED = ["!", "'", '(', ')', '*']
const ENCODED_SPACE = '%20'
const FORM_SPACE = '+'
const HTML_ESCAPES = [['<', '\\u003c'], ['>', '\\u003e'], ['&', '\\u0026']]
const URL_ALPHABET = [['+', '-'], ['/', '_']]

const encoder = new TextEncoder()

const replaceAll = (text, pairs) => pairs.reduce((result, [from, to]) => result.split(from).join(to), text)

const percentOf = (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`

const HEX_DIGITS = '0123456789abcdefABCDEF'

const isHex = (character) => character !== '' && HEX_DIGITS.includes(character)

function lowerEscapes(text) {
  let result = ''
  for (let index = 0; index < text.length; index += 1) {
    const isEscape = text[index] === '%' && isHex(text[index + 1] || '') && isHex(text[index + 2] || '')
    result += isEscape ? `%${text.slice(index + 1, index + 3).toLowerCase()}` : text[index]
    if (isEscape) index += 2
  }
  return result
}

function percentEncoded(value) {
  let component
  let path
  try {
    component = encodeURIComponent(value)
    path = encodeURI(value)
  } catch {
    return []
  }
  const strict = replaceAll(component, STRICT_RESERVED.map((character) => [character, percentOf(character)]))
  const form = strict.split(ENCODED_SPACE).join(FORM_SPACE)
  return [component, strict, form, path].flatMap((encoded) => [encoded, lowerEscapes(encoded)])
}

function jsonEscaped(value) {
  const plain = JSON.stringify(value).slice(1, -1)
  return [plain, replaceAll(plain, HTML_ESCAPES), plain.split('/').join('\\/')]
}

const unpadded = (encoded) => encoded.split(PADDING).join('')

function embedded(bytes, offset) {
  const shifted = new Uint8Array(offset + bytes.length)
  shifted.set(bytes, offset)
  const start = Math.ceil((BITS_PER_BYTE * offset) / BITS_PER_SYMBOL)
  const end = Math.floor((BITS_PER_BYTE * shifted.length) / BITS_PER_SYMBOL)
  return unpadded(bytesToBase64(shifted)).slice(start, end)
}

function base64Encoded(value) {
  const bytes = encoder.encode(value)
  const standard = [bytesToBase64(bytes), ...Array.from({ length: ALIGNMENTS }, (_, offset) => embedded(bytes, offset))]
  return [...standard, ...standard.map((encoded) => replaceAll(encoded, URL_ALPHABET))]
}

const isSecret = (value) => value.length >= MIN_SECRET_LENGTH && !LITERALS.has(value.toLowerCase())

const variants = (value) => [value, ...percentEncoded(value), ...jsonEscaped(value), ...base64Encoded(value)]
  .filter((form) => form.length >= MIN_SECRET_LENGTH)

const marker = (label) => `{{${label}}}`

function labelledForms(secrets) {
  const seen = new Set()
  const forms = []
  for (const { label, value } of secrets) {
    const trimmed = String(value).trim()
    if (!isSecret(trimmed) || seen.has(trimmed)) continue
    seen.add(trimmed)
    for (const form of new Set(variants(trimmed))) forms.push({ form, label })
  }
  return forms
}

const formsOf = (secrets) => labelledForms(secrets.map((value) => ({ label: SCRUB_LABEL, value })))

function occurrences(text, { form, label }) {
  const found = []
  for (let start = text.indexOf(form); start !== -1; start = text.indexOf(form, start + 1)) {
    found.push({ start, end: start + form.length, width: form.length, label })
  }
  return found
}

function merged(spans) {
  return spans.sort((first, second) => first.start - second.start).reduce((kept, span) => {
    const last = kept[kept.length - 1]
    if (!last || span.start >= last.end) {
      kept.push({ ...span })
      return kept
    }
    last.end = Math.max(last.end, span.end)
    if (span.width > last.width) Object.assign(last, { width: span.width, label: span.label })
    return kept
  }, [])
}

function scrubWith(text, forms) {
  const spans = merged(forms.flatMap((form) => occurrences(text, form)))
  if (spans.length === 0) return text
  let cleaned = ''
  let position = 0
  for (const span of spans) {
    cleaned += text.slice(position, span.start) + marker(span.label)
    position = span.end
  }
  return cleaned + text.slice(position)
}

export const scrubText = (text, secrets) => scrubWith(text, formsOf(secrets))

export const redactText = (text, labelled) => scrubWith(text, labelledForms(labelled))

export function scrubPrompt(prompt, secrets) {
  const forms = formsOf(secrets)
  return { ...prompt, system: scrubWith(prompt.system, forms), user: scrubWith(prompt.user, forms) }
}
