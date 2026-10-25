import { pluralize } from './dataUtils'
import { collectionCounts, listedKinds } from './importText'

const LINK_NOTES = {
  passphrase: 'The passphrase is not in the link. Tell the recipient through another channel.',
  key: 'The key is part of the link, after the # sign, so anyone who has the whole link can read the collection.',
}

const FILE_NOTES = {
  passphrase: 'The recipient opens the file with your passphrase. Tell them through another channel.',
  key: 'The file cannot be opened without the key below. Send the key through a different channel than the file.',
}

const PRIVACY = 'Encrypted in this window and never uploaded. OAuth tokens, cookies, history and network settings are never included.'

const noteFor = (notes, usesPassphrase) => (usesPassphrase ? notes.passphrase : notes.key)

export const SHARE_TEXT = {
  protections: { key: 'Random key', passphrase: 'Passphrase' },
  deliveries: { link: 'Link', file: 'Encrypted file' },
  summary: (collection, includeVariables) => `${collectionCounts(collection)} (${includeVariables ? 'with their values' : 'variable names only'}). ${PRIVACY}`,
  tooLong: (size, limit) => `This selection needs a link of ${size}. Links stop at ${limit} because chat and mail apps cut longer ones short. Send it as an encrypted file instead.`,
  linkNote: (usesPassphrase, size) => `${noteFor(LINK_NOTES, usesPassphrase)} ${size}.`,
  linkLabel: 'Share link',
  fileNote: (usesPassphrase) => noteFor(FILE_NOTES, usesPassphrase),
  saveFile: 'Save file',
  keyLabel: 'Key',
  scopeField: 'Share',
  scopeLabel: 'What to share',
  everything: 'Everything',
  requestScope: (path) => `Request: ${path}`,
  sharedVariables: (names) => (names.length === 0
    ? 'No environment variables are shared, because nothing here uses one.'
    : `Only the environment variables used here are shared: ${names.join(', ')}.`),
  sharedCollectionVariables: (names) => `These collection variables are shared with their collections: ${names.join(', ')}.`,
  includeVariables: 'Share variable values (off: only the variable names are shared)',
  includeExamples: 'Include saved example responses',
  protection: 'Protection',
  passphrasePlaceholder: (length) => `Passphrase, at least ${length} characters`,
  passphraseLabel: 'Passphrase',
  sendAs: 'Send as',
  literalCredentials: (count) => `${pluralize(count, 'request')} hold a password, token or key typed directly into the Auth tab. Those are part of the request and are shared with it.`,
  nothing: 'There is nothing to share here yet.',
}

export const SHARE_OPEN_TEXT = {
  title: 'Shared with you',
  dialogLabel: 'Shared collection',
  intro: 'This link carries an encrypted collection. It is decrypted in this window and nothing is added until you choose Import.',
  credentials: {
    key: { label: 'Key', hint: 'This file was sent without its key. Paste the key the sender gave you.' },
    passphrase: { label: 'Passphrase', hint: 'This share is locked with a passphrase. Ask the sender for it.' },
  },
  open: 'Open',
  cancel: 'Cancel',
  environment: ({ name, variableCount, valueCount }) =>`${name}: ${pluralize(variableCount, 'variable')}, ${valueCount === 0 ? 'names only, no values' : `${valueCount} with a value`}`,
  folders: (names) => `Folders: ${names.join(', ')}`,
  keepValues: 'Variables you already have keep your values.',
  examples: (count) => pluralize(count, 'saved example response'),
  activeContent: (count, kinds) => `${count === 1 ? '1 item carries' : `${count} items carry`} ${listedKinds(kinds)}. You are asked before those are imported.`,
  requestsLabel: 'Shared requests',
  deriving: 'Deriving the key and decrypting',
  decrypting: 'Decrypting',
}
