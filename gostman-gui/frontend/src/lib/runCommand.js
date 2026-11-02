import { ROOT_ID } from './collectionTree'
const EXPORT_FILE = 'gostman-export.json'

const quoted = (text) => `'${text.replaceAll("'", "'\\''")}'`

export function runCommandLine({ folderName, dataName, iterations, parallel, format }) {
  const parts = ['gostman run', quoted(EXPORT_FILE)]
  if (folderName !== ROOT_ID) parts.push('--folder', quoted(folderName))
  if (dataName) parts.push('--data', quoted(dataName))
  if (iterations > 0) parts.push('--iterations', String(iterations))
  if (parallel > 1) parts.push('--parallel', String(parallel))
  parts.push('--reporter', format)
  return parts.join(' ')
}
