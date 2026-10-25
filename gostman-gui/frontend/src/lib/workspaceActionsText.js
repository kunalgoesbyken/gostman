import english from '../../../../locales/en/workspaceActions.json'
import { messages } from './i18n/core'

const text = messages('workspaceActions', english, (t) => ({
  workspaceActions: {
    deleteFolderMessage: (name, requests, subfolders, parent) => {
      const counts = { name, requests: t('workspaceActions.requestCount', { count: requests }), subfolders: t('workspaceActions.subfolderCount', { count: subfolders }) }
      if (requests + subfolders === 0) return t('workspaceActions.deleteFolderEmpty', { name })
      return parent === null ? t('workspaceActions.deleteFolderToTop', counts) : t('workspaceActions.deleteFolderToParent', { ...counts, parent })
    },
  },
}))

export const WORKSPACE_ACTIONS_TEXT = text.workspaceActions
