const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']
const SCHEMA_TYPES = ['string', 'integer', 'number', 'boolean', 'array', 'object', 'null']
const SCHEMA_FORMATS = ['int32', 'int64', 'float', 'double', 'date', 'date-time', 'time', 'duration', 'uuid', 'email', 'hostname', 'uri', 'ipv4', 'ipv6', 'password', 'byte', 'binary']
const PARAMETER_LOCATIONS = ['query', 'header', 'path', 'cookie']

const SCHEMA_KEYS = [
  'type', 'format', 'title', 'description', 'properties', 'required', 'items', 'enum', 'const', 'default', 'example', 'examples',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minLength', 'maxLength', 'pattern',
  'minItems', 'maxItems', 'uniqueItems', 'minProperties', 'maxProperties', 'additionalProperties',
  'allOf', 'oneOf', 'anyOf', 'not', 'nullable', 'readOnly', 'writeOnly', 'deprecated', 'discriminator', '$ref',
]

const schema = {
  keys: SCHEMA_KEYS,
  values: { type: SCHEMA_TYPES, format: SCHEMA_FORMATS },
  children: {
    get properties() { return { any: schema } },
    get items() { return schema },
    get not() { return schema },
    get additionalProperties() { return schema },
    get allOf() { return { item: schema } },
    get oneOf() { return { item: schema } },
    get anyOf() { return { item: schema } },
  },
}

const mediaType = { keys: ['schema', 'example', 'examples', 'encoding'], children: { schema } }
const content = { any: mediaType }
const header = { keys: ['description', 'required', 'deprecated', 'schema', 'example', 'examples', 'style', 'explode'], children: { schema } }
const parameter = {
  keys: ['name', 'in', 'description', 'required', 'deprecated', 'allowEmptyValue', 'style', 'explode', 'schema', 'example', 'examples', 'content', '$ref'],
  values: { in: PARAMETER_LOCATIONS },
  children: { schema, content },
}
const parameters = { item: parameter }
const requestBody = { keys: ['description', 'required', 'content', '$ref'], children: { content } }
const response = { keys: ['description', 'headers', 'content', 'links', '$ref'], children: { content, headers: { any: header } } }
const responses = { any: response }
const operation = {
  keys: ['tags', 'summary', 'description', 'operationId', 'parameters', 'requestBody', 'responses', 'callbacks', 'deprecated', 'security', 'servers', 'externalDocs'],
  children: { parameters, requestBody, responses },
}
const pathItem = {
  keys: [...METHODS, 'summary', 'description', 'parameters', 'servers', '$ref'],
  children: { parameters, ...Object.fromEntries(METHODS.map((method) => [method, operation])) },
}
const securityScheme = {
  keys: ['type', 'description', 'name', 'in', 'scheme', 'bearerFormat', 'flows', 'openIdConnectUrl'],
  values: { type: ['apiKey', 'http', 'oauth2', 'openIdConnect'], in: ['query', 'header', 'cookie'] },
}
const components = {
  keys: ['schemas', 'responses', 'parameters', 'examples', 'requestBodies', 'headers', 'securitySchemes', 'links', 'callbacks', 'pathItems'],
  children: {
    schemas: { any: schema },
    responses: { any: response },
    parameters: { any: parameter },
    requestBodies: { any: requestBody },
    headers: { any: header },
    securitySchemes: { any: securityScheme },
  },
}
const server = { keys: ['url', 'description', 'variables'] }
const info = { keys: ['title', 'summary', 'description', 'termsOfService', 'contact', 'license', 'version'] }
const tag = { keys: ['name', 'description', 'externalDocs'] }

const ROOT = {
  keys: ['openapi', 'info', 'servers', 'paths', 'components', 'security', 'tags', 'externalDocs', 'webhooks', 'jsonSchemaDialect'],
  values: { openapi: ['3.1.0', '3.0.3'] },
  children: { info, servers: { item: server }, paths: { any: pathItem }, components, tags: { item: tag }, webhooks: { any: pathItem } },
}

export const REFERENCE_SECTIONS = ['schemas', 'responses', 'parameters', 'examples', 'requestBodies', 'headers', 'securitySchemes', 'links', 'callbacks', 'pathItems']

export const LIST_ITEM = '-'

function step(node, segment) {
  if (!node) return undefined
  if (segment === LIST_ITEM) return node.item
  return node.children?.[segment] ?? node.any
}

export const grammarAt = (path) => path.reduce(step, ROOT)
