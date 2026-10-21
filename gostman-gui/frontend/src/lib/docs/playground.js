import { lookup } from '../dataUtils'
import { placeholderNames } from '../placeholders'
import { CURL_FORM, CURL_RAW } from './curl'
import { ACCESS_TOKEN, exchangeOf } from './describe'
import { html } from './markup'
import { REDACTED, UNPARSED_BODY } from './redaction'

export const PLAYGROUND_TEXT = {
  title: 'Try it',
  method: 'Method',
  url: 'URL',
  variables: 'Variables',
  variablePlaceholder: 'Value',
  headers: 'Headers',
  headerName: 'Header name',
  headerValue: 'Header value',
  addHeader: 'Add header',
  body: 'Body',
  unsupportedBody: 'This request has a multipart or file body, which cannot be sent from this panel.',
  note: 'Requests are sent from your browser. Values that hold secrets are left empty: fill them in yourself. Nothing is stored.',
  send: 'Send',
  responseHeaders: 'Response headers',
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const AUTHORIZATION = 'Authorization'
const BASIC_PREFIX = 'Basic '
const CONTENT_TYPE = 'Content-Type'
const FORM_CONTENT = 'application/x-www-form-urlencoded'
const USERINFO_GAP = '://@'
const SCHEME_END = '://'
const SPARE_HEADER = { key: '', value: '' }
const PLACEHOLDER_SPLIT = /(\{\{[^}]+\}\})/

const blank = (text) => text.replaceAll(REDACTED, '').replaceAll(ACCESS_TOKEN, '')

const encodePart = (part, index) => (index % 2 === 1 ? part : encodeURIComponent(part))

const encodeField = (text) => text.split(PLACEHOLDER_SPLIT).map(encodePart).join('')

const formField = ({ key, value }) => `${encodeField(key)}=${encodeField(blank(value))}`

const BODY_TEXT = {
  [CURL_RAW]: (body) => (body.text === UNPARSED_BODY ? '' : blank(body.text)),
  [CURL_FORM]: (body) => body.fields.map(formField).join('&'),
}

const hasContentType = (headers) => headers.some(({ key }) => key.toLowerCase() === CONTENT_TYPE.toLowerCase())

function headersOf(exchange, kind) {
  const basic = exchange.user ? [{ key: AUTHORIZATION, value: BASIC_PREFIX }] : []
  const headers = [...exchange.headers.map(({ key, value }) => ({ key, value: blank(value) })), ...basic]
  return kind === CURL_FORM && !hasContentType(headers) ? [...headers, { key: CONTENT_TYPE, value: FORM_CONTENT }] : headers
}

function variablesOf(url, headers, body) {
  const text = [url, ...headers.map(({ value }) => value), body].join('\n')
  return Array.from(new Set(placeholderNames(text))).filter(Boolean).sort()
}

export function playgroundOf(request) {
  const exchange = exchangeOf(request)
  if (!exchange) return null
  const kind = exchange.body?.kind
  const readBody = lookup(BODY_TEXT, kind)
  const body = readBody ? readBody(exchange.body) : ''
  const url = blank(exchange.url).replace(USERINFO_GAP, SCHEME_END)
  const headers = headersOf(exchange, kind)
  return {
    method: exchange.method,
    url,
    headers,
    body,
    isBodyUnsupported: Boolean(exchange.body) && !readBody,
    variables: variablesOf(url, headers, body),
  }
}

const methodOption = (selected) => (method) => html`<option${method === selected ? ' selected' : ''}>${method}</option>`

const variableField = (name) => html`<label class="try-variable"><code>${name}</code><input type="text" data-variable="${name}" placeholder="${PLAYGROUND_TEXT.variablePlaceholder}" autocomplete="off" spellcheck="false" dir="ltr"></label>`

const headerRow = ({ key, value }) => html`<div class="try-header" data-header><input type="text" data-header-name value="${key}" aria-label="${PLAYGROUND_TEXT.headerName}" autocomplete="off" spellcheck="false" dir="ltr"><input type="text" data-header-value value="${value}" aria-label="${PLAYGROUND_TEXT.headerValue}" autocomplete="off" spellcheck="false" dir="ltr"></div>`

const variablesBlock = (names) => (
  names.length === 0 ? '' : html`<h5>${PLAYGROUND_TEXT.variables}</h5><div class="try-variables">${names.map(variableField)}</div>`
)

const bodyBlock = (model) => (
  model.isBodyUnsupported
    ? html`<p class="note">${PLAYGROUND_TEXT.unsupportedBody}</p>`
    : html`<h5>${PLAYGROUND_TEXT.body}</h5><textarea data-body rows="6" spellcheck="false" dir="ltr" aria-label="${PLAYGROUND_TEXT.body}">${model.body}</textarea>`
)

const methodChoices = (method) => (METHODS.includes(method) ? METHODS : [method, ...METHODS])

export function playgroundPanel(request) {
  const model = playgroundOf(request)
  if (!model) return ''
  return html`<details class="try" data-try>
<summary>${PLAYGROUND_TEXT.title}</summary>
<div class="try-body">
<p class="note">${PLAYGROUND_TEXT.note}</p>
<div class="try-line"><select data-method aria-label="${PLAYGROUND_TEXT.method}">${methodChoices(model.method).map(methodOption(model.method))}</select><input type="text" data-url value="${model.url}" aria-label="${PLAYGROUND_TEXT.url}" autocomplete="off" spellcheck="false" dir="ltr"></div>
${variablesBlock(model.variables)}<h5>${PLAYGROUND_TEXT.headers}</h5>
<div data-headers>${[...model.headers, SPARE_HEADER].map(headerRow)}</div>
<button type="button" class="try-button" data-add-header>${PLAYGROUND_TEXT.addHeader}</button>
${bodyBlock(model)}<p><button type="button" class="try-button try-send" data-send>${PLAYGROUND_TEXT.send}</button></p>
<div class="try-result" data-result hidden>
<p class="try-summary" data-summary></p>
<p class="try-error" data-error hidden></p>
<details><summary>${PLAYGROUND_TEXT.responseHeaders}</summary><pre data-response-headers></pre></details>
<pre data-response-body></pre>
</div>
</div>
</details>
`
}
