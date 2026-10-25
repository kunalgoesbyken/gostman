import { buildCollectionTree, collectRequests, foldersIn, ROOT_ID } from './collectionTree'
import { isSecretField, SCHEMES } from './authSchemes'
import { isPlainObject, parseJSON } from './dataUtils'
import { parseExamples } from './examples'
import { activeKindsOf, countActiveRequests, exportToGostman, parseImport, sanitizeImport } from './importExport'
import { ShareError } from './share'
import { SCRIPT_FIELDS } from './activeContent'
import { placeholderNames } from './placeholders'
import { environmentChain, environmentEntries, usedVariableNames, withEntries } from './variableScopes'
import { environmentsForShare, foldersForShare, isScoped, ownsCollectionVariables } from './environmentScope'

const PLACEHOLDER_START = '{{'
const AUTH_SECRET_FIELDS = ['password', 'token', 'value']
const OAUTH_SECRET_FIELDS = ['clientSecret', 'password']
const NOTHING_EXISTING = { requestIds: [], folderIds: [] }
const QUOTES = ['"', "'", '`']

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

function folderChain(folders, folderId) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const chain = []
  for (let folder = byId.get(folderId); folder && !chain.includes(folder); folder = byId.get(folder.parentId)) chain.push(folder)
  return chain.reverse()
}

function selectionOf(requests, folders, scopeId) {
  const folder = folders.find((candidate) => candidate.id === scopeId)
  if (folder) return folderSelection(requests, folders, folder)
  const request = requests.find((candidate) => candidate.id === scopeId)
  return request ? { requests: [request], folders: folderChain(folders, request.folderId) } : { requests, folders }
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

const withoutCollectionValues = (folder) => (ownsCollectionVariables(folder)
  ? { ...folder, collectionVariables: withoutValues({ variables: folder.collectionVariables }).variables }
  : folder)

const scriptsOf = ({ requests, folders }) => [...requests, ...folders].flatMap((item) => SCRIPT_FIELDS.map((field) => item[field] || ''))

const quotedIn = (scripts, name) => QUOTES.some((quote) => scripts.some((script) => script.includes(`${quote}${name}${quote}`)))

function referencedNames(selected, entries) {
  const scripts = scriptsOf(selected)
  const names = usedVariableNames([selected.requests, selected.folders])
  entries.filter(({ name }) => quotedIn(scripts, name)).forEach(({ name }) => names.add(name))
  for (let size = 0; size !== names.size;) {
    size = names.size
    entries.filter(({ name }) => names.has(name)).flatMap(({ value }) => placeholderNames(String(value))).forEach((name) => names.add(name))
  }
  return names
}

function referencedEnvironments(environments, names) {
  const reduced = environments.map((environment) => withEntries(environment, environmentEntries(environment).filter(({ name }) => names.has(name))))
  const used = reduced.filter((environment) => variableNames(environment).length > 0)
  const kept = new Set(used.flatMap((environment) => environmentChain(reduced, environment)))
  return reduced.filter((environment) => kept.has(environment))
}

const uniqueSorted = (names) => Array.from(new Set(names)).sort()

export const sharedVariableNames = (exported) => uniqueSorted(exported.gostman.environments.flatMap(variableNames))

export const sharedCollectionVariableNames = (exported) => uniqueSorted([
  ...Object.keys(exported.gostman.variables),
  ...exported.gostman.folders.filter(ownsCollectionVariables).flatMap((folder) => variableNames({ variables: folder.collectionVariables })),
])

const valuesOf = (entries) => Object.fromEntries(entries.map(({ name, value }) => [name, value]))

const listEntries = (folder) => environmentEntries({ variables: folder.collectionVariables, meta: folder.collectionVariablesMeta })

const keepingNames = (folder, names) => (ownsCollectionVariables(folder)
  ? { ...folder, collectionVariables: JSON.stringify(valuesOf(listEntries(folder).filter(({ name }) => names.has(name))), null, 2) }
  : folder)

function referencedScopes(selected, environments, folders, collectionVariables) {
  const scoped = environmentsForShare(environments, folders, selected.folders)
  const carried = foldersForShare(folders, selected.folders, valuesOf(environmentEntries(collectionVariables)))
  const names = referencedNames(selected, [...scoped.flatMap(environmentEntries), ...carried.filter(ownsCollectionVariables).flatMap(listEntries)])
  return { environments: referencedEnvironments(scoped, names), folders: carried.map((folder) => keepingNames(folder, names)) }
}

export function buildSharedExport({ requests, folders, environments, collectionVariables = {}, settings, sharedOrder }, { folderId, includeVariables, includeExamples }) {
  const selected = selectionOf(requests, folders, folderId)
  const { environments: shared, folders: sharedFolders } = folderId
    ? referencedScopes(selected, environments, folders, collectionVariables)
    : { environments, folders: selected.folders }
  const sharedList = folderId ? {} : collectionVariables
  return exportToGostman(
    includeExamples ? selected.requests : selected.requests.map(withoutExamples),
    includeVariables ? sharedFolders : sharedFolders.map(withoutCollectionValues),
    includeVariables ? shared : shared.map(withoutValues),
    folderId ? undefined : settings,
    includeVariables ? sharedList : { ...sharedList, variables: withoutValues({ variables: sharedList.variables }).variables },
    sharedOrder,
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
    activeKinds: activeKindsOf(data),
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

export function keepingOwnVariables(imported, environments, folders = []) {
  const data = sanitizeImport(imported, NOTHING_EXISTING)
  const existingNamed = (incoming) => (incoming.folderId
    ? undefined
    : environments.find((environment) => environment.name === incoming.name && !isScoped(environment, folders)))
  return {
    ...data,
    environments: data.environments.map((environment) => unknownVariables(environment, existingNamed(environment))),
  }
}
