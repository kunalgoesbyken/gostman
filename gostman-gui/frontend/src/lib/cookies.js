export const MAX_STORED_COOKIES = 3000
export const MAX_COOKIES_PER_DOMAIN = 150

const identityOf =(cookie) => [cookie.domain, cookie.path, cookie.name].join('\n')

const hasExpired = (cookie, now) => cookie.expires !== '' && Date.parse(cookie.expires) <= now

const isLiveCookie = (cookie, now = Date.now()) => !cookie.expired && !hasExpired(cookie, now)

function newestPerDomain(cookies) {
  const counts = new Map()
  const kept = []
  for (const cookie of cookies.toReversed()) {
    const count = counts.get(cookie.domain) ?? 0
    if (count >= MAX_COOKIES_PER_DOMAIN) continue
    counts.set(cookie.domain, count + 1)
    kept.push(cookie)
  }
  return kept.reverse()
}

export function mergeCookies(stored, received, now = Date.now()) {
  const jar = new Map(stored.map((cookie) => [identityOf(cookie), cookie]))
  for (const cookie of received) {
    jar.delete(identityOf(cookie))
    jar.set(identityOf(cookie), cookie)
  }
  return newestPerDomain(Array.from(jar.values()).filter((cookie) => isLiveCookie(cookie, now))).slice(-MAX_STORED_COOKIES)
}

export const withoutCookie = (cookies, removed) => cookies.filter((cookie) => identityOf(cookie) !== identityOf(removed))
