import { isLocalCommand } from './mcp'
import { AUTH_OAUTH2, normalizeRequest } from './request'

export const SCRIPT_FIELDS = ['preScript', 'postScript']

export const NO_AUTH = { type: '' }
export const NO_SCRIPTS = Object.fromEntries(SCRIPT_FIELDS.map((field) => [field, '']))

const hasScript = (request) => SCRIPT_FIELDS.some((field) => request[field].trim() !== '')

export const hasActiveContent = (request) => hasScript(request) || request.auth.type === AUTH_OAUTH2 || isLocalCommand(request)

export const withoutActiveContent = (request) => normalizeRequest({
  ...request,
  ...NO_SCRIPTS,
  auth: request.auth.type === AUTH_OAUTH2 ? NO_AUTH : request.auth,
  url: isLocalCommand(request) ? '' : request.url,
})
