import english from '../../../../locales/en/localCommands.json'
import { messages } from './i18n/core'

const text = messages('localCommands', english, (t) => ({
  localCommand: {
    message: ({ line, environment }) => [
      t('localCommand.intro'),
      { code: line },
      ...(environment.length > 0 ? [t('localCommand.environmentIntro'), { code: environment.join('\n') }] : []),
      t('localCommand.warning'),
    ],
  },
}))

export const LOCAL_COMMAND_TEXT = text.localCommand
