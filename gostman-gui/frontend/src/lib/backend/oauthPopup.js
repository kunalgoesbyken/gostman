import { OAUTH_TEXT } from '../oauthText.js'

export const OAUTH_CALLBACK_PATH = '/oauth-callback'

const CHANNEL_NAME = 'gostman-oauth'
const POPUP_FEATURES = 'popup,width=520,height=680'
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000
const TEXT = OAUTH_TEXT.popup

let cancelPending = () => {}

export const isOAuthCallback = () => window.location.pathname === OAUTH_CALLBACK_PATH

export function relayOAuthCallback() {
  const channel = new BroadcastChannel(CHANNEL_NAME)
  channel.postMessage(Object.fromEntries(new URLSearchParams(window.location.search)))
  channel.close()
  window.close()
}

function readAnswer(answer, issuer) {
  if (issuer && answer.iss && answer.iss !== issuer) throw new Error(TEXT.wrongIssuer(answer.iss, issuer))
  if (answer.error) throw new Error(TEXT.refused(answer.error_description || answer.error))
  if (!answer.code) throw new Error(TEXT.noCode)
  return { code: answer.code, issuer: answer.iss ?? '' }
}

export function signInWithPopup(url, state, issuer = '') {
  cancelPending()
  const popup = window.open(url, CHANNEL_NAME, POPUP_FEATURES)
  if (!popup) return Promise.reject(new Error(TEXT.blocked))

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

    timer = setTimeout(() => fail(new Error(TEXT.timedOut)), SIGN_IN_TIMEOUT_MS)
    cancelPending = () => {
      popup.close()
      fail(new Error(OAUTH_TEXT.cancelled))
    }
    channel.onmessage = (event) => {
      if (event.data?.state !== state) return
      try {
        succeed(readAnswer(event.data, issuer))
      } catch (error) {
        fail(error)
      }
    }
  })
}

export const cancelOAuthPopup = () => cancelPending()
