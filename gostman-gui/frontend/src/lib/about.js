import { isDesktopApp } from './platform'

export const ABOUT_LINKS = [
  { id: 'website', url: 'https://gostman.vercel.app' },
  { id: 'source', url: 'https://github.com/kunalgoesbyken/gostman' },
  { id: 'releases', url: 'https://github.com/kunalgoesbyken/gostman/releases' },
  { id: 'issues', url: 'https://github.com/kunalgoesbyken/gostman/issues' },
  { id: 'licence', url: 'https://github.com/kunalgoesbyken/gostman/blob/main/LICENSE' },
]

export const LICENCE_NAME = 'MIT'

const platformOf = () => navigator.userAgentData?.platform || navigator.platform || ''

export function buildDiagnostics({ version, requests, folders, environments, theme }) {
  return JSON.stringify({
    app: 'Gostman',
    version,
    runtime: isDesktopApp() ? 'desktop' : 'web',
    platform: platformOf(),
    language: navigator.language,
    theme,
    online: navigator.onLine,
    collections: { requests: requests.length, folders: folders.length, environments: environments.length },
  }, null, 2)
}

export function openExternal(event, url) {
  const open = window.runtime?.BrowserOpenURL
  if (!open) return
  event.preventDefault()
  open(url)
}
