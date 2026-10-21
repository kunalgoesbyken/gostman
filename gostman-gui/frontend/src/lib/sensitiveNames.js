// Single source of truth for "this name probably holds a secret". Used when
// masking exported docs (lib/docs/redaction.js) and when previewing variable
// values in the editor (lib/variables.js), so the two never disagree.
export const SENSITIVE_WORDS = ['auth', 'bearer', 'cookie', 'credential', 'key', 'passw', 'pwd', 'secret', 'session', 'signature', 'token']

export const isSensitiveName = (name) => {
  const lowered = String(name).toLowerCase()
  return SENSITIVE_WORDS.some((word) => lowered.includes(word))
}
