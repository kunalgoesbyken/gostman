const STORAGE_KEY = 'gostman.welcome'
const DISMISSED = 'dismissed'

export const SAMPLE_REQUEST = {
  name: 'Sample request',
  method: 'GET',
  url: 'https://httpbin.org/anything?hello=world',
}

export const SHORTCUT_IDS = ['commandPalette', 'newRequest', 'sendRequest', 'saveRequest', 'findRequest', 'nextPane', 'shortcutsHelp']

export function isWelcomeDismissed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === DISMISSED
  } catch {
    return false
  }
}

export function rememberWelcomeDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, DISMISSED)
  } catch {
    return
  }
}
