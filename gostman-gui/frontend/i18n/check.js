import { LOCALES_ROOT } from './paths.js'
import { absentFileSummary, fallbackSummary, validateCatalogues } from './validate.js'

const percent = (ratio) => `${(ratio * 100).toFixed(1)}%`

const verbose = process.argv.includes('--verbose') || process.env.GOSTMAN_I18N_VERBOSE === '1'
const result = validateCatalogues(LOCALES_ROOT)

const problems = [...result.errors, ...absentFileSummary(result)]

problems.forEach((line) => console.error(`error  ${line}`))
fallbackSummary(result).forEach((line) => console.warn(`warn   ${line}`))
if (verbose) result.warnings.forEach((line) => console.warn(`warn   ${line}`))

console.log(`English: ${result.counts.messages} messages in ${result.counts.namespaces} namespaces`)
Object.entries(result.coverage).forEach(([language, coverage]) => console.log(`${language}: ${percent(coverage)}`))
console.log(problems.length === 0 ? 'Translation files are valid.' : `${problems.length} problem${problems.length === 1 ? '' : 's'} found.`)

process.exit(problems.length === 0 ? 0 : 1)
