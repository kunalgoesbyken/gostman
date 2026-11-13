import { looksLikeCredential } from './credentialLook'
import { redactText } from './redact'
import { isSensitiveName } from './sensitiveNames'
import { ENGINE_PLACEHOLDER } from './variables'

const TOKEN_LABEL = 'oauth.accessToken'
const REFRESH_LABEL = 'oauth.refreshToken'
const QUERY_LABEL = 'query.'
const FRAGMENT_LABEL = 'fragment.'
const PASSWORD_LABEL = 'userinfo.password'
const USER_LABEL = 'userinfo.user'
const PLACEHOLDER_TOKEN = 'gostmanph'
const MASKED_PLACEHOLDER = new RegExp(String.raw`${PLACEHOLDER_TOKEN}(\d+)x`, 'g')
const FRAGMENT_MARK = '#'
const QUERY_MARK = '?'
const AUTHORITY_MARK = '//'
const PATH_MARK = '/'
const USERINFO_END = '@'
const PASSWORD_MARK = ':'
const PAIR_MARK = '&'
const VALUE_MARK = '='
const FORM_SPACE = '+'
const SESSION_SOURCE = 'session'

const isSecretVariable = (name, entry) => (entry.secret && entry.source !== SESSION_SOURCE) || isSensitiveName(name)

const variableSecrets = (resolved) => Array.from(resolved)
  .filter(([name, entry]) => isSecretVariable(name, entry))
  .map(([name, entry]) => ({ label: name, value: entry.value }))

const tokenSecrets = (oauth2) => [
  { label: TOKEN_LABEL, value: oauth2?.accessToken || '' },
  { label: REFRESH_LABEL, value: oauth2?.refreshToken || '' },
]

function maskPlaceholders(address) {
  const originals = []
  const masked = address.replace(ENGINE_PLACEHOLDER, (placeholder) => `${PLACEHOLDER_TOKEN}${originals.push(placeholder) - 1}x`)
  const restore = (text) => text.replace(MASKED_PLACEHOLDER, (token, index) => originals[index] ?? token)
  return { masked, restore }
}

const onlyPlaceholders = (value) => value.replace(ENGINE_PLACEHOLDER, '').trim() === ''

function decoded(text) {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

function splitOn(text, mark) {
  const at = text.indexOf(mark)
  return at === -1 ? [text, ''] : [text.slice(0, at), text.slice(at + mark.length)]
}

const formDecoded = (text) => decoded(text.replaceAll(FORM_SPACE, ' '))

const asTyped = (label, typed, decode) => [typed, decode(typed)].map((value) => ({ label, value }))

const sensitivePairs = (text, prefix, restore) => text.split(PAIR_MARK)
  .filter((pair) => pair !== '')
  .map((pair) => splitOn(pair, VALUE_MARK))
  .filter(([name]) => isSensitiveName(formDecoded(name)))
  .flatMap(([name, value]) => asTyped(prefix + restore(formDecoded(name)), value, formDecoded))

function userinfoOf(location) {
  const none = { user: '', password: '' }
  const authorityStart = location.indexOf(AUTHORITY_MARK)
  if (authorityStart === -1) return none
  const scheme = location.slice(0, authorityStart)
  if (scheme.includes(PATH_MARK) || !(scheme === '' || scheme.endsWith(PASSWORD_MARK))) return none
  const [authority] = splitOn(location.slice(authorityStart + AUTHORITY_MARK.length), PATH_MARK)
  const userinfoEnd = authority.lastIndexOf(USERINFO_END)
  if (userinfoEnd === -1) return none
  const [user, password] = splitOn(authority.slice(0, userinfoEnd), PASSWORD_MARK)
  return { user, password }
}

function urlSecrets(address) {
  const { masked, restore } = maskPlaceholders(address)
  const [beforeFragment, fragment] = splitOn(masked, FRAGMENT_MARK)
  const [location, query] = splitOn(beforeFragment, QUERY_MARK)
  const { user, password } = userinfoOf(location)
  const userIsCredential = looksLikeCredential(USER_LABEL, restore(decoded(user)))
  return [
    ...sensitivePairs(query, QUERY_LABEL, restore),
    ...sensitivePairs(fragment, FRAGMENT_LABEL, restore),
    ...asTyped(PASSWORD_LABEL, password, decoded),
    ...(userIsCredential ? asTyped(USER_LABEL, user, decoded) : []),
  ]
    .map(({ label, value }) => ({ label, value: restore(value) }))
    .filter(({ value }) => !onlyPlaceholders(value))
}

export function shownUrl(address, resolved, auth) {
  if (!address || address.trim() === '') return ''
  return redactText(address, [...variableSecrets(resolved), ...tokenSecrets(auth?.oauth2), ...urlSecrets(address)])
}
