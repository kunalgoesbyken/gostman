import { isPlainObject, parseJSON } from './dataUtils'
import { placeholderNames } from './placeholders'
import { parseRows } from './rows'
import { connectionDirectory } from './secretOrigins'
import { chosenEnvironment, variableHolders } from './environmentScope'
import { PROCESS_PREFIX, PROMPT_PREFIX } from './variableNames'

export { SCOPE_COLLECTION, SCOPE_GLOBAL } from './scripting/scopes'

const PROMPT_TOKEN = /\{\{\s*\?([^{}]*?)\s*\}\}/gu

export const asText = (value) => (value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value))

const parseObject = (text) => {
  const parsed = parseJSON(text || '{}', null)
  return isPlainObject(parsed) ? parsed : {}
}

const findById = (environments, id) => (id ? environments.find((environment) => environment.id === id) : undefined)

export function environmentEntries(environment) {
  const meta = parseObject(environment.meta)
  return Object.entries(parseObject(environment.variables))
    .filter(([, value]) => value !== null)
    .map(([name, value]) => ({
      name,
      value,
      secret: meta[name]?.secret === true,
      enabled: meta[name]?.enabled !== false,
      ref: meta[name]?.ref,
    }))
}

export function withEntries(environment, entries) {
  const variables = {}
  const meta = {}
  for (const { name, value, secret, enabled, ref } of entries) {
    if (name.trim() === '') continue
    variables[name] = value
    if (secret || !enabled || ref) meta[name] = { ...(secret && { secret: true }), ...(!enabled && { enabled: false }), ...(ref && { ref }) }
  }
  return { ...environment, variables: JSON.stringify(variables, null, 2), meta: JSON.stringify(meta) }
}

export function environmentChain(environments, environment) {
  const chain = []
  for (let current = environment; current && !chain.includes(current); current = findById(environments, current.extends)) {
    chain.unshift(current)
  }
  return chain
}

const secretNamesOf = (meta) => Object.entries(parseObject(meta)).filter(([, mark]) => mark?.secret === true).map(([name]) => name)

export function withSecretMarks(meta, incoming, names) {
  const marked = secretNamesOf(incoming).filter((name) => names.includes(name))
  if (marked.length === 0) return meta
  const current = parseObject(meta)
  return JSON.stringify({ ...current, ...Object.fromEntries(marked.map((name) => [name, { ...current[name], secret: true }])) })
}

export const listWithoutSecrets = (variables, meta) => withoutSecretValues([{ variables, meta }])[0].variables

export const foldersWithoutSecrets = (folders) => folders.map((folder) => (
  typeof folder.collectionVariables === 'string' && folder.collectionVariablesMeta
    ? { ...folder, collectionVariables: listWithoutSecrets(folder.collectionVariables, folder.collectionVariablesMeta) }
    : folder
))

export function withoutSecretValues(environments) {
  return environments.map((environment) => {
    const secrets = environmentEntries(environment).filter((entry) => entry.secret).map((entry) => entry.name)
    if (secrets.length === 0) return environment
    const kept = Object.fromEntries(Object.entries(parseObject(environment.variables)).filter(([name]) => !secrets.includes(name)))
    return { ...environment, variables: JSON.stringify(kept, null, 2) }
  })
}

const referenceEntry = (entry, referenced) => (
  entry.ref ? { ...entry, secret: true, value: referenced[entry.name] ?? '' } : entry
)

const environmentLayers = (source, environments, environment, referenced) => (
  environmentChain(environments, environment).map((link) => ({
    source,
    entries: environmentEntries(link).filter((entry) => entry.enabled).map((entry) => referenceEntry(entry, referenced)),
  }))
)

const objectLayer = (source, text) => ({
  source,
  entries: Object.entries(parseObject(text)).filter(([, value]) => value !== null).map(([name, value]) => ({ name, value })),
})

const listLayer = (source, variables, meta) => ({
  source,
  entries: environmentEntries({ variables, meta }).filter((entry) => entry.enabled),
})

const rowsLayer = (text) => ({
  source: 'request',
  entries: parseRows(text).filter((row) => row.enabled && row.key.trim() !== '').map((row) => ({ name: row.key, value: row.value })),
})

export const dotEnvEntries = (dotEnv) => (
  Object.entries(dotEnv).map(([name, value]) => ({ name: PROCESS_PREFIX + name, value, secret: true, enabled: true }))
)

export const sessionEntries = (values) => (
  Object.entries(values || {}).map(([name, value]) => ({ name, value, secret: true, enabled: true }))
)

const sessionLayer = (values) => ({ source: 'session', entries: sessionEntries(values) })

const dotEnvLayer = (dotEnv) => ({ source: 'process', entries: dotEnvEntries(dotEnv || {}) })

export function folderChain(folders, folderId) {
  const chain = []
  for (let current = findById(folders, folderId); current && !chain.includes(current); current = findById(folders, current.parentId)) {
    chain.unshift(current)
  }
  return chain
}

function folderLayers(folders, folderId) {
  return folderChain(folders, folderId).map((folder) => objectLayer('folder', folder.variables))
}

export function scopeLayers(state, request, referenced = {}) {
  const activeGlobal = state.isRestricted ? undefined : findById(state.globalEnvironments, state.activeGlobalEnvironmentId)
  const activeEnvironment = chosenEnvironment(state, request?.folderId || '')
  return [
    dotEnvLayer(state.dotEnv),
    ...(activeGlobal ? environmentLayers('global', state.globalEnvironments, activeGlobal, referenced) : []),
    listLayer('collection', state.collectionVariables, state.collectionVariablesMeta),
    ...variableHolders(state.folders, request?.folderId).map((folder) => listLayer('collection', folder.collectionVariables, folder.collectionVariablesMeta)),
    ...(activeEnvironment ? environmentLayers('environment', state.environments, activeEnvironment, referenced) : []),
    ...folderLayers(state.folders, request?.folderId),
    rowsLayer(request?.vars),
    sessionLayer(state.sessionVariables),
  ]
}

export function resolveLayers(layers) {
  const resolved = new Map()
  for (const layer of layers) {
    for (const { name, value, secret, ref } of layer.entries) {
      resolved.set(name, { value: asText(value), typed: value, secret: secret === true, source: layer.source, ref })
    }
  }
  return resolved
}

export const scriptValues = (resolved) => (
  Object.fromEntries(Array.from(resolved, ([name, { typed }]) => [name, typed]))
)

export const variableText = (resolved) => (
  JSON.stringify(Object.fromEntries(Array.from(resolved, ([name, { value }]) => [name, value])))
)

export const exportableVariables = (resolved) => (
  Object.fromEntries(Array.from(resolved).filter(([, { secret }]) => !secret).map(([name, { value }]) => [name, value]))
)

export function variableMap(resolved, connections = null) {
  const map = new Map(Array.from(resolved, ([name, { value }]) => [name, value]))
  map.details = resolved
  map.connections = connections && connectionDirectory(connections)
  return map
}

function collectStrings(value, found) {
  if (typeof value === 'string') found.push(value)
  else if (value !== null && typeof value === 'object') Object.values(value).forEach((item) => collectStrings(item, found))
  return found
}

export function promptNames(request) {
  const names = new Set()
  for (const text of collectStrings(request, [])) {
    for (const match of text.matchAll(PROMPT_TOKEN)) names.add(match[1])
  }
  return Array.from(names).filter((name) => name !== '')
}

export const promptLayer = (answers) => ({
  source: 'request',
  entries: Object.entries(answers).map(([name, value]) => ({ name: PROMPT_PREFIX + name, value })),
})

const withoutPromptPrefix = (name) => (name.startsWith(PROMPT_PREFIX) ? name.slice(PROMPT_PREFIX.length).trim() : name)

export const usedVariableNames = (value) => new Set(collectStrings(value, []).flatMap(placeholderNames).map(withoutPromptPrefix))

export function referenceTargets(state, request, used) {
  const resolved = resolveLayers(scopeLayers(state, request))
  const isWanted = ([name, { ref }]) => ref && (!used || used.has(name))
  return Object.fromEntries(Array.from(resolved).filter(isWanted).map(([name, { ref }]) => [name, ref]))
}
