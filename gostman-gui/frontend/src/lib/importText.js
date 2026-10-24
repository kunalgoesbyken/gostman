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
  readFailure: 'The file could not be read as text.',
  binaryFailure: (name) => `${name} is not a text file.`,
  tooMany: (limit) => `There are more than ${limit} files.`,
  tooLarge: (name, size, limit) => `${name} is ${size}. Files are limited to ${limit}.`,
  totalTooLarge: (limit) => `The files together are larger than ${limit}.`,
  noFiles: 'No importable files were found.',
  filesSelected: (count) => `${count} files selected`,
  sourceLine: (source, label, counts) => `${source}: ${label}, ${counts}`,
  totalLine: (counts) => `In total: ${counts}`,
  summary: (counts) => `Found ${counts}`,
}

export const EXPORT_TEXT = {
  includeSecrets: 'Include credentials',
  secretsNote: 'Passwords, tokens and secret-named headers or variables are replaced with {{NAME}} placeholders.',
  secretsWarning: 'Credentials are written into the file in plain text.',
  building: 'Building the export',
  saveArchive: 'Save .zip',
  fileHeading: (name) => `# ${name}`,
}

const ACTIVE_KIND_LABELS = {
  scripts: 'scripts',
  oauth: 'OAuth 2.0 settings',
  commands: 'commands that start local MCP servers',
  files: '{{$file(...)}} placeholders that send files from this computer',
}

const joinedList = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

export const ACTIVE_IMPORT_TEXT = {
  title: (kinds) => (kinds.length === 1 && kinds[0] === 'scripts' ? 'Import the scripts?' : 'Import scripts and sign-in settings?'),
  confirm: 'Import them',
  message: (items, kinds) => `${items} in this import carry ${joinedList(Object.keys(ACTIVE_KIND_LABELS).filter((kind) => kinds.includes(kind)).map((kind) => ACTIVE_KIND_LABELS[kind]))}. These run when a request is sent and can read your variables, so only import them from a source you trust. Cancel imports everything else without them.`,
}
