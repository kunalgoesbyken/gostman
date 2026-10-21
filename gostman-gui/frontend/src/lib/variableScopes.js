import { isPlainObject, parseJSON } from './dataUtils'
import { parseRows } from './rows'
import { PROCESS_PREFIX, PROMPT_PREFIX } from './variableNames'

export const SCOPE_GLOBAL = 'global'
export const SCOPE_COLLECTION = 'collection'

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
    }))
}

export function withEntries(environment, entries) {
  const variables = {}
  const meta = {}
  for (const { name, value, secret, enabled } of entries) {
    if (name.trim() === '') continue
    variables[name] = value
    if (secret || !enabled) meta[name] = { ...(secret && { secret: true }), ...(!enabled && { enabled: false }) }
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

export function withoutSecretValues(environments) {
  return environments.map((environment) => {
    const secrets = environmentEntries(environment).filter((entry) => entry.secret).map((entry) => entry.name)
    if (secrets.length === 0) return environment
    const kept = Object.fromEntries(Object.entries(parseObject(environment.variables)).filter(([name]) => !secrets.includes(name)))
    return { ...environment, variables: JSON.stringify(kept, null, 2) }
  })
}

const environmentLayers = (source, environments, environment) => (
  environmentChain(environments, environment).map((link) => ({
    source,
    entries: environmentEntries(link).filter((entry) => entry.enabled),
  }))
)

const objectLayer = (source, text) => ({
  source,
  entries: Object.entries(parseObject(text)).filter(([, value]) => value !== null).map(([name, value]) => ({ name, value })),
})

const rowsLayer = (text) => ({
  source: 'request',
  entries: parseRows(text).filter((row) => row.enabled && row.key.trim() !== '').map((row) => ({ name: row.key, value: row.value })),
})

export const dotEnvEntries = (dotEnv) => (
  Object.entries(dotEnv).map(([name, value]) => ({ name: PROCESS_PREFIX + name, value, secret: true, enabled: true }))
)

const dotEnvLayer = (dotEnv) => ({ source: 'process', entries: dotEnvEntries(dotEnv || {}) })

function folderLayers(folders, folderId) {
  const chain = []
  for (let current = findById(folders, folderId); current && !chain.includes(current); current = findById(folders, current.parentId)) {
    chain.unshift(current)
  }
  return chain.map((folder) => objectLayer('folder', folder.variables))
}

export function scopeLayers(state, request) {
  const activeGlobal = findById(state.globalEnvironments, state.activeGlobalEnvironmentId)
  const activeEnvironment = findById(state.environments, state.activeEnvironmentId) || state.environments[0]
  return [
    dotEnvLayer(state.dotEnv),
    ...(activeGlobal ? environmentLayers('global', state.globalEnvironments, activeGlobal) : []),
    objectLayer('collection', state.collectionVariables),
    ...(activeEnvironment ? environmentLayers('environment', state.environments, activeEnvironment) : []),
    ...folderLayers(state.folders, request?.folderId),
    rowsLayer(request?.vars),
  ]
}

export function resolveLayers(layers) {
  const resolved = new Map()
  for (const layer of layers) {
    for (const { name, value, secret } of layer.entries) {
      resolved.set(name, { value: asText(value), secret: secret === true, source: layer.source })
    }
  }
  return resolved
}

export const variableText = (resolved) => (
  JSON.stringify(Object.fromEntries(Array.from(resolved, ([name, { value }]) => [name, value])))
)

export const exportableVariables = (resolved) => (
  Object.fromEntries(Array.from(resolved).filter(([, { secret }]) => !secret).map(([name, { value }]) => [name, value]))
)

export function variableMap(resolved) {
  const map = new Map(Array.from(resolved, ([name, { value }]) => [name, value]))
  map.details = resolved
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
