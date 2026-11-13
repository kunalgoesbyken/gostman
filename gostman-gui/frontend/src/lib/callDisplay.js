import { CLASS_CLIENT_ERROR, CLASS_NONE, CLASS_OTHER, CLASS_REDIRECT, CLASS_SERVER_ERROR, CLASS_SUCCESS, statusClassOf, timeOf } from './callHistory'
import { formatBytes } from './byteSize'
import { formatDateTime } from './i18n/format'
import { RESPONSE_TEXT } from './responseText'
import { HISTORY_TEXT } from './sidebarText'

const TEXT = HISTORY_TEXT.calls
const SECOND_OPTIONS = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }
const SHORT_OPTIONS = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }

const BADGE_VARIANT = {
  [CLASS_SUCCESS]: 'success',
  [CLASS_REDIRECT]: 'redirect',
  [CLASS_CLIENT_ERROR]: 'clientError',
  [CLASS_SERVER_ERROR]: 'serverError',
  [CLASS_OTHER]: 'default',
  [CLASS_NONE]: 'serverError',
}

export const durationText = (value) => (value === null ? TEXT.unknown : RESPONSE_TEXT.milliseconds(value))

export const sizeText = (value) => (value === null ? TEXT.unknown : formatBytes(value))

export const statusText = (call) => (call.statusCode > 0 ? String(call.statusCode) : TEXT.classes[statusClassOf(call)])

export const statusVariantOf = (call) => BADGE_VARIANT[statusClassOf(call)]

export const momentText = (time) => formatDateTime(new Date(time), SECOND_OPTIONS)

export const shortMomentText = (time) => formatDateTime(new Date(time), SHORT_OPTIONS)

export const callLabel = (call) => TEXT.barLabel({ time: momentText(timeOf(call)), status: statusText(call), duration: durationText(call.durationMs), size: sizeText(call.size) })
