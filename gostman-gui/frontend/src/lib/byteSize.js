import { formatNumber } from './i18n/format'
import { SIZE_TEXT } from './sizeText'

const KILOBYTE = 1024
const MEGABYTE = KILOBYTE * KILOBYTE
const GIGABYTE = MEGABYTE * KILOBYTE

const fractionDigits = (digits) => ({ minimumFractionDigits: digits, maximumFractionDigits: digits })

export function formatBytes(bytes) {
  if (bytes < KILOBYTE) return SIZE_TEXT.bytes({ value: formatNumber(bytes) })
  if (bytes < MEGABYTE) return SIZE_TEXT.kilobytes({ value: formatNumber(bytes / KILOBYTE, fractionDigits(1)) })
  if (bytes < GIGABYTE) return SIZE_TEXT.megabytes({ value: formatNumber(bytes / MEGABYTE, fractionDigits(2)) })
  return SIZE_TEXT.gigabytes({ value: formatNumber(bytes / GIGABYTE, fractionDigits(1)) })
}
