import english from '../../../../locales/en/soap.json'
import { messages } from './i18n/core'

const ACTION_HEADER = 'SOAPAction'

const text = messages('soap', english, () => ({
  soap: {
    actionLabel: ACTION_HEADER,
    actionPlaceholder: ACTION_HEADER,
  },
}))

export const SOAP_TEXT = text.soap