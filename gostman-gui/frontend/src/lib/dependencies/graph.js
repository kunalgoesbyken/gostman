import { parseExtractors } from '../chaining'
import { isPlainObject, parseJSON } from '../dataUtils'
import { compareText } from '../i18n/format'
import { environmentEntries } from '../variableScopes'
import { placeholderSources } from '../placeholders'
import { PROCESS_PREFIX } from '../scripting/scopes'
import { isDynamicName, isPromptName } from '../variableNames'
import { CALL_READ, CALL_WRITE, scriptCalls } from './scriptCalls'

export const STATUS_PRODUCED = 'produced'
export const STATUS_DEFINED = 'defined'
export const STATUS_MISSING = 'missing'

const READ_FIELDS = ['url', 'headers', 'queryParams', 'body', 'graphqlQuery', 'graphqlVariables', 'grpcMessage', 'mcpArguments', 'socketMessages']
const SCRIPT_FIELDS = ['preScript', 'postScript']

const isReadableName = (name) => name !== '' && !isDynamicName(name) && !isPromptName(name) && !name.startsWith(PROCESS_PREFIX)

const textOf = (value) => (typeof value === 'string' ? value : JSON.stringify(value) ?? '')

const callsOf = (request) => SCRIPT_FIELDS.flatMap((field) => scriptCalls(request[field] || ''))

const namesOf = (calls, kind) => calls.filter((call) => call.kind === kind).map((call) => call.name)

const extractedNames = (request) => parseExtractors(request.extractors).filter((rule) => rule.enabled && rule.name !== '').map((rule) => rule.name)

const placeholderReads = (request) => [...READ_FIELDS.map((field) => request[field] || ''), textOf(request.auth)].flatMap(placeholderSources)

const ownNames = (request) => {
  const own = parseJSON(request.vars || '{}', {})
  return new Set(isPlainObject(own) ? Object.keys(own) : [])
}

function dependenciesOf(request) {
  const calls = callsOf(request)
  const own = ownNames(request)
  const reads = [...placeholderReads(request), ...namesOf(calls, CALL_READ)].filter((name) => isReadableName(name) && !own.has(name))
  return { writes: [...extractedNames(request), ...namesOf(calls, CALL_WRITE)], reads }
}

function entryFor(entries, name) {
  if (!entries.has(name)) entries.set(name, { name, producers: new Set(), consumers: new Set() })
  return entries.get(name)
}

export function definedVariableNames({ environments, globalEnvironments, collectionVariables, folders }) {
  const holders = [...environments, ...globalEnvironments].flatMap((environment) => environmentEntries(environment).map((entry) => entry.name))
  const lists = [collectionVariables, ...folders.map((folder) => folder.collectionVariables)]
  const listed = lists.flatMap((list) => {
    const parsed = parseJSON(list || '{}', {})
    return isPlainObject(parsed) ? Object.keys(parsed) : []
  })
  return new Set([...holders, ...listed])
}

const statusOf = (entry, defined) => {
  if (entry.producers.size > 0) return STATUS_PRODUCED
  return defined.has(entry.name) ? STATUS_DEFINED : STATUS_MISSING
}

export function buildDependencyGraph({ requests, defined, scopeIds }) {
  const entries = new Map()
  for (const request of requests) {
    const { writes, reads } = dependenciesOf(request)
    writes.forEach((name) => entryFor(entries, name).producers.add(request.id))
    reads.forEach((name) => entryFor(entries, name).consumers.add(request.id))
  }
  const inScope = (entry) => [...entry.producers, ...entry.consumers].some((id) => scopeIds.has(id))
  const variables = [...entries.values()]
    .filter(inScope)
    .map((entry) => ({ name: entry.name, producers: [...entry.producers], consumers: [...entry.consumers], status: statusOf(entry, defined) }))
    .sort((first, second) => compareText(first.name, second.name))
  return { variables, missing: variables.filter((variable) => variable.status === STATUS_MISSING && variable.consumers.length > 0) }
}
