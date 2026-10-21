export const AUTH_DIGEST = 'digest'
export const AUTH_NTLM = 'ntlm'
export const AUTH_AWS = 'awsv4'
export const AUTH_OAUTH1 = 'oauth1'
export const AUTH_EDGEGRID = 'edgegrid'

export const FIELD_TEXT = 'text'
export const FIELD_SECRET = 'secret'
export const FIELD_AREA = 'area'
export const FIELD_SELECT = 'select'

const SIGNATURE_METHODS = ['HMAC-SHA1', 'HMAC-SHA256', 'RSA-SHA1', 'RSA-SHA256', 'PLAINTEXT']
const SIGNATURE_RSA_PREFIX = 'RSA-'
const PLACEMENTS = [
  { value: 'header', label: 'Authorization header' },
  { value: 'query', label: 'Query params' },
  { value: 'body', label: 'Form body' },
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
        when: (config) => (config.signatureMethod || '').startsWith(SIGNATURE_RSA_PREFIX),
      },
      { key: 'realm', label: 'Realm', kind: FIELD_TEXT },
      { key: 'callback', label: 'Callback URL', kind: FIELD_TEXT },
      { key: 'verifier', label: 'Verifier', kind: FIELD_TEXT },
      { key: 'nonce', label: 'Nonce', kind: FIELD_TEXT, placeholder: 'Generated when empty' },
      { key: 'timestamp', label: 'Timestamp', kind: FIELD_TEXT, placeholder: 'Generated when empty' },
      { key: 'in', label: 'Send in', kind: FIELD_SELECT, options: PLACEMENTS, fallback: PLACEMENTS[0].value },
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
      { key: 'nonce', label: 'Nonce', kind: FIELD_TEXT, placeholder: 'Generated when empty' },
      { key: 'timestamp', label: 'Timestamp', kind: FIELD_TEXT, placeholder: 'Generated when empty' },
    ],
    note: 'Client token, client secret and access token are required to sign the request.',
  },
}
