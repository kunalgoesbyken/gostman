const CALL_OPEN = '('
const CALL_CLOSE = ')'
const ENCODERS = new Set(['$base64', '$base64Url', '$urlEncode'])

export function splitCall(name) {
  const open = name.indexOf(CALL_OPEN)
  return open < 0 || !name.endsWith(CALL_CLOSE) ? null : { base: name.slice(0, open), tail: name.slice(open) }
}

export const argumentOf = (call) => call.tail.slice(1, -1).trim()

export const isEncoderBase = (base) => ENCODERS.has(base)

export const isEncodedName = (name) => ENCODERS.has(splitCall(name)?.base)

export const unencodedName = (name) => (isEncodedName(name) ? unencodedName(argumentOf(splitCall(name))) : name)
