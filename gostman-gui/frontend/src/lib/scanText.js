import english from '../../../../locales/en/scan.json'
import { messages } from './i18n/core'

const VARIABLE_EXAMPLE = '{{variables}}'

const text = messages('scan', english, (t) => {
  const withExample = (key) => t(key, { example: VARIABLE_EXAMPLE })

  return {
    scan: {
      get intro() {
        return withExample('scan.intro')
      },
      get foundShare() {
        return withExample('scan.foundShare')
      },
      get foundExport() {
        return withExample('scan.foundExport')
      },
    },
  }
})

export const SCAN_TEXT = text.scan
