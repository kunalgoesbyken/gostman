import { redactText } from './redact'
import { isSensitiveName } from './sensitiveNames'

const TOKEN_LABEL = 'oauth.accessToken'
const REFRESH_LABEL = 'oauth.refreshToken'
const QUERY_LABEL = 'query.'
const SESSION_SOURCE = 'session'

const isSecretVariable = (name, entry) => (entry.secret && entry.source !== SESSION_SOURCE) || isSensitiveName(name)

const variableSecrets = (resolved) => Array.from(resolved)
  .filter(([name, entry]) => isSecretVariable(name, entry))
  .map(([name, entry]) => ({ label: name, value: entry.value }))

const tokenSecrets = (oauth2) => [
  { label: TOKEN_LABEL, value: oauth2?.accessToken || '' },
  { label: REFRESH_LABEL, value: oauth2?.refreshToken || '' },
]

function querySecrets(address) {
  try {
    return Array.from(new URL(address).searchParams)
      .filter(([name]) => isSensitiveName(name))
      .map(([name, value]) => ({ label: QUERY_LABEL + name, value }))
  } catch {
    return []
  }
}

export function shownUrl(address, resolved, auth) {
  if (!address || address.trim() === '') return ''
  return redactText(address, [...variableSecrets(resolved), ...tokenSecrets(auth?.oauth2), ...querySecrets(address)])
}
