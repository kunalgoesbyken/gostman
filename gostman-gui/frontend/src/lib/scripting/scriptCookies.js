import { mergeCookies } from '../cookies'
import { addressParts, isLoopbackHost, isPermittedHost } from './destinations'
import { createPropertyList } from './propertyList'

const ROOT_PATH = '/'
const PATH_SEPARATOR = '/'
const DOMAIN_DOT = '.'
const MS_PER_SECOND = 1000
const COOKIE_SEPARATOR = '; '

const domainMatches = (cookie, host) => (
  cookie.hostOnly ? host === cookie.domain : host === cookie.domain || host.endsWith(`${DOMAIN_DOT}${cookie.domain}`)
)

function pathMatches(cookiePath, path) {
  const scope = cookiePath || ROOT_PATH
  if (path === scope) return true
  return path.startsWith(scope) && (scope.endsWith(PATH_SEPARATOR) || path[scope.length] === PATH_SEPARATOR)
}

const sentTo = ({ secure, host, path }) => (cookie) => (
  domainMatches(cookie, host) && pathMatches(cookie.path, path) && (!cookie.secure || secure)
)

const entryOf = (cookie) => ({
  key: cookie.name,
  name: cookie.name,
  value: cookie.value,
  domain: cookie.domain,
  path: cookie.path,
  expires: cookie.expires,
  secure: cookie.secure,
  httpOnly: cookie.httpOnly,
})

const isGiven = (value) => value !== undefined && value !== null && value !== ''

const utcText = (time) => (Number.isFinite(time) ? new Date(time).toUTCString() : '')

function expiryOf({ expires, maxAge }) {
  if (isGiven(maxAge)) return utcText(Date.now() + Number(maxAge) * MS_PER_SECOND)
  return isGiven(expires) ? utcText(new Date(expires).getTime()) : ''
}

const withoutLeadingDot = (domain) => (domain.startsWith(DOMAIN_DOT) ? domain.slice(DOMAIN_DOT.length) : domain)

function cookieFor(address, item) {
  const domain = withoutLeadingDot(String(item.domain ?? ''))
  return {
    name: String(item.key ?? item.name ?? ''),
    value: String(item.value ?? ''),
    domain: domain || addressParts(address).host,
    hostOnly: domain === '',
    path: item.path || ROOT_PATH,
    expires: expiryOf(item),
    secure: Boolean(item.secure),
    httpOnly: Boolean(item.httpOnly),
    expired: false,
  }
}

const retired = (cookie) => ({ ...cookie, expired: true })

const visibleTo = (hosts) => (cookie) => isLoopbackHost(cookie.domain) || hosts.some((host) => domainMatches(cookie, host))

const writableBy = (hosts) => (cookie) => (cookie.expired ? visibleTo(hosts)(cookie) : isPermittedHost(cookie.domain, hosts))

const listed = (items) => (Array.isArray(items) ? items : [])

export const scriptCookies = (cookies, hosts) => listed(cookies).filter(visibleTo(listed(hosts)))

export const acceptedCookies = (changes, hosts) => listed(changes).filter(writableBy(listed(hosts)))

export function createCookies(stored, currentAddress) {
  let jar = Array.isArray(stored) ? stored : []
  const changes = []
  const record = (changed) => {
    changes.push(...changed)
    jar = mergeCookies(jar, changed)
  }
  const inScope = (address) => jar.filter(sentTo(addressParts(String(address))))
  const named = (address, name) => inScope(address).filter((cookie) => cookie.name === name)
  const set = async (address, items) => record(items.map((item) => cookieFor(address, item)))
  const remove = async (address, name) => record(named(address, name).map(retired))
  const removeAll = async (address) => record(inScope(address).map(retired))
  const list = createPropertyList({
    read: () => inScope(currentAddress()).map(entryOf),
    sameKey: (first, second) => first === second,
    format: ({ key, value }) => `${key}=${value}`,
    separator: COOKIE_SEPARATOR,
  })
  const jarApi = () => ({
    setCookie: (address, nameOrItem, value) => set(address, [typeof nameOrItem === 'object' ? nameOrItem : { key: nameOrItem, value }]),
    setCookies: (address, items) => set(address, items),
    getCookie: async (address, name) => {
      const [found] = named(address, name)
      return found ? entryOf(found) : null
    },
    hasCookie: async (address, name, callback) => {
      const exists = named(address, name).length > 0
      if (typeof callback === 'function') callback(null, exists)
      return exists
    },
    getCookies: async (address) => inScope(address).map(entryOf),
    deleteCookie: remove,
    deleteCookies: removeAll,
    clear: async () => record(jar.map(retired)),
  })
  const api = {
    ...list,
    add: (item) => set(currentAddress(), [item]),
    upsert: (item) => set(currentAddress(), [item]),
    remove: (name) => remove(currentAddress(), name),
    delete: (name) => remove(currentAddress(), name),
    clear: () => removeAll(currentAddress()),
    jar: jarApi,
  }
  return { api, changes }
}
