import { ROOT_ID } from './collectionTree'
import { powershellQuote, shellQuote } from './shellWords'

const EXPORT_FILE = 'gostman-export.json'
const ASCII_DELETE = 127
const FIRST_PRINTABLE = 32

export const SHELL_POSIX = 'posix'
export const SHELL_POWERSHELL = 'powershell'

const QUOTES = { [SHELL_POSIX]: shellQuote, [SHELL_POWERSHELL]: powershellQuote }

const BACKSLASH = '\\'
const DOUBLE_QUOTE = '"'

const isPastable = (text) => !text.includes(DOUBLE_QUOTE) && !text.endsWith(BACKSLASH) && [...text].every((character) => {
  const code = character.charCodeAt(0)
  return code >= FIRST_PRINTABLE && code !== ASCII_DELETE
})

const commandFor = (quote, { folderName, dataName, iterations, parallel, format }) => {
  const parts = ['gostman run', quote(EXPORT_FILE)]
  if (folderName !== ROOT_ID) parts.push(`--folder=${quote(folderName)}`)
  if (dataName) parts.push(`--data=${quote(dataName)}`)
  if (iterations > 0) parts.push(`--iterations=${iterations}`)
  if (parallel > 1) parts.push(`--parallel=${parallel}`)
  parts.push(`--reporter=${format}`)
  return parts.join(' ')
}

export function runCommandLines(run) {
  if (![run.folderName, run.dataName].every(isPastable)) return null
  return Object.entries(QUOTES).map(([shell, quote]) => ({ shell, command: commandFor(quote, run) }))
}
