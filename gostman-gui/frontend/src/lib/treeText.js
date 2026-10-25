import english from '../../../../locales/en/tree.json'
import { messages } from './i18n/core'
import { formatList } from './i18n/format'

const text = messages('tree', english, (t) => ({
  tree: {
    deleteManyMessage: (requests, folders) => {
      const counted = [requests > 0 && t('tree.requestCount', { count: requests }), folders > 0 && t('tree.folderCount', { count: folders })]
      return t(folders > 0 ? 'tree.deleteManyMessageFolders' : 'tree.deleteManyMessage', { subject: formatList(counted.filter(Boolean)) })
    },
  },
}))

export const TREE_TEXT = text.tree
export const LABEL_TEXT = text.label
export const TAB_TEXT = text.tab
