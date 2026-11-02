import { isDesktopApp } from './platform'
import { WEB_APP_URL } from './constants'

export const ABOUT_LINKS = [
  { id: 'website', url: WEB_APP_URL },
  { id: 'source', url: 'https://github.com/kunalgoesbyken/gostman' },
  { id: 'releases', url: 'https://github.com/kunalgoesbyken/gostman/releases' },
  { id: 'issues', url: 'https://github.com/kunalgoesbyken/gostman/issues' },
]

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
