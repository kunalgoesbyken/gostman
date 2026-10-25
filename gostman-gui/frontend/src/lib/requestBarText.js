import english from '../../../../locales/en/requestBar.json'
import { messages } from './i18n/core'

const text = messages('requestBar', english, (t) => {
  const placeholders = (prefix) => [t(`${prefix}.full`), t(`${prefix}.medium`), t(`${prefix}.short`)]

  return {
    requestBar: {
      get urlPlaceholders() {
        return placeholders('requestBar.urlPlaceholders')
      },
      get methodPlaceholders() {
        return { GRPC: placeholders('requestBar.methodPlaceholders.grpc'), MCP: placeholders('requestBar.methodPlaceholders.mcp') }
      },
    },
  }
})

export const REQUEST_BAR_TEXT = text.requestBar
export const CURL_FILES_TEXT = text.curlFiles
