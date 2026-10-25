import { pluralize } from './dataUtils'

export const collectionCounts = ({ requests, folders, environments }) => {
  const counted = [pluralize(requests.length, 'request'), pluralize(folders.length, 'folder'), ...(environments ? [pluralize(environments.length, 'environment')] : [])]
  return `${counted.slice(0, -1).join(', ')} and ${counted.at(-1)}`
}

export const IMPORT_FORMATS = [
  { value: 'auto', label: 'Detect automatically' },
  { value: 'postman', label: 'Postman' },
  { value: 'openapi', label: 'OpenAPI' },
  { value: 'insomnia', label: 'Insomnia' },
  { value: 'bruno', label: 'Bruno' },
  { value: 'har', label: 'HAR' },
  { value: 'http', label: '.http files' },
  { value: 'wsdl', label: 'WSDL' },
  { value: 'gostman', label: 'Gostman' },
]

export const FORMAT_LABELS = {
  insomnia: 'Insomnia export',
  har: 'HAR capture',
  wsdl: 'WSDL service',
  bruno: 'Bruno collection',
  postman: 'Postman file',
  openapi: 'OpenAPI spec',
  gostman: 'Gostman export',
  http: '.http file',
}

export const IMPORT_TEXT = {
  chooseFiles: 'Choose files',
  importButton: 'Import',
  chooseFolder: 'Choose folder',
  dropHint: 'Drop files, a folder or a .zip here, or paste content below. Insomnia, HAR, WSDL, Bruno, Postman, OpenAPI and Swagger, .http files (REST Client, JetBrains HTTP Client), Gostman exports and share links.',
  formatLabel: 'Format',
  pastePlaceholder: 'Paste a collection, a spec, a capture or a share link',
  pasteLabel: 'Content to import',
  pastedName: 'pasted',
  reading: 'Reading the content',
  skipStatic: 'Leave out images, fonts, styles and scripts',
  skippedHeading: 'Left out',
  binaryFailure: (name) => `${name} is not a text file.`,
  tooMany: (limit) => `There are more than ${limit} files.`,
  tooLarge: (name, size, limit) => `${name} is ${size}. Files are limited to ${limit}.`,
  totalTooLarge: (limit) => `The files together are larger than ${limit}.`,
  noFiles: 'No importable files were found.',
  filesSelected: (count) => `${pluralize(count, 'file')} selected`,
  clearFiles: 'Clear',
  sourceLine: (source, label, counts) => `${source}: ${label}, ${counts}`,
  totalLine: (counts) => `In total: ${counts}`,
}

export const EXPORT_TEXT = {
  includeSecrets: 'Include credentials',
  secretsNote: 'Passwords, tokens and secret-named headers or variables are replaced with {{NAME}} placeholders.',
  secretsWarning: 'Credentials are written into the file in plain text.',
  variableSecretsNote: 'Variables named like a password, token or key are exported without their values.',
  saveFile: 'Save file',
  formatLabel: 'Export format',
  previewLabel: 'Export preview',
  summary: (description, collection, name) => `${description}. ${name ? `"${name}" has` : 'You have'} ${collectionCounts(collection)}.`,
  collectionField: 'Collection',
  formatField: 'Format',
  allCollections: 'All collections',
  failed: (reason) => `Could not build the export: ${reason}`,
  adaptFailed: (reason) => `Scripts and checks are exported as written, because they could not be adapted: ${reason}`,
  reportLabel: 'What changed for the target tool',
  checkHeading: (count, tool) => `${pluralize(count, 'thing')} to check before using this in ${tool}`,
  changedHeading: (tool) => `What changed for ${tool}`,
  formats: {
    gostman: { label: 'Gostman', description: 'Full backup: requests, folders, every environment, the global variables and the collection variables, without secret values' },
    postman: { label: 'Postman', description: 'Collection v2.1, which Insomnia also imports. Scripts and checks are adapted to run in both, and the variables in use, except secret ones, become collection variables' },
    openapiJson: { label: 'OpenAPI JSON', description: 'OpenAPI 3.0 description of the HTTP requests' },
    openapiYaml: { label: 'OpenAPI YAML', description: 'OpenAPI 3.0 description of the HTTP requests' },
    markdown: { label: 'Markdown', description: 'Readable API documentation' },
    html: { label: 'HTML docs', description: 'One self-contained page to publish or print. Credentials are left out and variables stay as {{name}}' },
    bruno: { label: 'Bruno', description: 'A folder of .bru files with environments, saved as a .zip. Scripts and checks are adapted to run in Bruno' },
    curl: { label: 'curl script', description: 'One curl command per request. Credentials become environment variable placeholders' },
    har: { label: 'HAR', description: 'HTTP Archive 1.2 with the requests and no responses' },
    http: { label: '.http files', description: 'Requests for VS Code REST Client and JetBrains HTTP Client, one file per folder, with http-client.env.json environments' },
  },
  docs: {
    titlePlaceholder: 'Title (default: API documentation)',
    titleLabel: 'Documentation title',
    includeExamples: 'Include example responses',
    playground: 'Include a Try it panel',
  },
  fileHeading: (name) => `# ${name}`,
}

export const TRANSFER_TEXT = {
  title: 'Import and export',
  tabsLabel: 'Import or export',
  tabs: { import: 'Import', export: 'Export', share: 'Share' },
}

const ACTIVE_KIND_LABELS = {
  scripts: 'scripts',
  oauth: 'OAuth 2.0 settings',
  commands: 'commands that start local MCP servers',
  files: 'file reads that send files from this computer',
}

const joinedList = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

const quotedNames = (names) => joinedList(names.map((name) => `"${name}"`))

export const IMPORT_COUNT_TEXT = {
  collection: 'collection',
  folder: 'folder',
  request: 'request',
  flow: 'flow',
  environment: 'environment',
  global: 'global environment',
  variable: 'collection variable',
  list: joinedList,
  holding: (collections, inside) => `${collections} with ${inside}`,
  settingsFor: (owners) => `settings for ${owners}`,
  separator: '; ',
}

const ACTIVE_KIND_NOUNS = {
  scripts: 'scripts',
  oauth: 'OAuth settings',
  commands: 'commands',
  files: 'file reads',
}

export const listedKinds = (kinds) => joinedList(Object.keys(ACTIVE_KIND_LABELS).filter((kind) => kinds.includes(kind)).map((kind) => ACTIVE_KIND_LABELS[kind]))

const onlyKind = (kinds) => (kinds.length === 1 ? ACTIVE_KIND_NOUNS[kinds[0]] : '')

const carried = (count) => (count === 1 ? '1 item in this import carries' : `${count} items in this import carry`)

export const IMPORT_RESULT_TEXT = {
  joinedEnvironment: (name) => `An environment named "${name}" already existed, so the imported variables were added to it. Variables it already had kept their values.`,
  scopedEnvironments: (names) => `Environments from ${quotedNames(names)} apply only to ${names.length === 1 ? 'its' : 'their'} requests. To use an environment everywhere, set Available in to Every collection under Environments.`,
  scopedVariables: (names) => `Collection variables from ${quotedNames(names)} apply only to ${names.length === 1 ? 'its' : 'their'} requests; an environment variable with the same name still wins.`,
  importedCollectionName: 'Imported collection',
  settingsAttached: (names) => `The settings for all collections in this import were added to the collection settings of ${quotedNames(names)}, so they apply only to ${names.length === 1 ? 'its' : 'their'} requests. Your own settings for all collections were not changed.`,
  settingsWrapped: (name) => `The settings for all collections in this import were put on a new collection, "${name}", which holds everything imported, so they apply only to those requests. Your own settings for all collections were not changed.`,
}

const SHOWN_PATHS = 10

export const FILE_READS_TEXT = {
  heading: (count) => (count === 1 ? 'The file it reads from this computer:' : `The ${count} files it reads from this computer:`),
  list: (paths) => {
    const hidden = paths.length - SHOWN_PATHS
    return [...paths.slice(0, SHOWN_PATHS), ...(hidden > 0 ? [`and ${hidden} more`] : [])].join('\n')
  },
}

export const fileReadsParts = (paths) => (paths.length > 0 ? [FILE_READS_TEXT.heading(paths.length), { code: FILE_READS_TEXT.list(paths) }] : [])

export const ACTIVE_IMPORT_TEXT = {
  title: (kinds) => (onlyKind(kinds) ? `Import the ${onlyKind(kinds)}?` : 'Review before importing'),
  withThem: (kinds) => (onlyKind(kinds) ? `Import with ${onlyKind(kinds)}` : 'Import everything'),
  withoutThem: (kinds) => `Import without ${onlyKind(kinds) || 'them'}`,
  leftOut: (kinds) => `The ${listedKinds(kinds)} were left out.`,
  message: (count, kinds) => `${carried(count)} ${listedKinds(kinds)}. These run when a request is sent and can read your variables, so only import them from a source you trust. Without them, everything else is still imported.`,
}
