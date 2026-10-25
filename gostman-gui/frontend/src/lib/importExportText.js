import english from '../../../../locales/en/importExport.json'
import { messages } from './i18n/core'
import { formatList } from './i18n/format'

const text = messages('importExport', english, (t) => ({
  importExport: {
    invalidYaml: (reason) => t('importExport.invalidYaml', { reason }),
    noRequests: (label) => t('importExport.noRequests', { label }),
    unreadable: (label) => t('importExport.unreadable', { label }),
    tlsKept: (shownNames, hiddenCount) => t('importExport.tlsKept', {
      names: hiddenCount > 0 ? t('importExport.namesMore', { names: formatList(shownNames, 'unit'), count: hiddenCount }) : formatList(shownNames),
    }),
    flattened: (count, levels) => t('importExport.flattened', { count, levels }),
  },
}))

export const IMPORT_EXPORT_TEXT = text.importExport
