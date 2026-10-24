function hostOf(address) {
  const trimmed = String(address ?? '').trim()
  if (trimmed.includes('://')) {
    try {
      return new URL(trimmed).hostname.toLowerCase()
    } catch {
      return ''
    }
  }
  const colon = trimmed.indexOf(':')
  return colon < 0 ? '' : trimmed.slice(trimmed.indexOf('@') + 1, colon).toLowerCase()
}

export function codeHostOf(address) {
  const host = hostOf(address)
  if (host === 'github.com' || host.startsWith('github.')) return 'github'
  if (host === 'gitlab.com' || host.startsWith('gitlab.')) return 'gitlab'
  if (host === 'bitbucket.org') return 'bitbucket'
  return ''
}

export const pullRequestRemote = (remotes) => remotes.find((remote) => remote.name === 'origin') || remotes[0]
