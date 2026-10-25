import { AUTH_SCHEMES_TEXT } from './authSchemesText'

export const AUTH_DIGEST = 'digest'
export const AUTH_NTLM = 'ntlm'
export const AUTH_AWS = 'awsv4'
export const AUTH_OAUTH1 = 'oauth1'
export const AUTH_EDGEGRID = 'edgegrid'
export const AUTH_JWT = 'jwt'
export const AUTH_ASAP = 'asap'
export const AUTH_HAWK = 'hawk'

export const FIELD_TEXT = 'text'
export const FIELD_SECRET = 'secret'
export const FIELD_AREA = 'area'
export const FIELD_SELECT = 'select'

export const isSecretField = (field) => field.kind === FIELD_SECRET || field.secret === true

const SIGNATURE_METHODS = ['HMAC-SHA1', 'HMAC-SHA256', 'RSA-SHA1', 'RSA-SHA256', 'PLAINTEXT']
const SIGNATURE_RSA_PREFIX = 'RSA-'
const IN_HEADER = 'header'
const IN_QUERY = 'query'

const option = (value, name) => ({
  value,
  get label() {
    return AUTH_SCHEMES_TEXT.options[name]
  },
})

const field = (name, key, kind, { hint, ...rest } = {}) => {
  const described = {
    key,
    kind,
    ...rest,
    get label() {
      return AUTH_SCHEMES_TEXT.fields[name]
    },
  }
  if (hint) Object.defineProperty(described, 'placeholder', { get: () => AUTH_SCHEMES_TEXT.hints[hint], enumerable: true })
  return described
}

const TOKEN_PLACEMENTS = [option(IN_HEADER, 'authorizationHeader'), option(IN_QUERY, 'queryParams')]
const PLACEMENTS = [...TOKEN_PLACEMENTS, option('body', 'formBody')]

const HMAC_ALGORITHMS = ['HS256', 'HS384', 'HS512']
const KEY_ALGORITHMS = ['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512']
const JWT_ALGORITHMS = [...HMAC_ALGORITHMS, ...KEY_ALGORITHMS]
const asOptions = (values) => values.map((value) => ({ value, label: value }))
const usesSecret = (config) => HMAC_ALGORITHMS.includes(config.algorithm || HMAC_ALGORITHMS[0])
const inQuery = (config) => config.in === IN_QUERY
const SECRET_ENCODINGS = [option('text', 'plainText'), { value: 'base64', label: 'Base64' }]
const HAWK_ALGORITHMS = asOptions(['sha256', 'sha1'])
const HAWK_PAYLOAD = [option('skip', 'doNotInclude'), option('include', 'include')]

const credentials = [
  field('username', 'username', FIELD_TEXT),
  field('password', 'password', FIELD_SECRET),
]

const scheme = (label, note, fields, section) => ({
  label,
  ...(section && { section }),
  fields,
  get note() {
    return AUTH_SCHEMES_TEXT.notes[note]
  },
})

export const SCHEMES = {
  [AUTH_DIGEST]: scheme('Digest', 'digest', credentials),
  [AUTH_NTLM]: scheme('NTLM', 'ntlm', [...credentials, field('domain', 'domain', FIELD_TEXT)]),
  [AUTH_AWS]: scheme('AWS Signature V4', 'aws', [
    field('accessKeyId', 'accessKey', FIELD_TEXT),
    field('secretAccessKey', 'secretKey', FIELD_SECRET),
    field('sessionToken', 'sessionToken', FIELD_SECRET),
    field('region', 'region', FIELD_TEXT, { placeholder: 'us-east-1' }),
    field('service', 'service', FIELD_TEXT, { placeholder: 'execute-api' }),
  ], 'aws'),
  [AUTH_OAUTH1]: scheme('OAuth 1.0', 'oauth1', [
    field('consumerKey', 'consumerKey', FIELD_TEXT),
    field('consumerSecret', 'consumerSecret', FIELD_SECRET),
    field('accessToken', 'token', FIELD_SECRET),
    field('tokenSecret', 'tokenSecret', FIELD_SECRET),
    field('signatureMethod', 'signatureMethod', FIELD_SELECT, {
      options: SIGNATURE_METHODS.map((value) => ({ value, label: value })),
      fallback: SIGNATURE_METHODS[0],
    }),
    field('privateKey', 'privateKey', FIELD_AREA, {
      secret: true,
      when: (config) => (config.signatureMethod || '').startsWith(SIGNATURE_RSA_PREFIX),
    }),
    field('realm', 'realm', FIELD_TEXT),
    field('callbackUrl', 'callback', FIELD_TEXT),
    field('verifier', 'verifier', FIELD_TEXT),
    field('nonce', 'nonce', FIELD_TEXT, { hint: 'generated' }),
    field('timestamp', 'timestamp', FIELD_TEXT, { hint: 'generated' }),
    field('sendIn', 'in', FIELD_SELECT, { options: PLACEMENTS, fallback: IN_HEADER }),
  ], 'oauth1'),
  [AUTH_EDGEGRID]: scheme('Akamai EdgeGrid', 'edgegrid', [
    field('clientToken', 'clientToken', FIELD_TEXT),
    field('clientSecret', 'clientSecret', FIELD_SECRET),
    field('accessToken', 'accessToken', FIELD_SECRET),
    field('headersToSign', 'headersToSign', FIELD_TEXT, { hint: 'commaSeparated' }),
    field('maxBody', 'maxBody', FIELD_TEXT, { placeholder: '131072' }),
    field('nonce', 'nonce', FIELD_TEXT, { hint: 'generated' }),
    field('timestamp', 'timestamp', FIELD_TEXT, { hint: 'generated' }),
  ], 'edgegrid'),
  [AUTH_JWT]: scheme('JWT Bearer', 'jwt', [
    field('algorithm', 'algorithm', FIELD_SELECT, { options: asOptions(JWT_ALGORITHMS), fallback: JWT_ALGORITHMS[0] }),
    field('secret', 'secret', FIELD_SECRET, { when: usesSecret }),
    field('secretEncoding', 'secretEncoding', FIELD_SELECT, { options: SECRET_ENCODINGS, fallback: SECRET_ENCODINGS[0].value, when: usesSecret }),
    field('privateKey', 'privateKey', FIELD_AREA, { secret: true, when: (config) => !usesSecret(config) }),
    field('payload', 'payload', FIELD_AREA, { placeholder: '{"sub": "{{user_id}}", "iat": {{$timestamp}}}' }),
    field('extraHeaderFields', 'header', FIELD_AREA, { placeholder: '{"kid": "key-1"}' }),
    field('addTo', 'in', FIELD_SELECT, { options: TOKEN_PLACEMENTS, fallback: IN_HEADER }),
    field('headerPrefix', 'prefix', FIELD_TEXT, { placeholder: 'Bearer', when: (config) => !inQuery(config) }),
    field('queryParamName', 'queryKey', FIELD_TEXT, { placeholder: 'token', when: inQuery }),
  ], 'jwt'),
  [AUTH_ASAP]: scheme('ASAP (Atlassian)', 'asap', [
    field('algorithm', 'algorithm', FIELD_SELECT, { options: asOptions(KEY_ALGORITHMS), fallback: KEY_ALGORITHMS[0] }),
    field('issuer', 'issuer', FIELD_TEXT),
    field('audience', 'audience', FIELD_TEXT),
    field('keyId', 'keyId', FIELD_TEXT),
    field('privateKey', 'privateKey', FIELD_AREA, { secret: true }),
    field('subject', 'subject', FIELD_TEXT, { hint: 'optional' }),
    field('additionalClaims', 'claims', FIELD_AREA, { placeholder: '{"scope": "read"}' }),
    field('expiresAfter', 'expiry', FIELD_TEXT, { hint: 'expiry' }),
  ], 'asap'),
  [AUTH_HAWK]: scheme('Hawk', 'hawk', [
    field('hawkId', 'id', FIELD_TEXT),
    field('hawkKey', 'key', FIELD_SECRET),
    field('algorithm', 'algorithm', FIELD_SELECT, { options: HAWK_ALGORITHMS, fallback: HAWK_ALGORITHMS[0].value }),
    field('payloadHash', 'payloadHash', FIELD_SELECT, { options: HAWK_PAYLOAD, fallback: HAWK_PAYLOAD[0].value }),
    field('extraData', 'ext', FIELD_TEXT, { hint: 'optional' }),
    field('appId', 'app', FIELD_TEXT, { hint: 'optional' }),
    field('delegation', 'dlg', FIELD_TEXT, { hint: 'optional' }),
    field('nonce', 'nonce', FIELD_TEXT, { hint: 'generated' }),
    field('timestamp', 'timestamp', FIELD_TEXT, { hint: 'generated' }),
  ], 'hawk'),
}