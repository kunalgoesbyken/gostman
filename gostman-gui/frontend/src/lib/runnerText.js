import { pluralize } from './dataUtils'

const SHOWN_COLUMNS = 4

export const RUNNER_TEXT = {
  title: 'Run requests',
  scope: 'Requests to run',
  allRequests: 'All requests',
  delay: 'Delay (ms)',
  stopOnFailure: 'Stop on failure',
  run: 'Run',
  stop: 'Stop',
  iterations: 'Iterations',
  parallel: 'Parallel',
  dataFile: 'Data file (CSV or JSON)',
  clearData: 'Remove the data file',
  rows: (count) => pluralize(count, 'row'),
  dataOverrides: (names) => {
    const shown = names.slice(0, SHOWN_COLUMNS).join(', ')
    const rest = names.length > SHOWN_COLUMNS ? ` and ${names.length - SHOWN_COLUMNS} more` : ''
    return `Each row sets ${shown}${rest}, in place of any request, folder or environment variable with the same name.`
  },
  report: 'Download HTML report',
  includeTags: 'Only tags',
  excludeTags: 'Skip tags',
  anyTag: 'Any',
  noTag: 'None',
  skipped: 'Skipped',
  tests: (passed, total) => `${passed}/${total} checks`,
  duration: (milliseconds) => `${milliseconds} ms`,
  results: 'Run results',
  running: 'Running',
  nothingRun: 'Nothing run yet',
  nothingToRun: 'Nothing to run',
  nothingToRunHint: 'Save requests to the collection, or pick another folder or tag filter, then run them here.',
  emptyBody: 'The response had no body.',
  truncated: 'Only the start of a long body is kept in a run. Send the request on its own to see all of it.',
  idle: "Requests run in sidebar order with their scripts, extraction rules and assertions, using the environment chosen for their collection. A data file runs everything once per row. With parallel above 1, requests are sent together and do not see each other's extracted variables.",
  inScope: (requests, iterations) => (
    iterations > 1 ? `${pluralize(requests, 'request')} in scope, ${pluralize(iterations, 'iteration')}.` : `${pluralize(requests, 'request')} in scope.`
  ),
  progress: ({ isRunning, done, total, passed, failed, skipped }) => [
    done > total ? `${isRunning ? 'Running' : 'Ran'} ${done}, more than the ${total} planned, as scripts repeated requests` : `${isRunning ? 'Running' : 'Ran'} ${done} of ${total}`,
    `${passed} passed`,
    `${failed} failed`,
    ...(skipped > 0 ? [`${skipped} skipped`] : []),
  ].join(' · '),
}
