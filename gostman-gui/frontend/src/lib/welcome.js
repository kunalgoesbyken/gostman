import { readStored, writeStored } from './storage'
import { WELCOME_TEXT } from './welcomeText'

const STORAGE_KEY = 'gostman.welcome'
const DISMISSED = 'dismissed'

export const SAMPLE_REQUEST = {
  get name() {
    return WELCOME_TEXT.sampleRequestName
  },
  method: 'GET',
  url: 'https://httpbin.org/anything?hello=world',
}

export const SHORTCUT_IDS = ['commandPalette', 'newRequest', 'sendRequest', 'saveRequest', 'findRequest', 'nextPane', 'shortcutsHelp']

export const isWelcomeDismissed = () => readStored(STORAGE_KEY) === DISMISSED

export const rememberWelcomeDismissed = () => writeStored(STORAGE_KEY, DISMISSED)
