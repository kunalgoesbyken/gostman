import { OPEN_LINK_TEXT } from './openLinkText'

export const MAX_URL_LENGTH = 2048
export const OPEN_SCHEME = 'gostman'
export const OPEN_BADGE_PATH = '/open-in-gostman.svg'
const OPEN_ACTION = 'open'
const OPEN_QUERY = 'url'
const OPEN_FRAGMENT = 'open'
const SECURE = 'https:'
const CONTROL_OR_SPACE = /[\p{Cc}\s]/u
const MARKDOWN_RESERVED = /[!'()*]/g

export class OpenSourceError extends Error {}

const refuse = (message) => new OpenSourceError(message)

const hexOf = (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`

const encodeValue = (value) => encodeURIComponent(value).replace(MARKDOWN_RESERVED, hexOf)

function parseAddress(raw) {
  try {
    return new URL(raw)
  } catch {
    throw refuse(OPEN_LINK_TEXT.notAddress)
  }
}

const hasAuthoritySlashes = (raw, parsed) => raw.slice(parsed.protocol.length).startsWith('//')

function authorityOf(raw, parsed) {
  const [authority] = raw.slice(parsed.protocol.length + 2).split(/[/?#\\]/, 1)
  return authority
}

export function parseOpenSource(raw) {
  if (typeof raw !== 'string' || raw === '') throw refuse(OPEN_LINK_TEXT.notAddress)
  if (raw.length > MAX_URL_LENGTH) throw refuse(OPEN_LINK_TEXT.tooLong)
  if (CONTROL_OR_SPACE.test(raw)) throw refuse(OPEN_LINK_TEXT.notAddress)
  const parsed = parseAddress(raw)
  if (!hasAuthoritySlashes(raw, parsed)) throw refuse(OPEN_LINK_TEXT.notAddress)
  if (parsed.username || parsed.password || authorityOf(raw, parsed).includes('@')) throw refuse(OPEN_LINK_TEXT.credentials)
  if (parsed.protocol !== SECURE) throw refuse(OPEN_LINK_TEXT.scheme)
  if (parsed.hostname === '') throw refuse(OPEN_LINK_TEXT.noHost)
  parsed.hash = ''
  return { url: parsed.href, host: parsed.host }
}

export function toOpenCandidate(raw) {
  try {
    return parseOpenSource(raw)
  } catch (error) {
    return { error: error.message }
  }
}

export function findOpenReference(hash) {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  return new URLSearchParams(fragment).get(OPEN_FRAGMENT)
}

export function buildOpenLinks(address, linkBase) {
  const { url } = parseOpenSource(address)
  const web = `${linkBase}#${OPEN_FRAGMENT}=${encodeValue(url)}`
  const badge = new URL(OPEN_BADGE_PATH, linkBase).href
  return {
    desktop: `${OPEN_SCHEME}://${OPEN_ACTION}?${OPEN_QUERY}=${encodeValue(url)}`,
    web,
    badge: `[![${OPEN_LINK_TEXT.badgeAlt}](${badge})](${web})`,
  }
}
