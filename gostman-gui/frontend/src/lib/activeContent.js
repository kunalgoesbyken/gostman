import { attachedPaths, attachesFile, withoutAttachedFiles } from './attachments'
import { isLocalCommand } from './mcp'
import { AUTH_OAUTH2, normalizeRequest } from './request'
import { someText, mapText, textsIn } from './textValues'
import { fileReferencesIn, hasFileReference, withoutFileReferences } from './variables'
import { filePathOf } from './variableNames'

export const SCRIPT_FIELDS = ['preScript', 'postScript']

export const NO_AUTH = { type: '' }
export const NO_SCRIPTS = Object.fromEntries(SCRIPT_FIELDS.map((field) => [field, '']))

const hasScript = (request) => SCRIPT_FIELDS.some((field) => request[field].trim() !== '')

export const readsFiles = (request) => someText(request, hasFileReference) || attachesFile(request.body)

export const withoutFileContent = (value) => mapText(value, withoutFileReferences)

const fileReadsOf = (request) => [...textsIn(request).flatMap(fileReferencesIn), ...attachedPaths(request.body)]

export function addsFileReads(before, after) {
  const known = new Set(fileReadsOf(before))
  return fileReadsOf(after).some((read) => !known.has(read))
}

const readPathsOf = (value) => [...textsIn(value).flatMap(fileReferencesIn).map(filePathOf), ...attachedPaths(value.body)]

export const filePathsIn = (values) => [...new Set(values.filter(Boolean).flatMap(readPathsOf).filter(Boolean))]

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
