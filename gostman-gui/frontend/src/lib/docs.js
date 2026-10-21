import { base64ByteLength } from './base64'
import { BODY_BINARY, BODY_FORM, BODY_JSON, BODY_MULTIPART, BODY_NONE } from './body'
import { buildCollectionTree, foldersIn, requestsIn, ROOT_ID } from './collectionTree'
import { formatSize, isPlainObject, lookup, pluralize } from './dataUtils'
import { isBinaryExample, parseExamples } from './examples'
import { parseProtoFiles } from './grpc'
import { AUTH_OAUTH2 } from './request'
import {
  AUTH_API_KEY, AUTH_BASIC, AUTH_BEARER, PROTOCOL_GRAPHQL, PROTOCOL_GRPC, PROTOCOL_HTTP, PROTOCOL_SOCKET,
  curlExample, fieldValue, fileNameOf, graphqlPayload, protocolOf, readRequest, sentFields, sentHeaders, sentParams,
  textOf, variablesUsed,
} from './docs/describe'
import { formatJSON } from './docs/json'
import { createAnchors, html, shorten, toSource, trusted } from './docs/markup'
import { CONTENT_POLICY, SCRIPT, STYLE } from './docs/page'
import { REDACTED, maskUrl } from './docs/redaction'

const DEFAULT_TITLE = 'API documentation'
const ROOT_HEADING = 'General'
const UNTITLED_FOLDER = 'Folder'
const CODE_LIMIT = 20000
const CONTENT_ID = 'content'
const FILTER_ID = 'filter'
const VARIABLES_ID = 'variables'
const RESERVED_IDS = [CONTENT_ID, FILTER_ID, VARIABLES_ID]
const PATH_SEPARATOR = ' / '
const IN_QUERY = 'query'
const SUCCESS_CLASS = 'is-success'
const REDIRECT_CLASS = 'is-redirect'
const FAILURE_CLASS = 'is-failure'
const PLAIN_CLASS = 'is-plain'

const METHOD_CLASSES = {
  GET: 'is-get',
  HEAD: 'is-get',
  OPTIONS: 'is-get',
  POST: 'is-post',
  PUT: 'is-put',
  PATCH: 'is-patch',
  DELETE: 'is-delete',
}

const PROTOCOL_BADGES = {
  [PROTOCOL_GRAPHQL]: { label: 'GQL', className: 'is-graphql' },
  [PROTOCOL_GRPC]: { label: 'GRPC', className: 'is-grpc' },
  [PROTOCOL_SOCKET]: { label: 'WS', className: PLAIN_CLASS },
}

const AUTH_LABELS = {
  [AUTH_BASIC]: 'Basic',
  [AUTH_BEARER]: 'Bearer token',
  [AUTH_API_KEY]: 'API key',
  [AUTH_OAUTH2]: 'OAuth 2.0',
}

const GRANT_LABELS = {
  client_credentials: 'Client credentials',
  password: 'Password',
  authorization_code: 'Authorization code',
}

const asArray = (value) => (Array.isArray(value) ? value : [])

const isFolder = (value) => isPlainObject(value) && typeof value.id === 'string' && value.id !== ''

const readFolder = (raw) => ({
  id: raw.id,
  name: textOf(raw.name).trim() || UNTITLED_FOLDER,
  parentId: textOf(raw.parentId),
  description: textOf(raw.description).trim(),
})

function badgeOf(request, protocol) {
  return lookup(PROTOCOL_BADGES, protocol) || { label: request.method, className: lookup(METHOD_CLASSES, request.method) || PLAIN_CLASS }
}

function describeEntry(request, anchorFor) {
  const protocol = protocolOf(request)
  const badge = badgeOf(request, protocol)
  return {
    request,
    protocol,
    badge,
    anchor: anchorFor(request.name, 'request'),
    search: `${badge.label} ${request.name} ${maskUrl(request.url)}`.toLowerCase(),
  }
}

const hasContent = (group) => group.entries.length > 0 || group.groups.length > 0

function describeGroup(tree, folder, ancestors, anchorFor) {
  const path = [...ancestors, folder.name]
  const anchor = anchorFor(path.join(' '), 'folder')
  const entries = requestsIn(tree, folder.id).map((request) => describeEntry(request, anchorFor))
  const groups = describeGroups(tree, folder.id, path, anchorFor)
  return { anchor, name: folder.name, heading: path.join(PATH_SEPARATOR), description: folder.description, entries, groups }
}

function describeGroups(tree, parentId, ancestors, anchorFor) {
  return foldersIn(tree, parentId)
    .map((folder) => describeGroup(tree, folder, ancestors, anchorFor))
    .filter(hasContent)
}

function describeCollection(collection) {
  const requests = asArray(collection?.requests).filter(isPlainObject).map(readRequest)
  const folders = asArray(collection?.folders).filter(isFolder).map(readFolder)
  const tree = buildCollectionTree(folders, requests)
  const anchorFor = createAnchors(RESERVED_IDS)
  const root = {
    anchor: anchorFor(ROOT_HEADING, 'folder'),
    heading: ROOT_HEADING,
    entries: requestsIn(tree, ROOT_ID).map((request) => describeEntry(request, anchorFor)),
  }
  const description = textOf(collection?.settings?.description).trim()
  return { requests, description, root, groups: describeGroups(tree, ROOT_ID, [], anchorFor) }
}

const flattenGroups = (groups) => groups.flatMap((group) => [group, ...flattenGroups(group.groups)])

const badge = ({ label, className }, kind) => html`<span class="${kind} ${className}">${label}</span>`

const anchorLink = (anchor, name) => html`<a class="anchor" href="#${anchor}" aria-label="Link to ${name}">#</a>`

function codeBlock(text) {
  const shown = shorten(text, CODE_LIMIT)
  const note = shown.length < text.length
    ? html`<p class="note">Showing the first ${shown.length} of ${text.length} characters.</p>`
    : ''
  return html`<div class="code"><pre dir="ltr"><code>${shown}</code></pre></div>${note}`
}

const formatted = (text) => (text.length > CODE_LIMIT ? text : formatJSON(text))

function codeSection(title, text) {
  return text.trim() === '' ? '' : html`<h4>${title}</h4>${codeBlock(text)}`
}

const pairRow = ({ key, value }) => html`<tr><td class="value">${key}</td><td class="value">${value}</td></tr>`

function pairTable(rows) {
  return html`<table><thead><tr><th scope="col">Name</th><th scope="col">Value</th></tr></thead><tbody>${rows.map(pairRow)}</tbody></table>`
}

function pairSection(title, rows) {
  return rows.length === 0 ? '' : html`<h4>${title}</h4>${pairTable(rows)}`
}

const term = (label, value) => (value ? html`<dt>${label}</dt><dd>${value}</dd>` : '')

const AUTH_DETAILS = {
  [AUTH_API_KEY]: (auth) => term('Sent as', html`${auth.in === IN_QUERY ? 'Query parameter' : 'Header'} <code>${textOf(auth.key)}</code>`),
  [AUTH_OAUTH2]: ({ oauth2 }) => [
    term('Grant', lookup(GRANT_LABELS, oauth2.grant) || textOf(oauth2.grant)),
    term('Token URL', textOf(oauth2.tokenUrl) && html`<code>${textOf(oauth2.tokenUrl)}</code>`),
    term('Authorization URL', textOf(oauth2.authUrl) && html`<code>${textOf(oauth2.authUrl)}</code>`),
    term('Scope', textOf(oauth2.scope) && html`<code>${textOf(oauth2.scope)}</code>`),
  ],
}

function authSection({ auth }) {
  const label = lookup(AUTH_LABELS, auth.type)
  if (!label) return ''
  const details = lookup(AUTH_DETAILS, auth.type)
  return html`<h4>Authorization</h4><dl>${term('Type', label)}${details ? details(auth) : ''}</dl>`
}

const fieldRow = (row) => ({ key: row.key, value: fieldValue(row) })

const BODY_SECTIONS = {
  [BODY_NONE]: () => '',
  [BODY_FORM]: (request) => pairSection('Form fields', sentFields(request).map(fieldRow)),
  [BODY_MULTIPART]: (request) => pairSection('Multipart fields', sentFields(request).map(fieldRow)),
  [BODY_BINARY]: (request) => (fileNameOf(request) ? html`<h4>Body</h4><p>File <code>${fileNameOf(request)}</code></p>` : ''),
  [BODY_JSON]: (request) => codeSection('Body', formatted(request.body)),
}

function bodySection(request) {
  const build = lookup(BODY_SECTIONS, request.bodyType)
  return build ? build(request) : codeSection('Body', request.body)
}

const paramsSection = (request) => pairSection('Query parameters', sentParams(request))

const headersSection = (request) => pairSection('Headers', sentHeaders(request))

const curlSection = (request) => codeSection('Example request', curlExample(request))

const graphqlSection = (request) => [
  codeSection('Query', request.graphqlQuery),
  codeSection('Variables', formatted(request.graphqlVariables.trim() === '{}' ? '' : request.graphqlVariables)),
]

const protoNames = (request) => parseProtoFiles(request.grpcProtos).map((file) => file.name).join(', ')

function grpcCall(request) {
  const terms = [
    term('Method', request.grpcMethod && html`<code>${request.grpcMethod}</code>`),
    term('Proto files', protoNames(request)),
  ].filter(Boolean)
  return terms.length === 0 ? '' : html`<h4>Call</h4><dl>${terms}</dl>`
}

const grpcSection = (request) => [grpcCall(request), codeSection('Message', formatted(request.grpcMessage))]

const PROTOCOL_SECTIONS = {
  [PROTOCOL_HTTP]: [authSection, paramsSection, headersSection, bodySection, curlSection],
  [PROTOCOL_GRAPHQL]: [authSection, paramsSection, headersSection, graphqlSection, curlSection],
  [PROTOCOL_GRPC]: [authSection, (request) => pairSection('Metadata', sentHeaders(request)), grpcSection],
  [PROTOCOL_SOCKET]: [paramsSection, headersSection],
}

function statusClass(status) {
  if (status >= 400) return FAILURE_CLASS
  if (status >= 300) return REDIRECT_CLASS
  return status >= 200 ? SUCCESS_CLASS : PLAIN_CLASS
}

function exampleBody(example) {
  if (isBinaryExample(example)) return html`<p class="note">Binary body, ${formatSize(base64ByteLength(example.body))}.</p>`
  if (example.body.trim() === '') return html`<p class="note">No body.</p>`
  return codeBlock(formatted(example.body))
}

function exampleHeaders({ headers }) {
  if (headers.length === 0) return ''
  return html`<details><summary>${pluralize(headers.length, 'header')}</summary>${pairTable(headers)}</details>`
}

function exampleBlock(example) {
  return html`<h5><span class="status ${statusClass(example.status)}">${example.status}</span> <span dir="auto">${example.name}</span></h5>
${example.contentType ? html`<p class="note">${example.contentType}</p>` : ''}${exampleHeaders(example)}${exampleBody(example)}`
}

function examplesSection(request) {
  const examples = parseExamples(request.examples)
  return examples.length === 0 ? '' : html`<h4>Example responses</h4>${examples.map(exampleBlock)}`
}

const descriptionBlock = (text) => (text === '' ? '' : html`<p class="description" dir="auto">${text}</p>`)

const descriptionOf = (request) => descriptionBlock(textOf(request.description).trim())

function requestArticle(entry, settings) {
  const { request } = entry
  return html`<article id="${entry.anchor}" data-search="${entry.search}">
<h3><span dir="auto">${request.name}</span>${anchorLink(entry.anchor, request.name)}</h3>
<p class="endpoint">${badge(entry.badge, 'method')}<code dir="ltr">${maskUrl(request.url)}</code></p>
${descriptionOf(request)}${PROTOCOL_SECTIONS[entry.protocol].map((section) => section(request))}${settings.includeExamples ? examplesSection(request) : ''}
</article>
`
}

function groupSection(group, settings) {
  return html`<section id="${group.anchor}" data-group>
<h2><span dir="auto">${group.heading}</span>${anchorLink(group.anchor, group.heading)}</h2>
${descriptionBlock(group.description || '')}${group.entries.map((entry) => requestArticle(entry, settings))}</section>
`
}

const contentsEntry = (entry) => html`<li data-search="${entry.search}"><a href="#${entry.anchor}">${badge(entry.badge, 'verb')}<bdi>${entry.request.name}</bdi></a></li>
`

function contentsGroup(group) {
  return html`<li data-group><a class="group" href="#${group.anchor}"><bdi>${group.name}</bdi></a>
<ul>
${group.entries.map(contentsEntry)}${group.groups.map(contentsGroup)}</ul>
</li>
`
}

function variablesSection(names) {
  if (names.length === 0) return ''
  return html`<section id="${VARIABLES_ID}">
<h2>Variables${anchorLink(VARIABLES_ID, 'Variables')}</h2>
<p class="intro">Values written as <code>{{name}}</code> are variables. Set each one for your environment before sending a request.</p>
<ul class="names">${names.map((name) => html`<li><code>{{${name}}}</code></li>`)}</ul>
</section>
`
}

function summaryOf(requestCount, folderCount) {
  if (requestCount === 0) return 'This collection has no requests.'
  const scope = folderCount > 0 ? ` in ${pluralize(folderCount, 'folder')}` : ''
  return `${pluralize(requestCount, 'request')}${scope}. Credentials are left out: literal secrets appear as ${REDACTED}.`
}

function readSettings(options) {
  return {
    title: textOf(options?.title).trim() || DEFAULT_TITLE,
    includeExamples: options?.includeExamples !== false,
  }
}

export function buildDocs(collection, options) {
  const settings = readSettings(options)
  const { requests, description, root, groups } = describeCollection(collection)
  const sections = flattenGroups(groups)
  return toSource(html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CONTENT_POLICY}">
<meta name="generator" content="Gostman">
<title>${settings.title}</title>
<style>${trusted(STYLE)}</style>
</head>
<body>
<a class="skip" href="#${CONTENT_ID}">Skip to content</a>
<div class="layout">
<nav class="contents" aria-label="Contents">
<p class="contents-title" dir="auto">${settings.title}</p>
<input id="${FILTER_ID}" class="filter" type="search" placeholder="Filter requests" aria-label="Filter requests" hidden>
<ul>
${root.entries.map(contentsEntry)}${groups.map(contentsGroup)}</ul>
</nav>
<main id="${CONTENT_ID}">
<h1 dir="auto">${settings.title}</h1>
<p class="intro">${summaryOf(requests.length, sections.length)}</p>
${descriptionBlock(description)}${variablesSection(variablesUsed(requests))}${root.entries.length > 0 ? groupSection(root, settings) : ''}${sections.map((group) => groupSection(group, settings))}<footer>Generated with Gostman.</footer>
</main>
</div>
<script>${trusted(SCRIPT)}</script>
</body>
</html>
`)
}
