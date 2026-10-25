import english from '../../../../locales/en/import.json'
import { messages } from './i18n/core'
import { formatList } from './i18n/format'

const SHOWN_PATHS = 10
const COUNT_SEPARATOR = '; '
const HTML_EXAMPLE = '{{name}}'
const SECRET_EXAMPLE = '{{NAME}}'
const ACTIVE_KINDS = ['scripts', 'oauth', 'commands', 'files']

const text = messages('import', english, (t) => {
  const quoted = (names) => names.map((name) => t('importResult.quoted', { name }))
  const forNames = (key) => (names) => t(key, { count: names.length, names: formatList(quoted(names)) })
  const kindsIn = (group, kinds) => ACTIVE_KINDS.filter((kind) => kinds.includes(kind)).map((kind) => t(`activeImport.${group}.${kind}`))
  const listedKinds = (kinds) => formatList(kindsIn('kindLabels', kinds))
  const onlyKind = (kinds) => (kinds.length === 1 ? t(`activeImport.kindNouns.${kinds[0]}`) : '')
  const choice = (oneKey, manyKey) => (kinds) => (onlyKind(kinds) ? t(oneKey, { kind: onlyKind(kinds) }) : t(manyKey))
  const countedItems = (counts) => [
    t('importCount.request', { count: counts.requests.length }),
    t('importCount.folder', { count: counts.folders.length }),
    ...(counts.environments ? [t('importCount.environment', { count: counts.environments.length })] : []),
  ]
  const collectionSummary = (collection) => formatList(countedItems(collection))

  return {
    import: {
      tooLarge: (name, size, limit) => t('import.tooLarge', { name, size, limit }),
      sourceLine: (source, label, counts) => t('import.sourceLine', { source, label, counts }),
    },
    export: {
      get secretsNote() {
        return t('export.secretsNote', { placeholder: SECRET_EXAMPLE })
      },
      summary: (description, collection, name) => t(name ? 'export.summaryNamed' : 'export.summaryAll', { description, name, counts: collectionSummary(collection) }),
      checkHeading: (count, tool) => t('export.checkHeading', { count, tool }),
      formats: {
        html: {
          get description() {
            return t('export.formats.html.description', { example: HTML_EXAMPLE })
          },
        },
      },
      fileHeading: (name) => `# ${name}`,
    },
    importCount: {
      separator: COUNT_SEPARATOR,
      summary: collectionSummary,
      list: (items) => formatList(items),
      holding: (collections, inside) => t('importCount.holding', { collections, inside }),
    },
    importResult: {
      scopedEnvironments: forNames('importResult.scopedEnvironments'),
      scopedVariables: forNames('importResult.scopedVariables'),
      settingsAttached: forNames('importResult.settingsAttached'),
    },
    fileReads: {
      list: (paths) => {
        const hidden = paths.length - SHOWN_PATHS
        return [...paths.slice(0, SHOWN_PATHS), ...(hidden > 0 ? [t('fileReads.more', { count: hidden })] : [])].join('\n')
      },
    },
    activeImport: {
      kinds: listedKinds,
      title: choice('activeImport.titleOne', 'activeImport.titleMany'),
      withThem: choice('activeImport.withOne', 'activeImport.withMany'),
      withoutThem: choice('activeImport.withoutOne', 'activeImport.withoutMany'),
      leftOut: (kinds) => t('activeImport.leftOut', { kinds: listedKinds(kinds) }),
      message: (count, kinds) => t('activeImport.message', { count, kinds: listedKinds(kinds) }),
    },
  }
})

export const IMPORT_COUNT_TEXT = text.importCount
export const IMPORT_TEXT = text.import
export const EXPORT_TEXT = text.export
export const FORMAT_LABELS = text.formatLabels
export const TRANSFER_TEXT = text.transfer
export const IMPORT_RESULT_TEXT = text.importResult
export const FILE_READS_TEXT = text.fileReads
export const ACTIVE_IMPORT_TEXT = text.activeImport

export const IMPORT_FORMATS = [
  { value: 'auto', get label() { return text.importFormats.auto } },
  { value: 'postman', label: 'Postman' },
  { value: 'openapi', label: 'OpenAPI' },
  { value: 'insomnia', label: 'Insomnia' },
  { value: 'bruno', label: 'Bruno' },
  { value: 'har', label: 'HAR' },
  { value: 'http', get label() { return text.importFormats.http } },
  { value: 'wsdl', label: 'WSDL' },
  { value: 'gostman', label: 'Gostman' },
]

export const collectionCounts = (collection) => IMPORT_COUNT_TEXT.summary(collection)

export const listedKinds = (kinds) => ACTIVE_IMPORT_TEXT.kinds(kinds)

export const fileReadsParts = (paths) => (paths.length > 0 ? [FILE_READS_TEXT.heading(paths.length), { code: FILE_READS_TEXT.list(paths) }] : [])
