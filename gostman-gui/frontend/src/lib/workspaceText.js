import english from '../../../../locales/en/workspace.json'
import { messages } from './i18n/core'

const text = messages('workspace', english, (t) => ({
  storageActions: {
    get trustMessage() {
      return t('storageActions.trustMessage', { example: '{{$file(...)}}' })
    },
    describeProblem: ({ path, line, message }) => (
      line ? t('storageActions.problemAtLine', { path, line, message }) : t('storageActions.problem', { path, message })
    ),
  },
}))

export const WORKSPACE_TEXT = text.workspace
export const STORAGE_ACTIONS_TEXT = text.storageActions
