export const STATUS_BAR_TEXT = {
  network: 'Network',
  mock: (isRunning, port) => (isRunning ? `Mock server (running${port ? ` on :${port}` : ''})` : 'Mock server'),
  capture: (isRunning) => (isRunning ? 'Capture (running)' : 'Capture'),
  git: 'Git',
  detached: 'Detached HEAD',
  cookies: 'Cookies',
}
