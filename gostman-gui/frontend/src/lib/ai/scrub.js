const MARKER = '{{secret}}'
const MIN_SECRET_LENGTH = 3

const longestFirst = (first, second) => second.length - first.length

export function scrubText(text, secrets) {
  const wanted = [...new Set(secrets.map((secret) => String(secret).trim()).filter((secret) => secret.length >= MIN_SECRET_LENGTH))]
  return wanted.sort(longestFirst).reduce((cleaned, secret) => cleaned.split(secret).join(MARKER), text)
}

export const scrubPrompt = (prompt, secrets) => ({
  system: scrubText(prompt.system, secrets),
  user: scrubText(prompt.user, secrets),
})
