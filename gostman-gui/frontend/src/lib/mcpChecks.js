import { isPlainObject, parseJSON } from './dataUtils'
import { isSchemaType } from './jsonSchema'
import { MCP_TEXT } from './mcpText'
import { readStored, writeStored } from './storage'

const SEEN_TOOLS_KEY = 'gostman-mcp-tools'
const MIN_DESCRIPTION_LENGTH = 20
const MAX_NAME_LENGTH = 128
const MANY_TOOLS = 40
const NAME_SYMBOLS = new Set(['_', '-', '.'])

const isNameCharacter = (character) => /^[A-Za-z0-9]$/.test(character) || NAME_SYMBOLS.has(character)

const isValidName = (name) => name.length > 0 && name.length <= MAX_NAME_LENGTH && [...name].every(isNameCharacter)

const looseName = (name) => [...name.toLowerCase()].filter((character) => !NAME_SYMBOLS.has(character)).join('')

const typesOf = (schema) => (Array.isArray(schema.type) ? schema.type : [schema.type]).filter((type) => type !== undefined)

function schemaProblem(schema) {
  const text = MCP_TEXT.schemaProblems
  if (!isPlainObject(schema)) return text.notObject
  if (schema.type !== undefined && schema.type !== 'object') return text.rootType
  const properties = schema.properties ?? {}
  if (!isPlainObject(properties)) return text.properties
  for (const [name, property] of Object.entries(properties)) {
    if (!isPlainObject(property)) return text.property(name)
    const unknown = typesOf(property).find((type) => !isSchemaType(type))
    if (unknown !== undefined) return text.type(name, unknown)
  }
  if (schema.required !== undefined && !(Array.isArray(schema.required) && schema.required.every((name) => typeof name === 'string'))) return text.required
  return ''
}

function toolFindings(tool) {
  const findings = []
  const add = (code, detail = '') => findings.push({ code, tool: tool.name, detail })
  const description = tool.description.trim()
  if (!isValidName(tool.name)) add('invalidName')
  if (description === '') add('missingDescription')
  else if (description.length < MIN_DESCRIPTION_LENGTH) add('shortDescription', description)
  const schema = parseJSON(tool.inputSchema, null)
  const problem = schemaProblem(schema)
  if (problem) {
    add('invalidSchema', problem)
    return findings
  }
  const properties = schema.properties ?? {}
  const undocumented = Object.keys(properties).filter((name) => !String(properties[name].description ?? '').trim())
  if (undocumented.length > 0) add('undocumentedParameters', undocumented.join(', '))
  const unknown = (schema.required ?? []).filter((name) => !(name in properties))
  if (unknown.length > 0) add('unknownRequired', unknown.join(', '))
  return findings
}

function nameFindings(tools) {
  const findings = []
  const byLooseName = new Map()
  const counts = new Map()
  for (const { name } of tools) {
    counts.set(name, (counts.get(name) ?? 0) + 1)
    const loose = looseName(name)
    byLooseName.set(loose, [...(byLooseName.get(loose) ?? []), name])
  }
  for (const [name, count] of counts) {
    if (count > 1) findings.push({ code: 'duplicateName', tool: name, detail: '' })
  }
  for (const names of byLooseName.values()) {
    const distinct = [...new Set(names)]
    if (distinct.length > 1) findings.push({ code: 'similarNames', tool: distinct[0], detail: distinct.slice(1).join(', ') })
  }
  return findings
}

export function checkCatalog(catalog) {
  const tools = catalog.tools ?? []
  const findings = [
    ...(catalog.problems ?? []).map((problem) => ({ code: 'listFailed', tool: problem.method, detail: problem.message })),
    ...(catalog.rejected ?? []).map((rejection) => ({ code: 'rejected', tool: rejection.name, detail: rejection.reason })),
    ...nameFindings(tools),
    ...tools.flatMap(toolFindings),
  ]
  if (tools.length > MANY_TOOLS) findings.push({ code: 'manyTools', tool: '', detail: '' })
  return findings
}

export function describeFinding(finding, catalog) {
  const describe = MCP_TEXT.findings[finding.code]
  if (finding.code === 'manyTools') return describe(catalog.tools.length)
  return describe(finding.tool, finding.detail)
}

function readSeen() {
  const stored = parseJSON(readStored(SEEN_TOOLS_KEY) ?? '', {})
  return isPlainObject(stored) ? stored : {}
}

const recordsOf = (tools) => Object.fromEntries(tools.map((tool) => [tool.name, { fingerprint: tool.fingerprint, description: tool.description }]))

const readRecord = (stored) => (isPlainObject(stored) ? stored : { fingerprint: stored })

export function rememberTools(catalog) {
  writeStored(SEEN_TOOLS_KEY, JSON.stringify({ ...readSeen(), [catalog.serverKey]: recordsOf(catalog.tools ?? []) }))
}

const describeChange = (record, tool) => ({ name: tool.name, before: record.description, after: tool.description })

export function compareTools(catalog) {
  const seen = readSeen()[catalog.serverKey]
  if (!isPlainObject(seen)) return { firstSeen: true }
  const tools = catalog.tools ?? []
  const current = new Set(tools.map((tool) => tool.name))
  const added = tools.filter((tool) => !Object.hasOwn(seen, tool.name)).map((tool) => tool.name)
  const removed = Object.keys(seen).filter((name) => !current.has(name))
  const changed = tools
    .filter((tool) => Object.hasOwn(seen, tool.name) && readRecord(seen[tool.name]).fingerprint !== tool.fingerprint)
    .map((tool) => describeChange(readRecord(seen[tool.name]), tool))
  if (added.length + removed.length + changed.length === 0) return null
  return { added, removed, changed }
}
