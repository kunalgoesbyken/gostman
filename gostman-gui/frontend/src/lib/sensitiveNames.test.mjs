import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { SENSITIVE_WORDS, isSensitiveName } from './sensitiveNames.js'

const goWords = JSON.parse(readFileSync(new URL('../../../../redact/sensitive_words.json', import.meta.url), 'utf8'))

test('the frontend and Go sensitive-name lists are identical', () => {
  assert.deepEqual([...SENSITIVE_WORDS].sort(), [...goWords].sort())
})

test('names are matched case-insensitively and by substring', () => {
  assert.ok(isSensitiveName('X-API-KEY'))
  assert.ok(isSensitiveName('refreshToken'))
  assert.ok(!isSensitiveName('base_url'))
})
