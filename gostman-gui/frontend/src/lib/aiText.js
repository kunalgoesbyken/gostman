import english from '../../../../locales/en/ai.json'
import { messages } from './i18n/core'

const SCRIPT_SECTIONS = { preScript: 'ai.tasks.script.sectionPreScript', postScript: 'ai.tasks.script.sectionPostScript' }

const PREVIEW_NOTES = new Map([[null, 'ai.previewNote'], [true, 'ai.previewNoteValues'], [false, 'ai.previewNoteStructure']])

const text = messages('ai', english, (t) => ({
  ai: {
    previewNote: (host, size, tokens, includeValues = null) => t(PREVIEW_NOTES.get(includeValues), { host, size, tokens }),
    tooLarge: (size, limit) => t('ai.tooLarge', { size, limit }),
    searchLimited: (sent, total) => t('ai.searchLimited', { sent, total }),
    tasks: {
      script: {
        section: (scriptKind) => t(SCRIPT_SECTIONS[scriptKind]),
      },
    },
    errors: {
      retryIn: (summary, seconds) => t('ai.errors.retryIn', { summary, seconds }),
      withDetail: (summary, detail) => t('ai.errors.withDetail', { summary, detail }),
      unreachable: (host, reason, advice) => t(reason ? 'ai.errors.unreachableWithReason' : 'ai.errors.unreachable', { host, reason, advice }),
    },
  },
}))

export const AI_TEXT = text.ai
