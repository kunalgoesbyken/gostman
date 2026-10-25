import english from '../../../../locales/en/flows.json'
import { messages } from './i18n/core'
import { formatList } from './i18n/format'
import { shellWord } from './shellWords'

const MS_PER_SECOND = 1000

const braced = (name) => `{{${name}}}`

const text = messages('flows', english, (t) => {
  const duration = (milliseconds) => (
    milliseconds >= MS_PER_SECOND && milliseconds % MS_PER_SECOND === 0
      ? t('flowCanvas.seconds', { value: milliseconds / MS_PER_SECOND })
      : t('flowCanvas.milliseconds', { value: milliseconds })
  )
  const moreKey = (key, match) => (match === 'any' ? `${key}Or` : `${key}And`)

  return {
    flowKind: {
      unknown: { description: '' },
    },
    flowEngine: {
      unknownTarget: (field, target) => t('flowEngine.unknownTarget', { field, target }),
      intoLoop: (field, target) => t('flowEngine.intoLoop', { field, target }),
      problem: (title, message) => t('flowEngine.problem', { title, message }),
      nothingFound: (path, title) => t('flowEngine.nothingFound', { path, title }),
      noHeader: (name, title) => t('flowEngine.noHeader', { name, title }),
      notAList: (path, title) => t('flowEngine.notAList', { path, title }),
      budget: (sends, cap) => t('flowEngine.budget', { count: sends, cap }),
      ended: (outcome) => t(outcome === 'failed' ? 'flowEngine.endedFailed' : 'flowEngine.ended'),
      attemptPassed: (attempt, attempts) => (attempts > 1 ? t('flowEngine.attemptPassedOf', { attempt, attempts }) : t('flowEngine.attemptPassed')),
      attemptFailed: (attempt, attempts) => (attempts > 1 ? t('flowEngine.attemptFailedOf', { attempt, attempts }) : t('flowEngine.attemptFailed')),
      retrying: (attempt, attempts) => t('flowEngine.retrying', { attempt, attempts }),
      branch: (branch, target) => t('flowEngine.branch', { branch, target }),
      wrote: (names) => formatList(names, 'unit'),
      iteration: (index, count) => t('flowEngine.iteration', { position: index + 1, count }),
      waited: (milliseconds) => t('flowEngine.waited', { duration: t('flowEngine.milliseconds', { value: milliseconds }) }),
    },
    flowCanvas: {
      stepLabel: (position, count, kind, title, state) => (
        t(state ? 'flowCanvas.stepLabelWithState' : 'flowCanvas.stepLabel', { position, count, kind, title, state })
      ),
      retry: (times, delayMs) => (
        delayMs > 0 ? t('flowCanvas.retryApart', { count: times, delay: duration(delayMs) }) : t('flowCanvas.retry', { count: times })
      ),
      until: (condition, more) => (more > 0 ? t('flowCanvas.untilMore', { condition, count: more }) : t('flowCanvas.until', { condition })),
      sets: (name, source) => t('flowCanvas.sets', { name, source }),
      fromTemplate: (template) => template || '""',
      fromResponse: (source, path, title) => t(path ? 'flowCanvas.fromResponsePath' : 'flowCanvas.fromResponse', { source, path, title }),
      condition: (condition, more, match) => (more > 0 ? t(moreKey('flowCanvas.condition', match), { condition, count: more }) : condition),
      variablesCondition: (condition) => t('flowCanvas.variablesCondition', { condition }),
      loop: (path, title) => t('flowCanvas.loop', { path: path || '$', title }),
      wait: (milliseconds) => t('flowCanvas.wait', { duration: duration(milliseconds) }),
      toEnd: (label) => t('flowCanvas.toEnd', { label }),
      attempt: (attempt, attempts) => t('flowCanvas.attempt', { attempt, attempts }),
    },
    flowEditor: {
      get variablesHint() {
        return t('flowEditor.variablesHint', { variables: braced('variables'), example: braced('item.id') })
      },
      get templatePlaceholder() {
        return t('flowEditor.templatePlaceholder', { example: braced('variable') })
      },
      loopHint: (item, index) => t('flowEditor.loopHint', { item: braced(item), field: braced(`${item}.field`), index: braced(index) }),
    },
    flowView: {
      cli: (name) => `gostman flow run ${shellWord(name)}`,
    },
  }
})

export const FLOW_KIND_TEXT = text.flowKind
export const FLOW_FIELD_TEXT = text.flowField
export const FLOW_ENGINE_TEXT = text.flowEngine
export const FLOW_IMPORT_TEXT = text.flowImport
export const FLOW_TEMPLATE_TEXT = text.flowTemplate
export const FLOW_TEXT = text.flow
export const FLOW_CANVAS_TEXT = text.flowCanvas
export const FLOW_PICKER_TEXT = text.flowPicker
export const FLOW_EDITOR_TEXT = text.flowEditor
export const FLOW_VIEW_TEXT = text.flowView
export const FLOW_RUN_TEXT = text.flowRun
export const FLOW_SCRIPT_TEXT = text.flowScript
