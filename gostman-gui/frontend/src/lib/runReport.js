import template from '../../../../runner/report/report.html?raw'

const PLACEHOLDER = '__GOSTMAN_REPORT__'
const UNSAFE = ['<', '>', '&', ' ', ' ']

const escapeCharacter = (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`

const embeddable = (json) => UNSAFE.reduce((text, character) => text.split(character).join(escapeCharacter(character)), json)

const toResult = (result) => ({
  id: result.id,
  name: result.name,
  method: result.method,
  url: result.url,
  skipped: result.skipped || '',
  status: result.status || '',
  statusCode: result.statusCode || 0,
  durationMs: result.durationMs || 0,
  error: result.error || '',
  failed: Boolean(result.hasFailed),
  tests: result.tests,
  logs: result.logs || [],
  visualization: result.visualization || '',
  iteration: result.iteration,
  exchange: result.exchange,
})

export function summarize(results, planned) {
  const skipped = results.filter((result) => result.skipped).length
  const failed = results.filter((result) => !result.skipped && result.hasFailed).length
  const tests = results.flatMap((result) => result.tests)
  return {
    requests: planned,
    passed: results.length - skipped - failed,
    failed,
    skipped,
    notRun: Math.max(planned - results.length, 0),
    tests: tests.length,
    failedTests: tests.filter((test) => !test.passed).length,
  }
}

export function buildReportPage(results, run, environment) {
  const report = {
    environment,
    startedAt: run.startedAt.toISOString(),
    durationMs: run.finishedAt - run.startedAt,
    iterations: run.iterations,
    parallel: run.parallel > 1 ? run.parallel : 0,
    summary: summarize(results, run.planned),
    results: results.map(toResult),
  }
  return template.replace(PLACEHOLDER, () => embeddable(JSON.stringify(report)))
}
