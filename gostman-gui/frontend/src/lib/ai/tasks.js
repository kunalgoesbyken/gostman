import { OPERATORS, operatorOf, parseAssertions, serializeAssertions } from '../scripting/assertions'
import { formatSize } from '../dataUtils'
import { mayBeSpec } from '../openapiSpec'
import { normalizeRequest } from '../request'
import { serializeRows } from '../rows'
import { AI_TEXT } from '../aiText'
import { describeRequest, describeResponse, maskedUrl } from './context'
import { SCRIPT_API, SHAPES, fence, prompt } from './prompts'
import { ReplyError, objectsIn, parseModelObject, requireContent, stringsIn, textField } from './reply'
import { BODY_TYPES, METHODS, SCHEMAS } from './schemas'

export const TASK_REQUEST = 'request'
export const TASK_TESTS = 'tests'
export const TASK_SCRIPT = 'script'
export const TASK_EXPLAIN = 'explain'
export const TASK_DOCS = 'docs'
export const TASK_SEARCH = 'search'
export const TASK_SCHEMA = 'schema'

export const SCRIPT_PRE = 'preScript'
export const SCRIPT_POST = 'postScript'

const NAME_LIMIT = 120
const URL_LIMIT = 2048
const HEADER_LIMIT = 30
const HEADER_TEXT_LIMIT = 500
const BODY_LIMIT = 20000
const DESCRIPTION_LIMIT = 2000
const SCRIPT_LIMIT = 8000
const ASSERTION_LIMIT = 20
const ASSERTION_TEXT_LIMIT = 300
const SUGGESTION_LIMIT = 6
const SUGGESTION_TEXT_LIMIT = 400
const SEARCH_RESULT_LIMIT = 10
const SEARCH_INDEX_LIMIT = 300
const SCHEMA_BATCH = 15
const SCHEMA_TOTAL_LIMIT = 200
const SCHEMA_ASSERTIONS = 3
const SPEC_LIMIT = 64000
const LISTED_LINES = 200
const CURRENT_SCRIPT_LIMIT = 4096
const WEB_SCHEMES = ['http://', 'https://']
const TEMPLATE_START = '{{'
const OPERATOR_NAMES = OPERATORS.map((operator) => operator.value).join(', ')
const STATUS_FAILURE = 400

const hasControlCharacters = (text) => [...text].some((character) => character.charCodeAt(0) < 32)

const isUsableUrl = (url) => (
  url.length > 0 && !/\s/.test(url) && (url.startsWith(TEMPLATE_START) || WEB_SCHEMES.some((scheme) => url.toLowerCase().startsWith(scheme)))
)

const methodOf = (value) => (typeof value === 'string' && METHODS.includes(value.toUpperCase()) ? value.toUpperCase() : '')

function headerRows(list) {
  return objectsIn(list, HEADER_LIMIT)
    .map((row) => ({ key: textField(row.key, HEADER_TEXT_LIMIT).trim(), value: textField(row.value, HEADER_TEXT_LIMIT), enabled: true }))
    .filter((row) => row.key !== '' && !hasControlCharacters(row.key) && !hasControlCharacters(row.value))
}

function validAssertions(list) {
  return objectsIn(list, ASSERTION_LIMIT)
    .map((raw) => ({
      expression: textField(raw.expression, ASSERTION_TEXT_LIMIT).trim(),
      operator: OPERATORS.some((operator) => operator.value === raw.operator) ? raw.operator : '',
      value: typeof raw.value === 'string' || typeof raw.value === 'number' ? String(raw.value).slice(0, ASSERTION_TEXT_LIMIT) : '',
      enabled: true,
    }))
    .filter((assertion) => assertion.expression !== '' && assertion.operator !== '')
}

function draftFrom(raw) {
  const method = methodOf(raw.method)
  const url = textField(raw.url, URL_LIMIT).trim()
  if (!method || !isUsableUrl(url)) throw new ReplyError(AI_TEXT.badReply)
  const body = textField(raw.body, BODY_LIMIT)
  const bodyType = BODY_TYPES.includes(raw.bodyType) ? raw.bodyType : ''
  return normalizeRequest({
    name: textField(raw.name, NAME_LIMIT).trim() || AI_TEXT.tasks.request.untitled,
    description: textField(raw.description, DESCRIPTION_LIMIT),
    method,
    url,
    headers: serializeRows(headerRows(raw.headers)),
    body: bodyType === 'none' ? '' : body,
    bodyType,
    assertions: serializeAssertions(validAssertions(raw.assertions)),
  })
}

const assertionLine = (assertion) => {
  const operator = operatorOf(assertion)
  return [assertion.expression, operator.label, ...(operator.unary ? [] : [assertion.value])].join(' ')
}

const assertionText = (assertions) => assertions.map(assertionLine).join('\n')

function draftText(draft) {
  const headers = JSON.parse(draft.headers || '[]').map((row) => `${row.key}: ${row.value}`)
  return [`${draft.method} ${maskedUrl(draft.url)}`, ...headers, ...(draft.body ? ['', draft.body] : [])].join('\n')
}

const requestLine = (request) => `${request.method} ${request.url}  ${request.name}`

function requestLines(requests) {
  const shown = requests.slice(0, LISTED_LINES).map(requestLine)
  const hidden = requests.length - shown.length
  return [...shown, ...(hidden > 0 ? [AI_TEXT.tasks.schema.moreLines(hidden)] : [])].join('\n')
}

const sameAssertion = (first, second) => (
  first.expression === second.expression && first.operator === second.operator && first.value === second.value
)

const withoutDuplicates = (existing, proposed) => proposed.filter((candidate) => !existing.some((current) => sameAssertion(current, candidate)))

const joinScripts = (current, addition) => (current.trim() && addition.trim() ? `${current.replace(/\s+$/, '')}\n\n${addition}` : current || addition)

const requestTask = {
  id: TASK_REQUEST,
  text: AI_TEXT.tasks.request,
  needsText: true,
  schema: SCHEMAS.request,
  build: (source, input) => prompt(
    `Design one API request for this description: ${input.text}\nUse variables from the list when they fit, for example {{baseUrl}}. Reply with this shape: ${SHAPES.request}`,
    fence('variable-names', source.variableNames),
    fence('folder-names', source.folderNames),
  ),
  parse: (text) => {
    const draft = draftFrom(parseModelObject(text))
    return {
      sections: [{ label: AI_TEXT.tasks.request.section, before: '', after: draftText(draft) }],
      applyLabel: AI_TEXT.tasks.request.apply,
      apply: (host) => host.openDraft(draft),
    }
  },
}

const testsTask = {
  id: TASK_TESTS,
  text: AI_TEXT.tasks.tests,
  needsResponse: true,
  offersValues: true,
  schema: SCHEMAS.tests,
  build: (source, input) => prompt(
    `Write assertions that check this request's response. Reply with {"assertions": [${SHAPES.assertion}], "script": string}. Operators: ${OPERATOR_NAMES}. ${source.isRestricted ? 'Leave "script" empty.' : 'The optional post-response script may add test() checks.'}\n${SCRIPT_API}`,
    fence('request', describeRequest(source.request)),
    fence('response', describeResponse(source.response, input.includeValues)),
    fence('existing-assertions', assertionText(parseAssertions(source.request.assertions))),
    fence('existing-script', source.isRestricted ? '' : source.request.postScript.slice(0, CURRENT_SCRIPT_LIMIT)),
  ),
  parse: (text, source) => {
    const raw = parseModelObject(text)
    const proposed = validAssertions(raw.assertions)
    const script = source.isRestricted ? '' : textField(raw.script, SCRIPT_LIMIT)
    const existing = parseAssertions(source.request.assertions)
    const added = withoutDuplicates(existing, proposed)
    requireContent(added, script)
    const merged = [...existing, ...added]
    const nextScript = joinScripts(source.request.postScript, script)
    return {
      sections: [
        ...(added.length > 0 ? [{ label: AI_TEXT.tasks.tests.assertions, before: assertionText(existing), after: assertionText(merged) }] : []),
        ...(script ? [{ label: AI_TEXT.tasks.tests.script, before: source.request.postScript, after: nextScript }] : []),
      ],
      applyLabel: AI_TEXT.tasks.tests.apply,
      apply: (host) => host.updateRequest({ assertions: serializeAssertions(merged), ...(script && { postScript: nextScript }) }),
    }
  },
}

const SCRIPT_KINDS = AI_TEXT.tasks.script.kinds

const scriptTask = {
  id: TASK_SCRIPT,
  text: AI_TEXT.tasks.script,
  needsText: true,
  needsScriptKind: true,
  requiresTrust: true,
  schema: SCHEMAS.script,
  build: (source, input) => prompt(
    `Write the ${SCRIPT_KINDS[input.scriptKind]} JavaScript for this request: ${input.text}\nReply with {"script": string} holding the complete script.\n${SCRIPT_API}`,
    fence('request', describeRequest(source.request)),
    fence('current-script', source.request[input.scriptKind].slice(0, CURRENT_SCRIPT_LIMIT)),
    fence('variable-names', source.variableNames),
  ),
  parse: (text, source, input) => {
    const script = textField(parseModelObject(text).script, SCRIPT_LIMIT)
    requireContent(script)
    return {
      sections: [{ label: AI_TEXT.tasks.script.section(SCRIPT_KINDS[input.scriptKind]), before: source.request[input.scriptKind], after: script }],
      applyLabel: AI_TEXT.tasks.script.apply,
      apply: (host) => host.updateRequest({ [input.scriptKind]: script }),
    }
  },
}

const explainTask = {
  id: TASK_EXPLAIN,
  text: AI_TEXT.tasks.explain,
  needsResponse: true,
  offersValues: true,
  valuesByDefault: true,
  schema: SCHEMAS.explain,
  build: (source, input) => prompt(
    'Explain why this request failed or looks wrong and how to fix it. Reply with {"explanation": string, "causes": [string], "fixes": [string]}.',
    fence('request', describeRequest(source.request)),
    fence('response', describeResponse(source.response, input.includeValues)),
  ),
  parse: (text) => {
    const raw = parseModelObject(text)
    const explanation = textField(raw.explanation, DESCRIPTION_LIMIT)
    const causes = stringsIn(raw.causes, SUGGESTION_LIMIT, SUGGESTION_TEXT_LIMIT)
    const fixes = stringsIn(raw.fixes, SUGGESTION_LIMIT, SUGGESTION_TEXT_LIMIT)
    requireContent(explanation, causes, fixes)
    return {
      blocks: [
        { heading: AI_TEXT.tasks.explain.happened, text: explanation },
        { heading: AI_TEXT.tasks.explain.causes, items: causes },
        { heading: AI_TEXT.tasks.explain.fixes, items: fixes },
      ].filter((block) => block.text || block.items?.length),
    }
  },
}

const docsTask = {
  id: TASK_DOCS,
  text: AI_TEXT.tasks.docs,
  schema: SCHEMAS.docs,
  build: (source) => prompt(
    'Write short documentation for this request in Markdown: purpose, parameters, expected response. Reply with {"description": string}.',
    fence('request', describeRequest(source.request)),
    fence('last-response-shape', source.response ? describeResponse(source.response, false).body : ''),
  ),
  parse: (text, source) => {
    const description = textField(parseModelObject(text).description, DESCRIPTION_LIMIT)
    requireContent(description)
    return {
      sections: [{ label: AI_TEXT.tasks.docs.section, before: source.request.description, after: description }],
      applyLabel: AI_TEXT.tasks.docs.apply,
      apply: (host) => host.updateRequest({ description }),
    }
  },
}

const searchEntries = (requests) => requests.slice(0, SEARCH_INDEX_LIMIT).map((request, index) => ({
  id: `r${index}`,
  name: request.name,
  method: request.method,
  url: maskedUrl(request.url),
  description: request.description.slice(0, NAME_LIMIT),
}))

const searchNote = (source) => (
  source.requests.length > SEARCH_INDEX_LIMIT ? AI_TEXT.searchLimited(SEARCH_INDEX_LIMIT, source.requests.length) : ''
)

const searchTask = {
  id: TASK_SEARCH,
  text: AI_TEXT.tasks.search,
  needsText: true,
  note: searchNote,
  schema: SCHEMAS.search,
  build: (source, input) => prompt(
    `Find the requests in the list that best match: ${input.text}\nReply with {"matches": [{"id": string, "reason": string}]}, best first, at most ${SEARCH_RESULT_LIMIT}. Use only ids from the list.`,
    fence('requests', searchEntries(source.requests)),
  ),
  parse: (text, source) => {
    const known = new Map(source.requests.slice(0, SEARCH_INDEX_LIMIT).map((request, index) => [`r${index}`, request]))
    const links = objectsIn(parseModelObject(text).matches, SEARCH_RESULT_LIMIT)
      .filter((match) => known.has(match.id))
      .map((match) => ({ request: known.get(match.id), detail: textField(match.reason, SUGGESTION_TEXT_LIMIT) }))
      .map(({ request, detail }) => ({
        label: `${request.method} ${request.name}`,
        detail,
        open: (host) => host.openRequest(request),
      }))
    requireContent(links)
    return { links, note: searchNote(source) }
  },
}

async function importedSpec(input, tools) {
  if (!mayBeSpec(input.text)) return null
  const result = await tools.readSpec({ text: input.text })
  if (!result.success || result.requests.length === 0) return null
  const text = AI_TEXT.tasks.schema
  return {
    note: text.importerNote,
    sections: [{ label: text.importerSection(result.requests.length), before: '', after: requestLines(result.requests) }],
    blocks: result.warnings?.length ? [{ heading: text.importerWarnings, items: result.warnings }] : [],
    applyLabel: text.importApply(result.requests.length),
    apply: (host) => host.importSpec(result),
  }
}

const createdLines = (drafts) => drafts.map((draft) => `${draft.method} ${draft.url}`)

const schemaTask = {
  id: TASK_SCHEMA,
  text: AI_TEXT.tasks.schema,
  needsText: true,
  longText: true,
  schema: SCHEMAS.schema,
  refuse: (input) => (
    input.text.length > SPEC_LIMIT ? AI_TEXT.tooLarge(formatSize(input.text.length), formatSize(SPEC_LIMIT)) : ''
  ),
  local: importedSpec,
  build: (source, input) => prompt(
    `Create requests that exercise the API described below, each with up to ${SCHEMA_ASSERTIONS} assertions. Start every URL with {{baseUrl}}. Reply with {"folderName": string, "requests": [{"name": string, "method": string, "url": string, "headers": [], "bodyType": string, "body": string, "assertions": [${SHAPES.assertion}]}], "more": boolean}. Make at most ${SCHEMA_BATCH} requests, skip every request listed under already-created, and set "more" to true when endpoints remain that you did not create yet. Operators: ${OPERATOR_NAMES}.`,
    fence('api-description', input.text),
    ...(input.done?.length ? [fence('already-created', createdLines(input.done))] : []),
  ),
  parse: (text, _source, input) => {
    const raw = parseModelObject(text)
    const added = objectsIn(raw.requests, SCHEMA_BATCH).map(draftFrom)
    requireContent(added)
    const drafts = [...(input.done || []), ...added]
    const name = input.folderName || textField(raw.folderName, NAME_LIMIT).trim() || AI_TEXT.tasks.schema.defaultFolder
    const hasMore = raw.more === true && drafts.length < SCHEMA_TOTAL_LIMIT
    const folder = { id: crypto.randomUUID(), name, parentId: '' }
    return {
      sections: [{ label: AI_TEXT.tasks.schema.folder(name), before: '', after: requestLines(drafts) }],
      note: hasMore ? AI_TEXT.tasks.schema.moreNote : '',
      next: hasMore ? { done: drafts, folderName: name } : null,
      applyLabel: AI_TEXT.tasks.schema.apply(drafts.length),
      apply: (host) => host.importDraft({
        folders: [folder],
        requests: drafts.map((draft) => ({ ...draft, id: crypto.randomUUID(), folderId: folder.id })),
      }),
    }
  },
}

export const TASKS = [requestTask, testsTask, scriptTask, explainTask, docsTask, searchTask, schemaTask]

export const taskById = (id) => TASKS.find((task) => task.id === id)

export const isFailedResponse = (response) => Boolean(response) && (Boolean(response.error) || response.statusCode >= STATUS_FAILURE)
