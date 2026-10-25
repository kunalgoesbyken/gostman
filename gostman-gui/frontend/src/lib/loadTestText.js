import english from '../../../../locales/en/loadTest.json'
import { messages } from './i18n/core'

const text = messages('loadTest', english, (t) => ({
  loadTest: {
    failureBreakdown: (networkErrors, statusFailures, failureStatus) => t('loadTest.failureBreakdown', { networkErrors, statusFailures, failureStatus }),
    statusCount: (code, count) => t('loadTest.statusCount', { code, count }),
    histogramBarLabel: (bin) => t('loadTest.histogramBarLabel', { from: bin.fromMs, to: bin.toMs, count: bin.count }),
  },
}))

export const LOAD_TEST_TEXT = text.loadTest
