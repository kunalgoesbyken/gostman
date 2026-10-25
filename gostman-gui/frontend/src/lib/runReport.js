import template from '../../../../runner/report/report.html?raw'

const PLACEHOLDER = '__GOSTMAN_REPORT__'
const UNSAFE = ['<', '>', '&', ' ', ' ']

const escapeCharacter = (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`

const embeddable = (json) => UNSAFE.reduce((text, character) => text.split(character).join(escapeCharacter(character)), json)

const toResult = (result) => ({
  id: result.id,
  name: result.name,
  folder: result.folder || '',
  method: result.method,
  url: result.url,
  resolvedUrl: result.resolvedUrl || '',
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
  attempt: result.attempt || 0,
  attempts: result.attempts || 0,
  handled: result.handled || '',
  exchange: result.exchange,
})

const reached = (results) => new Set(results.map((result) => `${result.id} ${result.iteration || 0}`)).size

export function summarize(results, planned) {
  const skipped = results.filter((result) => result.skipped).length
  const handled = results.filter((result) => !result.skipped && result.handled).length
  const failed = results.filter((result) => !result.skipped && !result.handled && result.hasFailed).length
  const tests = results.flatMap((result) => result.tests)
  return {
    requests: planned,
    passed: results.length - skipped - failed - handled,
    failed,
    skipped,
    handled,
    notRun: Math.max(planned - reached(results), 0),
    tests: tests.length,
    failedTests: tests.filter((test) => !test.passed).length,
  }
}

export const environmentsUsed = (results, environmentOf) => [...new Set(results.map(environmentOf).filter(Boolean))].join(', ')

export function buildReportPage(results, run, environment, flow = null) {
  const report = {
    ...(flow && { flow, collection: flow.name }),
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
