import english from '../../../../locales/en/runner.json'
import { messages } from './i18n/core'
import { formatList } from './i18n/format'

const SHOWN_COLUMNS = 4

const text = messages('runner', english, (t) => {
  const plannedMessage = (isRunning, isOver) => `runner.${isRunning ? 'progressRunning' : 'progressRan'}${isOver ? 'More' : ''}`

  return {
    runner: {
      dataOverrides: (names) => (
        names.length > SHOWN_COLUMNS
          ? t('runner.dataOverridesMore', { columns: formatList(names.slice(0, SHOWN_COLUMNS), 'unit'), count: names.length - SHOWN_COLUMNS })
          : t('runner.dataOverrides', { columns: formatList(names) })
      ),
      attempt: (attempt, attempts) => t('runner.attempt', { attempt, attempts }),
      tests: (passed, total) => t('runner.tests', { passed, total }),
      inScope: (selected, total, iterations) => {
        const scope = selected === total ? t('runner.inScope', { count: total }) : t('runner.inScopeSome', { selected, count: total })
        return iterations > 1 ? `${scope} ${t('runner.iterationsInScope', { count: iterations })}` : scope
      },
      selected: (selected, total) => t('runner.selected', { selected, count: total }),
      progress: ({ isRunning, done, total, passed, failed, skipped }) => [
        t(plannedMessage(isRunning, done > total), { done, total }),
        t('runner.progressPassed', { count: passed }),
        t('runner.progressFailed', { count: failed }),
        ...(skipped > 0 ? [t('runner.progressSkipped', { count: skipped })] : []),
      ].join(' · '),
    },
  }
})

export const RUNNER_TEXT = text.runner
