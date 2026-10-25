const HEX_DIGITS = '0123456789abcdefABCDEF'
const SCHEME_SYMBOLS = '+-.'
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const UUID_DASHES = [8, 13, 18, 23]
const UUID_LENGTH = 36
const MAX_HOSTNAME = 253
const MAX_LABEL = 63
const MAX_OCTET = 255

const isDigit = (character) => character >= '0' && character <= '9'
const isLetter = (character) => (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z')
const isDigits = (text) => text.length > 0 && [...text].every(isDigit)
const hasSpace = (text) => [...text].some((character) => character.trim() === '')
const isTwoDigits = (text, highest) => text.length === 2 && isDigits(text) && Number(text) <= highest
const isLeapYear = (year) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
const daysIn = (year, month) => (month === 2 && !isLeapYear(year) ? 28 : DAYS_IN_MONTH[month - 1])

function isDate(text) {
  if (text.length !== 10 || text[4] !== '-' || text[7] !== '-') return false
  const [year, month, day] = [text.slice(0, 4), text.slice(5, 7), text.slice(8)]
  if (!isDigits(year) || !isDigits(month) || !isDigits(day)) return false
  const monthNumber = Number(month)
  return monthNumber >= 1 && monthNumber <= 12 && Number(day) >= 1 && Number(day) <= daysIn(Number(year), monthNumber)
}

function isClock(text, withSeconds) {
  const parts = text.split(':')
  if (parts.length !== (withSeconds ? 3 : 2)) return false
  const [hours, minutes, seconds = '00'] = parts
  const [whole, fraction, extra] = seconds.split('.')
  return isTwoDigits(hours, 23) && isTwoDigits(minutes, 59) && isTwoDigits(whole, 60)
    && extra === undefined && (fraction === undefined || isDigits(fraction))
}

function isTime(text) {
  if (text.endsWith('Z') || text.endsWith('z')) return isClock(text.slice(0, -1), true)
  const sign = Math.max(text.lastIndexOf('+'), text.lastIndexOf('-'))
  return sign > 0 && isClock(text.slice(0, sign), true) && isClock(text.slice(sign + 1), false)
}

function isDateTime(text) {
  const separator = text[10]
  return (separator === 'T' || separator === 't' || separator === ' ') && isDate(text.slice(0, 10)) && isTime(text.slice(11))
}

function isEmail(text) {
  const at = text.lastIndexOf('@')
  return at > 0 && at < text.length - 1 && !hasSpace(text)
}

function isUuid(text) {
  return text.length === UUID_LENGTH && [...text].every((character, index) => (
    UUID_DASHES.includes(index) ? character === '-' : HEX_DIGITS.includes(character)
  ))
}

function isUri(text) {
  const colon = text.indexOf(':')
  return colon > 0 && isLetter(text[0]) && !hasSpace(text)
    && [...text.slice(0, colon)].every((character) => isLetter(character) || isDigit(character) || SCHEME_SYMBOLS.includes(character))
}

function isIpv4(text) {
  const parts = text.split('.')
  return parts.length === 4 && parts.every((part) => part.length <= 3 && isDigits(part) && Number(part) <= MAX_OCTET)
}

function isIpv6(text) {
  return text.includes(':') && text.split('::').length <= 2
    && [...text].every((character) => HEX_DIGITS.includes(character) || character === ':' || character === '.')
}

function isLabel(label) {
  return label.length > 0 && label.length <= MAX_LABEL && !label.startsWith('-') && !label.endsWith('-')
    && [...label].every((character) => isLetter(character) || isDigit(character) || character === '-')
}

function isHostname(text) {
  return text.length <= MAX_HOSTNAME && text.split('.').every(isLabel)
}

export const FORMAT_CHECKS = {
  'date-time': isDateTime,
  date: isDate,
  time: isTime,
  email: isEmail,
  uuid: isUuid,
  uri: isUri,
  ipv4: isIpv4,
  ipv6: isIpv6,
  hostname: isHostname,
}
