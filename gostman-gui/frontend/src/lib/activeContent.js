import { isLocalCommand } from './mcp'
import { AUTH_OAUTH2, normalizeRequest } from './request'
import { hasFileReference, withoutFileReferences } from './variables'

export const SCRIPT_FIELDS = ['preScript', 'postScript']

export const NO_AUTH = { type: '' }
export const NO_SCRIPTS = Object.fromEntries(SCRIPT_FIELDS.map((field) => [field, '']))

const hasScript = (request) => SCRIPT_FIELDS.some((field) => request[field].trim() !== '')

function someText(value, test) {
  if (typeof value === 'string') return test(value)
  if (value && typeof value === 'object') return Object.values(value).some((nested) => someText(nested, test))
  return false
}

function mapText(value, change) {
  if (typeof value === 'string') return change(value)
  if (Array.isArray(value)) return value.map((nested) => mapText(nested, change))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, mapText(nested, change)]))
  return value
}

const readsFiles = (request) => someText(request, hasFileReference)

export const withoutFileContent = (value) => mapText(value, withoutFileReferences)

export const hasActiveContent = (request) => (
  hasScript(request) || request.auth.type === AUTH_OAUTH2 || isLocalCommand(request) || readsFiles(request)
)

export function withoutActiveContent(request) {
  const stripped = withoutFileContent(request)
  return normalizeRequest({
    ...stripped,
    ...NO_SCRIPTS,
    auth: stripped.auth.type === AUTH_OAUTH2 ? NO_AUTH : stripped.auth,
    url: isLocalCommand(stripped) ? '' : stripped.url,
  })
}
