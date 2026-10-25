import { isPlainObject } from './dataUtils'
import { localizedText } from './localized'

const textsIn = (values) => (Array.isArray(values) ? values.filter((value) => typeof value === 'string') : [])

const isRemark = (value) => isPlainObject(value) && typeof value.text === 'string'

export const remark = (text, warning = false, kind = '') => ({ text, kind, warning })

const cleanRemark = ({ text, kind, warning, localized }) => remark(localizedText(localized, text), warning === true, typeof kind === 'string' ? kind : '')

export function remarksOf(data) {
  if (Array.isArray(data?.remarks)) return data.remarks.filter(isRemark).map(cleanRemark)
  return [...textsIn(data?.notes).map((text) => remark(text)), ...textsIn(data?.warnings).map((text) => remark(text, true))]
}

export const skippedOf = (data) => textsIn(data?.skipped).map((text, index) => localizedText(data.skippedLocalized?.[index], text))

export const warningsIn = (remarks) => remarks.filter((item) => item.warning).map((item) => item.text)

export const notesIn = (remarks) => remarks.filter((item) => !item.warning).map((item) => item.text)

export const withoutRemarksOn = (remarks, kinds) => remarks.filter((item) => !kinds.includes(item.kind))
