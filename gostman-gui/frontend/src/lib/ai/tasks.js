import { OPERATORS, operatorOf, parseAssertions, serializeAssertions } from '../scripting/assertions'
import { normalizeRequest } from '../request'
import { serializeRows } from '../rows'
import { describeRequest, describeResponse, maskedUrl, shapeOf } from './context'
import { SCRIPT_API, SHAPES, fence, prompt } from './prompts'
import { ReplyError, BAD_REPLY, objectsIn, parseModelObject, requireContent, stringsIn, textField } from './reply'

export const TASK_REQUEST = 'request'
export const TASK_TESTS = 'tests'
export const TASK_SCRIPT = 'script'
export const TASK_EXPLAIN = 'explain'
export const TASK_DOCS = 'docs'
export const TASK_SEARCH = 'search'
export const TASK_SCHEMA = 'schema'

export const SCRIPT_PRE = 'preScript'
export const SCRIPT_POST = 'postScript'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const BODY_TYPES = ['none', 'json', 'text', 'xml']
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
const SCHEMA_REQUEST_LIMIT = 40
const SPEC_LIMIT = 20000
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
  if (!method || !isUsableUrl(url)) throw new ReplyError(BAD_REPLY)
  const body = textField(raw.body, BODY_LIMIT)
  const bodyType = BODY_TYPES.includes(raw.bodyType) ? raw.bodyType : ''
  return normalizeRequest({
    name: textField(raw.name, NAME_LIMIT).trim() || 'AI request',
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

const sameAssertion = (first, second) => (
  first.expression === second.expression && first.operator === second.operator && first.value === second.value
)

const withoutDuplicates = (existing, proposed) => proposed.filter((candidate) => !existing.some((current) => sameAssertion(current, candidate)))

const joinScripts = (current, addition) => (current.trim() && addition.trim() ? `${current.replace(/\s+$/, '')}\n\n${addition}` : current || addition)

const requestTask = {
  id: TASK_REQUEST,
  label: 'New request from a description',
  inputLabel: 'Describe the request',
  placeholder: 'POST a new user with name and email',
  needsText: true,
  build: (source, input) => prompt(
    `Design one API request for this description: ${input.text}\nUse variables from the list when they fit, for example {{baseUrl}}. Reply with this shape: ${SHAPES.request}`,
    fence('variable-names', source.variableNames),
    fence('folder-names', source.folderNames),
  ),
  parse: (text) => {
    const draft = draftFrom(parseModelObject(text))
    return {
      sections: [{ label: 'New request (opens as an unsaved tab)', before: '', after: draftText(draft) }],
      applyLabel: 'Open as new tab',
      apply: (host) => host.openDraft(draft),
    }
  },
}

const testsTask = {
  id: TASK_TESTS,
  label: 'Assertions and tests for a response',
  needsResponse: true,
  offersValues: true,
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
        ...(added.length > 0 ? [{ label: 'Assertions', before: assertionText(existing), after: assertionText(merged) }] : []),
        ...(script ? [{ label: 'Post-response script (AI-generated, review before running)', before: source.request.postScript, after: nextScript }] : []),
      ],
      applyLabel: 'Add to request',
      apply: (host) => host.updateRequest({ assertions: serializeAssertions(merged), ...(script && { postScript: nextScript }) }),
    }
  },
}

const SCRIPT_LABELS = { [SCRIPT_PRE]: 'pre-request', [SCRIPT_POST]: 'post-response' }

const scriptTask = {
  id: TASK_SCRIPT,
  label: 'Pre-request or post-response script',
  inputLabel: 'What should the script do',
  placeholder: 'Save the token from the response into the environment',
  needsText: true,
  needsScriptKind: true,
  requiresTrust: true,
  build: (source, input) => prompt(
    `Write the ${SCRIPT_LABELS[input.scriptKind]} JavaScript for this request: ${input.text}\nReply with {"script": string} holding the complete script.\n${SCRIPT_API}`,
    fence('request', describeRequest(source.request)),
    fence('current-script', source.request[input.scriptKind].slice(0, CURRENT_SCRIPT_LIMIT)),
    fence('variable-names', source.variableNames),
  ),
  parse: (text, source, input) => {
    const script = textField(parseModelObject(text).script, SCRIPT_LIMIT)
    requireContent(script)
    return {
      sections: [{ label: `New ${SCRIPT_LABELS[input.scriptKind]} script (AI-generated, review before running)`, before: source.request[input.scriptKind], after: script }],
      applyLabel: 'Replace script',
      apply: (host) => host.updateRequest({ [input.scriptKind]: script }),
    }
  },
}

const explainTask = {
  id: TASK_EXPLAIN,
  label: 'Explain a failed response',
  needsResponse: true,
  offersValues: true,
  valuesByDefault: true,
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
        { heading: 'What happened', text: explanation },
        { heading: 'Likely causes', items: causes },
        { heading: 'Suggested fixes', items: fixes },
      ].filter((block) => block.text || block.items?.length),
    }
  },
}

const docsTask = {
  id: TASK_DOCS,
  label: 'Document the request',
  build: (source) => prompt(
    'Write short documentation for this request in Markdown: purpose, parameters, expected response. Reply with {"description": string}.',
    fence('request', describeRequest(source.request)),
    fence('last-response-shape', source.response ? shapeOf(describeResponse(source.response, false).body) : ''),
  ),
  parse: (text, source) => {
    const description = textField(parseModelObject(text).description, DESCRIPTION_LIMIT)
    requireContent(description)
    return {
      sections: [{ label: 'Description', before: source.request.description, after: description }],
      applyLabel: 'Use as description',
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

const searchTask = {
  id: TASK_SEARCH,
  label: 'Ask about the collection',
  inputLabel: 'What are you looking for',
  placeholder: 'the endpoint that cancels an order',
  needsText: true,
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
    return { links }
  },
}

const schemaTask = {
  id: TASK_SCHEMA,
  label: 'Requests from an API schema',
  inputLabel: 'Paste an OpenAPI document or GraphQL schema',
  placeholder: 'openapi: 3.0.0 ...',
  needsText: true,
  textLimit: SPEC_LIMIT,
  build: (source, input) => prompt(
    `Create requests that exercise this API, each with a few assertions. Start every URL with {{baseUrl}}. Reply with {"folderName": string, "requests": [{"name": string, "method": string, "url": string, "headers": [], "bodyType": string, "body": string, "assertions": [${SHAPES.assertion}]}]}, at most ${SCHEMA_REQUEST_LIMIT} requests. Operators: ${OPERATOR_NAMES}.`,
    fence('schema', input.text.slice(0, SPEC_LIMIT)),
  ),
  parse: (text) => {
    const raw = parseModelObject(text)
    const drafts = objectsIn(raw.requests, SCHEMA_REQUEST_LIMIT).map(draftFrom)
    requireContent(drafts)
    const folder = { id: crypto.randomUUID(), name: textField(raw.folderName, NAME_LIMIT).trim() || 'AI requests', parentId: '' }
    return {
      sections: [{ label: `New folder "${folder.name}"`, before: '', after: drafts.map((draft) => `${draft.method} ${draft.url}  ${draft.name}`).join('\n') }],
      applyLabel: 'Add folder and requests',
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
