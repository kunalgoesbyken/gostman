import english from '../../../../locales/en/folderSettings.json'
import { messages } from './i18n/core'

const AUTHORIZATION_HEADER = 'Authorization'

const text = messages('folderSettings', english, (t) => ({
  folderSettings: {
    inheritsSchemeFrom: (name, scheme) => t('folderSettings.inheritsSchemeFrom', { name, scheme }),
    authorizationHeader: AUTHORIZATION_HEADER,
  },
}))

export const FOLDER_SETTINGS_TEXT = text.folderSettings
