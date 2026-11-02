const SKIPPED_ANSWER_HEADERS = ['content-length', 'transfer-encoding', 'content-encoding', 'connection', 'date', 'set-cookie']
const QUERY_MARK = '?'

export const BREAK_NONE = ''
export const BREAK_REQUEST = 'request'
export const BREAK_RESPONSE = 'response'
export const BREAK_BOTH = 'both'

export const BODY_MODE_TEXT = 'text'
export const BODY_MODE_REGEX = 'regex'
export const BODY_MODE_JSON = 'json'

export const emptyEdit = () => ({ setHeaders: [], removeHeaders: [], body: [] })

export const emptyBodyEdit = () => ({ find: '', replace: '', regex: false, path: '', value: '' })

export const emptyAnswer = () => ({ status: 200, headers: [], body: '', bodyEncoding: '', contentType: '', file: '' })

export const emptyCaptureRule = () => ({
  id: crypto.randomUUID(),
  name: '',
  disabled: false,
  match: { method: '', host: '', path: '', pathRegex: '', conditions: [] },
  request: emptyEdit(),
  response: emptyEdit(),
  mapRemote: '',
  answer: null,
  delayMs: 0,
  delayMaxMs: 0,
  fault: { percent: 0, kind: 'status', status: 0 },
  throttle: { latencyMs: 0, downloadKBps: 0, uploadKBps: 0 },
  break: BREAK_NONE,
})

const normalizeEdit = (raw) => ({
  setHeaders: raw?.setHeaders || [],
  removeHeaders: raw?.removeHeaders || [],
  body: raw?.body || [],
})

export const normalizeCaptureRule = (raw) => {
  const blank = emptyCaptureRule()
  return {
    ...blank,
    ...raw,
    match: { ...blank.match, ...raw?.match, conditions: raw?.match?.conditions || [] },
    request: normalizeEdit(raw?.request),
    response: normalizeEdit(raw?.response),
    answer: raw?.answer ? { ...emptyAnswer(), ...raw.answer, headers: raw.answer.headers || [] } : null,
    fault: { ...blank.fault, ...raw?.fault },
    throttle: { ...blank.throttle, ...raw?.throttle },
  }
}

export const normalizeCaptureConfig = (raw) => ({
  rules: (raw?.rules || []).map(normalizeCaptureRule),
  breakSeconds: raw?.breakSeconds || 0,
  restricted: Boolean(raw?.restricted),
})

export const bodyModeOf = (change) => {
  if (change.path) return BODY_MODE_JSON
  return change.regex ? BODY_MODE_REGEX : BODY_MODE_TEXT
}

export const bodyEditForMode = (mode, change) => ({
  ...change,
  regex: mode === BODY_MODE_REGEX,
  path: mode === BODY_MODE_JSON ? change.path || '$.' : '',
})

export const namesToText = (names) => names.join(', ')

export const textToNames = (text) => text.split(',').map((name) => name.trim()).filter(Boolean)

export const pathWithoutQuery = (path) => path.split(QUERY_MARK)[0]

export function answerRuleFrom(exchange) {
  const { body, bodyEncoding, contentType, headers } = exchange.response
  const path = pathWithoutQuery(exchange.path)
  return {
    ...emptyCaptureRule(),
    name: `${exchange.method} ${path}`,
    match: { method: exchange.method, host: '', path, pathRegex: '', conditions: [] },
    answer: {
      status: exchange.status,
      headers: headers.filter(({ key }) => !SKIPPED_ANSWER_HEADERS.includes(key.toLowerCase())),
      body,
      bodyEncoding,
      contentType,
      file: '',
    },
  }
}

export const canAnswerWith = (exchange) => (
  !exchange.error && !exchange.upgraded && !exchange.interrupted && !exchange.response.truncated
)

const isCompleteBodyEdit = (change) => Boolean(change.find || change.path)

const withoutDraftBodyEdits = (edit) => ({ ...edit, body: edit.body.filter(isCompleteBodyEdit) })

export const withoutDraftEdits = (config) => ({
  ...config,
  rules: config.rules.map((rule) => ({ ...rule, request: withoutDraftBodyEdits(rule.request), response: withoutDraftBodyEdits(rule.response) })),
})
