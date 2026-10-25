import english from '../../../../locales/en/share.json'
import { messages } from './i18n/core'
import { formatList } from './i18n/format'
import { collectionCounts, listedKinds } from './importText'

const text = messages('share', english, (t) => ({
  share: {
    summary: (collection, includeVariables) => [
      t(includeVariables ? 'share.summaryWithValues' : 'share.summaryNamesOnly', { counts: collectionCounts(collection) }),
      t('share.privacy'),
    ].join(' '),
    tooLong: (size, limit) => t('share.tooLong', { size, limit }),
    linkNote: (usesPassphrase, size) => t(usesPassphrase ? 'share.linkNotePassphrase' : 'share.linkNoteKey', { size }),
    fileNote: (usesPassphrase) => t(usesPassphrase ? 'share.fileNotePassphrase' : 'share.fileNoteKey'),
    sharedVariables: (names) => (
      names.length === 0 ? t('share.sharedVariablesNone') : t('share.sharedVariables', { names: formatList(names, 'unit') })
    ),
    sharedCollectionVariables: (names) => t('share.sharedCollectionVariables', { names: formatList(names, 'unit') }),
  },
  shareOpen: {
    environment: ({ name, variableCount, valueCount }) => (
      valueCount === 0
        ? t('shareOpen.environmentNoValues', { name, count: variableCount })
        : t('shareOpen.environmentValues', { name, count: variableCount, values: valueCount })
    ),
    folders: (names) => t('shareOpen.folders', { names: formatList(names, 'unit') }),
    activeContent: (count, kinds) => t('shareOpen.activeContent', { count, kinds: listedKinds(kinds) }),
  },
}))

export const SHARE_TEXT = text.share
export const SHARE_OPEN_TEXT = text.shareOpen
export const SHARE_ERRORS_TEXT = text.shareErrors
