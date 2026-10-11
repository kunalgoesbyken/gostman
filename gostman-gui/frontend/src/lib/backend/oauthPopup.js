export const OAUTH_CALLBACK_PATH = '/oauth-callback'

const CHANNEL_NAME = 'gostman-oauth'
const POPUP_FEATURES = 'popup,width=520,height=680'
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000
const BLOCKED = 'The sign-in window was blocked. Allow pop-ups for this site and try again.'
const TIMED_OUT = 'No sign-in arrived within five minutes.'
const CANCELLED = 'The sign-in was cancelled.'
const MISMATCH = 'The sign-in answer did not match this request, so it was ignored.'
const NO_CODE = 'The provider did not return an authorization code.'

let cancelPending = () => {}

export const isOAuthCallback = () => window.location.pathname === OAUTH_CALLBACK_PATH

export function relayOAuthCallback() {
  const channel = new BroadcastChannel(CHANNEL_NAME)
  channel.postMessage(Object.fromEntries(new URLSearchParams(window.location.search)))
  channel.close()
  window.close()
}

function readAnswer(answer, state) {
  if (answer.error) throw new Error(`The provider refused the sign-in: ${answer.error_description || answer.error}`)
  if (answer.state !== state) throw new Error(MISMATCH)
  if (!answer.code) throw new Error(NO_CODE)
  return answer.code
}

export function signInWithPopup(url, state) {
  cancelPending()
  const popup = window.open(url, CHANNEL_NAME, POPUP_FEATURES)
  if (!popup) return Promise.reject(new Error(BLOCKED))

  return new Promise((resolve, reject) => {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    let timer = 0
    const settle = (finish) => (value) => {
      clearTimeout(timer)
      channel.close()
      cancelPending = () => {}
      finish(value)
    }
    const fail = settle(reject)
    const succeed = settle(resolve)

    timer = setTimeout(() => fail(new Error(TIMED_OUT)), SIGN_IN_TIMEOUT_MS)
    cancelPending = () => {
      popup.close()
      fail(new Error(CANCELLED))
    }
    channel.onmessage = (event) => {
      try {
        succeed(readAnswer(event.data, state))
      } catch (error) {
        fail(error)
      }
    }
  })
}

export const cancelOAuthPopup = () => cancelPending()
