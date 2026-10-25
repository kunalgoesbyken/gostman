import SENSITIVE_WORDS from '../../../../redact/sensitive_words.json'

export { SENSITIVE_WORDS }

export const isSensitiveName = (name) => {
  const lowered = String(name).toLowerCase()
  return SENSITIVE_WORDS.some((word) => lowered.includes(word))
}

export const withoutSensitiveValues = (values) => (
  Object.fromEntries(Object.entries(values).map(([name, value]) => [name, isSensitiveName(name) ? '' : value]))
)
