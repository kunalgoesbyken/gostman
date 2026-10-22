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

const GENERATED = 'Generated when empty'
const SIGNATURE_METHODS = ['HMAC-SHA1', 'HMAC-SHA256', 'RSA-SHA1', 'RSA-SHA256', 'PLAINTEXT']
const SIGNATURE_RSA_PREFIX = 'RSA-'
const IN_HEADER = 'header'
const IN_QUERY = 'query'
const TOKEN_PLACEMENTS = [
  { value: IN_HEADER, label: 'Authorization header' },
  { value: IN_QUERY, label: 'Query params' },
]
const PLACEMENTS = [...TOKEN_PLACEMENTS, { value: 'body', label: 'Form body' }]

const HMAC_ALGORITHMS = ['HS256', 'HS384', 'HS512']
const KEY_ALGORITHMS = ['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512']
const JWT_ALGORITHMS = [...HMAC_ALGORITHMS, ...KEY_ALGORITHMS]
const asOptions = (values) => values.map((value) => ({ value, label: value }))
const usesSecret = (config) => HMAC_ALGORITHMS.includes(config.algorithm || HMAC_ALGORITHMS[0])
const inQuery = (config) => config.in === IN_QUERY
const SECRET_ENCODINGS = [
  { value: 'text', label: 'Plain text' },
  { value: 'base64', label: 'Base64' },
]
const HAWK_ALGORITHMS = asOptions(['sha256', 'sha1'])
const HAWK_PAYLOAD = [
  { value: 'skip', label: 'Do not include' },
  { value: 'include', label: 'Include' },
]

const credentials = [
  { key: 'username', label: 'Username', kind: FIELD_TEXT },
  { key: 'password', label: 'Password', kind: FIELD_SECRET },
]

export const SCHEMES = {
  [AUTH_DIGEST]: {
    label: 'Digest',
    fields: credentials,
    note: 'The request is sent first without credentials and repeated with a Digest answer when the server challenges it.',
  },
  [AUTH_NTLM]: {
    label: 'NTLM',
    fields: [...credentials, { key: 'domain', label: 'Domain', kind: FIELD_TEXT }],
    note: 'The NTLM handshake runs automatically when the server asks for it.',
  },
  [AUTH_AWS]: {
    label: 'AWS Signature V4',
    section: 'aws',
    fields: [
      { key: 'accessKey', label: 'Access key ID', kind: FIELD_TEXT },
      { key: 'secretKey', label: 'Secret access key', kind: FIELD_SECRET },
      { key: 'sessionToken', label: 'Session token', kind: FIELD_SECRET },
      { key: 'region', label: 'Region', kind: FIELD_TEXT, placeholder: 'us-east-1' },
      { key: 'service', label: 'Service', kind: FIELD_TEXT, placeholder: 'execute-api' },
    ],
    note: 'Access key, secret key, region and service are required to sign the request.',
  },
  [AUTH_OAUTH1]: {
    label: 'OAuth 1.0',
    section: 'oauth1',
    fields: [
      { key: 'consumerKey', label: 'Consumer key', kind: FIELD_TEXT },
      { key: 'consumerSecret', label: 'Consumer secret', kind: FIELD_SECRET },
      { key: 'token', label: 'Access token', kind: FIELD_SECRET },
      { key: 'tokenSecret', label: 'Token secret', kind: FIELD_SECRET },
      {
        key: 'signatureMethod',
        label: 'Signature method',
        kind: FIELD_SELECT,
        options: SIGNATURE_METHODS.map((value) => ({ value, label: value })),
        fallback: SIGNATURE_METHODS[0],
      },
      {
        key: 'privateKey',
        label: 'Private key (PEM)',
        kind: FIELD_AREA,
        secret: true,
        when: (config) => (config.signatureMethod || '').startsWith(SIGNATURE_RSA_PREFIX),
      },
      { key: 'realm', label: 'Realm', kind: FIELD_TEXT },
      { key: 'callback', label: 'Callback URL', kind: FIELD_TEXT },
      { key: 'verifier', label: 'Verifier', kind: FIELD_TEXT },
      { key: 'nonce', label: 'Nonce', kind: FIELD_TEXT, placeholder: GENERATED },
      { key: 'timestamp', label: 'Timestamp', kind: FIELD_TEXT, placeholder: GENERATED },
      { key: 'in', label: 'Send in', kind: FIELD_SELECT, options: PLACEMENTS, fallback: IN_HEADER },
    ],
    note: 'Form body places the parameters in the request body, which is only valid for form-encoded requests.',
  },
  [AUTH_EDGEGRID]: {
    label: 'Akamai EdgeGrid',
    section: 'edgegrid',
    fields: [
      { key: 'clientToken', label: 'Client token', kind: FIELD_TEXT },
      { key: 'clientSecret', label: 'Client secret', kind: FIELD_SECRET },
      { key: 'accessToken', label: 'Access token', kind: FIELD_SECRET },
      { key: 'headersToSign', label: 'Headers to sign', kind: FIELD_TEXT, placeholder: 'Comma separated, optional' },
      { key: 'maxBody', label: 'Max body size', kind: FIELD_TEXT, placeholder: '131072' },
      { key: 'nonce', label: 'Nonce', kind: FIELD_TEXT, placeholder: GENERATED },
      { key: 'timestamp', label: 'Timestamp', kind: FIELD_TEXT, placeholder: GENERATED },
    ],
    note: 'Client token, client secret and access token are required to sign the request.',
  },
  [AUTH_JWT]: {
    label: 'JWT Bearer',
    section: 'jwt',
    fields: [
      { key: 'algorithm', label: 'Algorithm', kind: FIELD_SELECT, options: asOptions(JWT_ALGORITHMS), fallback: JWT_ALGORITHMS[0] },
      { key: 'secret', label: 'Secret', kind: FIELD_SECRET, when: usesSecret },
      { key: 'secretEncoding', label: 'Secret encoding', kind: FIELD_SELECT, options: SECRET_ENCODINGS, fallback: SECRET_ENCODINGS[0].value, when: usesSecret },
      { key: 'privateKey', label: 'Private key (PEM)', kind: FIELD_AREA, secret: true, when: (config) => !usesSecret(config) },
      { key: 'payload', label: 'Payload (JSON)', kind: FIELD_AREA, placeholder: '{"sub": "{{user_id}}", "iat": {{$timestamp}}}' },
      { key: 'header', label: 'Extra header fields (JSON)', kind: FIELD_AREA, placeholder: '{"kid": "key-1"}' },
      { key: 'in', label: 'Add to', kind: FIELD_SELECT, options: TOKEN_PLACEMENTS, fallback: IN_HEADER },
      { key: 'prefix', label: 'Header prefix', kind: FIELD_TEXT, placeholder: 'Bearer', when: (config) => !inQuery(config) },
      { key: 'queryKey', label: 'Query param name', kind: FIELD_TEXT, placeholder: 'token', when: inQuery },
    ],
    note: 'The token is signed again for every request, so {{$timestamp}} in the payload stays current.',
  },
  [AUTH_ASAP]: {
    label: 'ASAP (Atlassian)',
    section: 'asap',
    fields: [
      { key: 'algorithm', label: 'Algorithm', kind: FIELD_SELECT, options: asOptions(KEY_ALGORITHMS), fallback: KEY_ALGORITHMS[0] },
      { key: 'issuer', label: 'Issuer', kind: FIELD_TEXT },
      { key: 'audience', label: 'Audience', kind: FIELD_TEXT },
      { key: 'keyId', label: 'Key ID', kind: FIELD_TEXT },
      { key: 'privateKey', label: 'Private key (PEM)', kind: FIELD_AREA, secret: true },
      { key: 'subject', label: 'Subject', kind: FIELD_TEXT, placeholder: 'Optional' },
      { key: 'claims', label: 'Additional claims (JSON)', kind: FIELD_AREA, placeholder: '{"scope": "read"}' },
      { key: 'expiry', label: 'Expires after', kind: FIELD_TEXT, placeholder: '1h, or seconds' },
    ],
    note: 'Issuer, audience, key ID and private key are required. A new token with its own iat, exp and jti is sent as a Bearer token with every request.',
  },
  [AUTH_HAWK]: {
    label: 'Hawk',
    section: 'hawk',
    fields: [
      { key: 'id', label: 'Hawk Auth ID', kind: FIELD_TEXT },
      { key: 'key', label: 'Hawk Auth Key', kind: FIELD_SECRET },
      { key: 'algorithm', label: 'Algorithm', kind: FIELD_SELECT, options: HAWK_ALGORITHMS, fallback: HAWK_ALGORITHMS[0].value },
      { key: 'payloadHash', label: 'Payload hash', kind: FIELD_SELECT, options: HAWK_PAYLOAD, fallback: HAWK_PAYLOAD[0].value },
      { key: 'ext', label: 'Extra data', kind: FIELD_TEXT, placeholder: 'Optional' },
      { key: 'app', label: 'App ID', kind: FIELD_TEXT, placeholder: 'Optional' },
      { key: 'dlg', label: 'Delegation', kind: FIELD_TEXT, placeholder: 'Optional' },
      { key: 'nonce', label: 'Nonce', kind: FIELD_TEXT, placeholder: GENERATED },
      { key: 'timestamp', label: 'Timestamp', kind: FIELD_TEXT, placeholder: GENERATED },
    ],
    note: 'Auth ID and key are required to sign the request.',
  },
}
