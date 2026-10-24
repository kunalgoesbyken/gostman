import { pluralize } from './dataUtils'

export const RUNNER_TEXT = {
  inScope: (requests, iterations) => (
    iterations > 1 ? `${pluralize(requests, 'request')} in scope, ${pluralize(iterations, 'iteration')}.` : `${pluralize(requests, 'request')} in scope.`
  ),
  progress: ({ isRunning, done, total, passed, failed, skipped }) => [
    `${isRunning ? 'Running' : 'Ran'} ${done} of ${total}`,
    `${passed} passed`,
    `${failed} failed`,
    ...(skipped > 0 ? [`${skipped} skipped`] : []),
  ].join(' · '),
}
