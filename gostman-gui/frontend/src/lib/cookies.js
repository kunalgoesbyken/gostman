const identityOf = (cookie) => [cookie.domain, cookie.path, cookie.name].join('\n')

const hasExpired = (cookie, now) => cookie.expires !== '' && Date.parse(cookie.expires) <= now

export const isLiveCookie = (cookie, now = Date.now()) => !cookie.expired && !hasExpired(cookie, now)

export function mergeCookies(stored, received, now = Date.now()) {
  const jar = new Map(stored.map((cookie) => [identityOf(cookie), cookie]))
  for (const cookie of received) {
    jar.delete(identityOf(cookie))
    jar.set(identityOf(cookie), cookie)
  }
  return Array.from(jar.values()).filter((cookie) => isLiveCookie(cookie, now))
}

export const withoutCookie = (cookies, removed) => cookies.filter((cookie) => identityOf(cookie) !== identityOf(removed))
