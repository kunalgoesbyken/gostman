import { buildCollectionTree, collectRequests, foldersIn, ROOT_ID } from './collectionTree'
import { isSecretField, SCHEMES } from './authSchemes'
import { isPlainObject, parseJSON } from './dataUtils'
import { parseExamples } from './examples'
import { countActiveRequests, exportToGostman, parseImport, sanitizeImport } from './importExport'
import { ShareError } from './share'

const PLACEHOLDER_START = '{{'
const AUTH_SECRET_FIELDS = ['password', 'token', 'value']
const OAUTH_SECRET_FIELDS = ['clientSecret', 'password']
const NOTHING_EXISTING = { requestIds: [], folderIds: [] }

const descendantsOf = (tree, folderId) => (
  foldersIn(tree, folderId).flatMap((folder) => [folder, ...descendantsOf(tree, folder.id)])
)

function folderSelection(requests, folders, folder) {
  const tree = buildCollectionTree(folders, requests)
  return {
    requests: collectRequests(tree, folder.id),
    folders: [{ ...folder, parentId: ROOT_ID }, ...descendantsOf(tree, folder.id)],
  }
}

function selectionOf(requests, folders, folderId) {
  const folder = folders.find((candidate) => candidate.id === folderId)
  return folder ? folderSelection(requests, folders, folder) : { requests, folders }
}

function variableNames(environment) {
  const variables = parseJSON(environment.variables, null)
  return isPlainObject(variables) ? Object.keys(variables) : []
}

const withoutValues = (environment) => ({
  ...environment,
  variables: JSON.stringify(Object.fromEntries(variableNames(environment).map((name) => [name, '']))),
})

const withoutExamples = (request) => ({ ...request, examples: '' })

export function buildSharedExport({ requests, folders, environments, settings }, { folderId, includeVariables, includeExamples }) {
  const selected = selectionOf(requests, folders, folderId)
  return exportToGostman(
    includeExamples ? selected.requests : selected.requests.map(withoutExamples),
    selected.folders,
    includeVariables ? environments : environments.map(withoutValues),
    folderId ? undefined : settings
  )
}

const isLiteralSecret = (value) => typeof value === 'string' && value !== '' && !value.includes(PLACEHOLDER_START)

const hasLiteralSchemeSecret = (auth) => Object.values(SCHEMES).some(({ section, fields }) => (
  fields.some((field) => isSecretField(field) && isLiteralSecret((section ? auth[section] : auth)?.[field.key]))
))

const hasLiteralCredentials = ({ auth }) => (
  AUTH_SECRET_FIELDS.some((field) => isLiteralSecret(auth[field]))
  || OAUTH_SECRET_FIELDS.some((field) => isLiteralSecret(auth.oauth2[field]))
  || hasLiteralSchemeSecret(auth)
)

export const countLiteralCredentials = (requests) => requests.filter(hasLiteralCredentials).length

const exampleCount = (requests) => requests.reduce((total, request) => total + parseExamples(request.examples).length, 0)

const describeEnvironment = (environment) => {
  const variables = parseJSON(environment.variables, {})
  const values = isPlainObject(variables) ? Object.values(variables) : []
  return { name: environment.name, variableCount: values.length, valueCount: values.filter((value) => value !== '').length }
}

export function describeShared(imported) {
  const data = sanitizeImport(imported, NOTHING_EXISTING)
  return {
    requests: data.requests.map(({ id, name, method, url }) => ({ id, name, method, url })),
    folders: data.folders.map(({ id, name }) => ({ id, name })),
    environments: data.environments.map(describeEnvironment),
    activeCount: countActiveRequests(data),
    exampleCount: exampleCount(data.requests),
    warnings: data.warnings,
  }
}

export async function readShared(text) {
  const imported = await parseImport(text)
  if (!imported.success) throw new ShareError(imported.error)
  return imported
}

function unknownVariables(incoming, existing) {
  const known = existing ? variableNames(existing) : []
  const variables = parseJSON(incoming.variables, {})
  const added = Object.entries(isPlainObject(variables) ? variables : {}).filter(([name]) => !known.includes(name))
  return { ...incoming, variables: JSON.stringify(Object.fromEntries(added)) }
}

export function keepingOwnVariables(imported, environments) {
  const existingNamed = (name) => environments.find((environment) => environment.name === name)
  const data = sanitizeImport(imported, NOTHING_EXISTING)
  return {
    ...data,
    variables: {},
    environments: data.environments.map((environment) => unknownVariables(environment, existingNamed(environment.name))),
  }
}
