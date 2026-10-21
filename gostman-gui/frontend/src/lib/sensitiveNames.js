import words from '../../../../redact/sensitive_words.json'

export const SENSITIVE_WORDS = words

export const isSensitiveName = (name) => {
  const lowered = String(name).toLowerCase()
  return SENSITIVE_WORDS.some((word) => lowered.includes(word))
}
