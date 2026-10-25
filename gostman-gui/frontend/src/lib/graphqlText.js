import english from '../../../../locales/en/graphql.json'
import { messages } from './i18n/core'
import { FOLDER_SETTINGS_TEXT } from './folderSettingsText'

const text = messages('graphql', english, (t) => ({
  graphql: {
    queryPlaceholder: 'query {\n  viewer {\n    id\n  }\n}',
    variablesPlaceholder: '{\n  "id": "1"\n}',
    get variablesNotObject() {
      return FOLDER_SETTINGS_TEXT.varsInvalid
    },
    syntaxAt: (message, line, column) => t('graphql.syntaxAt', { message, line, column }),
    noJsonBody: (status) => t('graphql.noJsonBody', { status }),
    noSchema: (status) => t('graphql.noSchema', { status }),
  },
}))

export const GRAPHQL_TEXT = text.graphql