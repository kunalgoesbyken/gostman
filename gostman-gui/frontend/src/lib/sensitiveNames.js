export const SENSITIVE_WORDS = ['auth', 'bearer', 'cookie', 'credential', 'key', 'passw', 'pwd', 'secret', 'session', 'signature', 'token']

export const isSensitiveName = (name) => {
  const lowered = String(name).toLowerCase()
  return SENSITIVE_WORDS.some((word) => lowered.includes(word))
}
