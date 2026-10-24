const PREVIEW_LENGTH = 40
const KIND_NAMES = {
  null: 'null',
  string: 'a string',
  number: 'a number',
  integer: 'a whole number',
  boolean: 'true or false',
  array: 'an array',
  object: 'an object',
}

const quoted = (text) => `"${text}"`
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`
const either = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`)

function preview(value) {
  if (value === null || value === undefined) return String(value)
  if (Array.isArray(value)) return `an array of ${plural(value.length, 'item', 'items')}`
  if (typeof value === 'object') return 'an object'
  if (typeof value !== 'string') return String(value)
  const text = value.length > PREVIEW_LENGTH ? `${value.slice(0, PREVIEW_LENGTH)}...` : value
  return `the text ${quoted(text)}`
}

const literal = (value) => (typeof value === 'string' ? quoted(value) : JSON.stringify(value))

export const SCHEMA_TEXT = {
  operator: 'matches schema',
  root: 'The value',
  line: (where, problem) => `${where} ${problem}`,
  more: (count) => `...and ${plural(count, 'more problem', 'more problems')}.`,
  type: (expected, actual) => `should be ${either(expected.map((type) => KIND_NAMES[type] || type))}, but it is ${preview(actual)}.`,
  required: 'is missing, but the schema requires it.',
  additionalProperties: 'is not in the schema, which allows no other fields.',
  enum: (allowed, actual) => `should be one of ${allowed.map(literal).join(', ')}, but it is ${preview(actual)}.`,
  const: (expected, actual) => `should be ${literal(expected)}, but it is ${preview(actual)}.`,
  minimum: (limit, actual) => `should be at least ${limit}, but it is ${actual}.`,
  maximum: (limit, actual) => `should be at most ${limit}, but it is ${actual}.`,
  exclusiveMinimum: (limit, actual) => `should be greater than ${limit}, but it is ${actual}.`,
  exclusiveMaximum: (limit, actual) => `should be less than ${limit}, but it is ${actual}.`,
  multipleOf: (step, actual) => `should be a multiple of ${step}, but it is ${actual}.`,
  minLength: (limit, actual) => `should have at least ${plural(limit, 'character', 'characters')}, but it has ${actual}.`,
  maxLength: (limit, actual) => `should have at most ${plural(limit, 'character', 'characters')}, but it has ${actual}.`,
  pattern: (pattern, actual) => `should match the pattern ${pattern}, but it is ${preview(actual)}.`,
  format: (format, actual) => `should be a valid ${format}, but it is ${preview(actual)}.`,
  minItems: (limit, actual) => `should have at least ${plural(limit, 'item', 'items')}, but it has ${actual}.`,
  maxItems: (limit, actual) => `should have at most ${plural(limit, 'item', 'items')}, but it has ${actual}.`,
  uniqueItems: (first, second) => `should not repeat items, but items ${first} and ${second} are the same.`,
  contains: (limit) => `should contain at least ${plural(limit, 'matching item', 'matching items')}.`,
  maxContains: (limit) => `should contain at most ${plural(limit, 'matching item', 'matching items')}.`,
  minProperties: (limit, actual) => `should have at least ${plural(limit, 'field', 'fields')}, but it has ${actual}.`,
  maxProperties: (limit, actual) => `should have at most ${plural(limit, 'field', 'fields')}, but it has ${actual}.`,
  dependentRequired: (present, missing) => `has ${quoted(present)}, so it also needs ${quoted(missing)}.`,
  propertyNames: (name) => `has a field named ${quoted(name)}, which the schema does not allow.`,
  anyOf: 'matches none of the allowed shapes. The closest one fails because:',
  oneOf: 'matches none of the allowed shapes. The closest one fails because:',
  oneOfMany: (count) => `matches ${count} of the allowed shapes, but should match exactly one.`,
  not: 'matches a shape the schema forbids.',
  false: 'is not allowed here.',
  notJson: 'The expected value is not a JSON Schema. Paste a JSON object, or a {{variable}} that holds one.',
  notSchema: 'A schema must be a JSON object or true or false.',
  external: (reference) => `The schema refers to ${reference}, which is in another file, so it cannot be checked here.`,
  unresolved: (reference) => `The schema refers to ${reference}, which does not exist.`,
  tooDeep: 'The schema nests or refers to itself too deeply to check.',
  badPattern: (pattern) => `The schema's pattern ${pattern} is not a valid regular expression.`,
  mismatch: (lines) => `The value does not match the schema:\n${lines.join('\n')}`,
  unexpectedMatch: 'The value matches the schema, but it should not.',
  edit: 'Edit schema',
  editorTitle: 'JSON Schema',
  editorHint: 'Paste a JSON Schema, or write {{name}} to use one kept in a variable. Responses are checked against it after every send.',
  save: 'Save',
  cancel: 'Cancel',
}

export const CONTRACT_TEXT = {
  heading: 'Contract',
  status: (status, key) => `Status ${status} is documented for ${key}`,
  statusMissing: (codes) => (codes.length === 0 ? 'The spec documents no responses for this operation.' : `The spec documents ${codes.join(', ')} for this operation.`),
  contentType: (type) => `Content type ${type || '(none)'} is documented`,
  contentTypeMissing: (types) => `The spec documents ${types.join(', ')} for this status.`,
  body: 'Body matches the documented schema',
  notJson: 'The body is not valid JSON.',
  unmatched: (method, path) => `No operation in the spec matches ${method} ${path}, so this response was not checked against it.`,
  unreadable: (message) => `The spec could not be read, so this response was not checked against it: ${message}`,
  start: 'Check responses against the spec',
  stop: 'Stop checking responses against the spec',
}

export const RESPONSE_CHECKS_TEXT = {
  button: 'Add checks from this response',
  title: 'Add checks from this response',
  intro: 'These checks are built from the response you just received. Tick the ones you want, then add them to the Tests tab.',
  kinds: {
    status: 'Status code',
    contentType: 'Content type',
    schema: 'Body shape, as a JSON Schema: field types, the fields that were present, and null where null was seen. A field that was null accepts any value.',
    responseTime: (budget) => `Response time budget of ${budget} ms, twice what this response took, rounded up.`,
  },
  nothingNew: 'The Tests tab already has these checks.',
  add: (count) => (count === 0 ? 'Add checks' : `Add ${plural(count, 'check', 'checks')}`),
  cancel: 'Cancel',
  added: (count, name) => `Added ${plural(count, 'check', 'checks')} to the Tests tab of "${name}".`,
}

export const TESTS_TEXT = {
  sectionLabel: 'Tests section',
  views: {
    assertions: 'Assertions',
    preScript: 'Pre-request script',
    postScript: 'Post-response script',
  },
  hints: {
    assertions: 'Use res.status, res.headers.name, res.body.path or res.responseTime; expected values can use {{variables}}. The matches schema check compares a value, such as res.body, with a JSON Schema. Checked rows are verified after every response.',
    preScript: 'Runs before sending. Available: req, env, console, utils, sendRequest(), skipRequest(), stopExecution(). Snippets written for Postman (pm), Insomnia or Bruno (bru) run as they are.',
    postScript: 'Runs after the response. Available: req, res, env, console, utils, test(name, fn), expect(value), sendRequest(), setNextRequest(name), visualize(template, data). Snippets written for Postman (pm), Insomnia or Bruno (bru) run as they are.',
  },
  expression: 'Expression',
  check: 'Check',
  expected: 'Expected',
  expectedValue: 'Expected value',
  expectedPlaceholder: '200',
  schemaPlaceholder: '{"type": "object"}',
  verify: 'Verify this assertion',
  remove: 'Remove assertion',
  results: 'Test results',
}
