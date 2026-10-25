import english from '../../../../locales/en/grpc.json'
import { messages } from './i18n/core'

const text = messages('grpc', english, (t) => ({
  grpc: {
    methodPlaceholder: 'package.Service/Method',
    tooLarge: (name, size, limit) => t('grpc.tooLarge', { name, size, limit }),
  },
}))

export const GRPC_TEXT = text.grpc