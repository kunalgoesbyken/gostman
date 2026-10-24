import { OPERATORS } from '../scripting/assertions'

export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
export const BODY_TYPES = ['none', 'json', 'text', 'xml']

const text = { type: 'string' }
const flag = { type: 'boolean' }
const choice = (values) => ({ type: 'string', enum: values })
const list = (items) => ({ type: 'array', items })

export const object = (properties) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})

const header = object({ key: text, value: text })
const assertion = object({ expression: text, operator: choice(OPERATORS.map((operator) => operator.value)), value: text })

const requestFields = {
  name: text,
  method: choice(METHODS),
  url: text,
  headers: list(header),
  bodyType: choice(BODY_TYPES),
  body: text,
}

export const SCHEMAS = {
  request: object({ ...requestFields, description: text }),
  tests: object({ assertions: list(assertion), script: text }),
  script: object({ script: text }),
  explain: object({ explanation: text, causes: list(text), fixes: list(text) }),
  docs: object({ description: text }),
  search: object({ matches: list(object({ id: text, reason: text })) }),
  schema: object({ folderName: text, requests: list(object({ ...requestFields, assertions: list(assertion) })), more: flag }),
}
