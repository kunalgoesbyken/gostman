import english from '../../../../locales/en/onboarding.json'
import { messages } from './i18n/core'
import { STEP_VARIABLE } from './onboarding'

const VARIABLE_EXAMPLE = '{{baseUrl}}'
const MISSING_EXAMPLE = '{{token}}'

const text = messages('onboarding', english, (t) => {
  const variable = `onboarding.steps.${STEP_VARIABLE}`

  return {
    onboarding: {
      progress: (done, total) => t('onboarding.progress', { done, total }),
      steps: {
        [STEP_VARIABLE]: {
          get hint() {
            return t(`${variable}.hint`, { example: VARIABLE_EXAMPLE })
          },
          get legend() {
            return [
              { name: VARIABLE_EXAMPLE, look: 'defined', label: t(`${variable}.defined`) },
              { name: MISSING_EXAMPLE, look: 'missing', label: t(`${variable}.missing`) },
            ]
          },
        },
      },
    },
  }
})

export const ONBOARDING_TEXT = text.onboarding
