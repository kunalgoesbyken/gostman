const ALLOWED_SCHEMES = ['http', 'https', 'mailto']
const SCHEME_BREAKS = ['/', '?', '#']
const ANCHOR = '#'
const SCHEME_END = ':'
const LAST_C0 = 0x20
const FIRST_C1 = 0x7f
const LAST_C1 = 0x9f

function hasControlCharacter(text) {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    if (code <= LAST_C0 || (code >= FIRST_C1 && code <= LAST_C1)) return true
  }
  return false
}

function schemeOf(url) {
  const end = url.indexOf(SCHEME_END)
  if (end === -1) return ''
  const scheme = url.slice(0, end)
  return SCHEME_BREAKS.some((mark) => scheme.includes(mark)) ? '' : scheme.toLowerCase()
}

export function safeUrl(raw) {
  const url = raw.trim()
  if (url === '' || hasControlCharacter(url)) return null
  if (url.startsWith(ANCHOR)) return url.length > ANCHOR.length ? url : null
  return ALLOWED_SCHEMES.includes(schemeOf(url)) ? url : null
}

export const isAnchor = (url) => url.startsWith(ANCHOR)
