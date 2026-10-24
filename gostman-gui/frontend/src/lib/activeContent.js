import { attachesFile, withoutAttachedFiles } from './attachments'
import { isLocalCommand } from './mcp'
import { AUTH_OAUTH2, normalizeRequest } from './request'
import { someText, mapText } from './textValues'
import { hasFileReference, withoutFileReferences } from './variables'

export const SCRIPT_FIELDS = ['preScript', 'postScript']

export const NO_AUTH = { type: '' }
export const NO_SCRIPTS = Object.fromEntries(SCRIPT_FIELDS.map((field) => [field, '']))

const hasScript = (request) => SCRIPT_FIELDS.some((field) => request[field].trim() !== '')

const readsFiles = (request) => someText(request, hasFileReference) || attachesFile(request.body)

export const withoutFileContent = (value) => mapText(value, withoutFileReferences)

const ACTIVE_CHECKS = {
  scripts: hasScript,
  oauth: (request) => request.auth.type === AUTH_OAUTH2,
  commands: isLocalCommand,
  files: readsFiles,
}

export const activeKinds = (request) => Object.keys(ACTIVE_CHECKS).filter((kind) => ACTIVE_CHECKS[kind](request))

export const hasActiveContent = (request) => activeKinds(request).length > 0

export function withoutActiveContent(request) {
  const stripped = withoutFileContent(request)
  return normalizeRequest({
    ...stripped,
    ...NO_SCRIPTS,
    body: withoutAttachedFiles(stripped.body),
    auth: stripped.auth.type === AUTH_OAUTH2 ? NO_AUTH : stripped.auth,
    url: isLocalCommand(stripped) ? '' : stripped.url,
  })
}
