import english from '../../../../locales/en/execution.json'
import { messages } from './i18n/core'

const FILE_PLACEHOLDER_EXAMPLE = '{{$file(...)}}'

const text = messages('execution', english, (t) => ({
  execution: {
    sendLimit: (limit) => t('execution.sendLimit', { limit }),
    hostNotPermitted: (host) => t('execution.hostNotPermitted', { host }),
    scopeLabel: (stage, name) => t('execution.scopeLabel', { stage, name }),
    get scriptFileReads() {
      return t('execution.scriptFileReads', { example: FILE_PLACEHOLDER_EXAMPLE })
    },
  },
}))

export const EXECUTION_TEXT = text.execution
