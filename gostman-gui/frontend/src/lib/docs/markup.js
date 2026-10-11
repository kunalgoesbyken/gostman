const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const RESERVED = /[&<>"']/g
const UNPRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g
const NOT_SLUG = /[^a-z0-9]+/g
const MAX_SLUG_LENGTH = 60
const HIGH_SURROGATE_START = 0xd800
const HIGH_SURROGATE_END = 0xdbff

class Markup {
  constructor(source) {
    this.source = source
  }
}

const escapeText = (text) => text.replace(UNPRINTABLE, '').replace(RESERVED, (character) => ENTITIES[character])

function render(value) {
  if (value instanceof Markup) return value.source
  if (Array.isArray(value)) return value.map(render).join('')
  if (value === null || value === undefined || value === false) return ''
  return escapeText(String(value))
}

export const html = (literals, ...values) => new Markup(
  literals.reduce((source, literal, index) => source + render(values[index - 1]) + literal)
)

export const trusted = (source) => new Markup(source)

export const toSource = (markup) => markup.source

function slugOf(text, fallback) {
  const slug = text.toLowerCase().replace(NOT_SLUG, '-').slice(0, MAX_SLUG_LENGTH)
  const trimmed = slug.split('-').filter(Boolean).join('-')
  return trimmed || fallback
}

export function createAnchors(reserved) {
  const taken = new Set(reserved)
  return (text, fallback) => {
    const base = slugOf(text, fallback)
    let anchor = base
    for (let attempt = 2; taken.has(anchor); attempt += 1) anchor = `${base}-${attempt}`
    taken.add(anchor)
    return anchor
  }
}

function endsInsidePair(text, length) {
  const last = text.charCodeAt(length - 1)
  return last >= HIGH_SURROGATE_START && last <= HIGH_SURROGATE_END
}

export function shorten(text, limit) {
  if (text.length <= limit) return text
  return text.slice(0, endsInsidePair(text, limit) ? limit - 1 : limit)
}
