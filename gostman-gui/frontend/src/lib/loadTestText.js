export const LOAD_TEST_TEXT = {
  title: 'Load test',
  commandTitle: 'Load test this request',
  commandDescription: 'Send the current request many times at once and measure latency',
  barLabel: 'Load test',
  barHint: 'Load test this request',
  notice: 'Only test systems you own or have permission to test. Each worker sends the request as it is shown here, without scripts or shared cookies.',
  unsupported: 'Only HTTP requests can be load tested. gRPC, MCP, WebSocket and streaming requests are not supported.',
  noUrl: 'Give the request a URL first.',
  concurrency: 'Concurrent workers',
  duration: 'Duration (seconds)',
  rateLimit: 'Requests per second cap',
  rateLimitHint: 'Leave empty for no cap',
  start: 'Start',
  stop: 'Stop',
  running: 'Running',
  stopped: 'Stopped early',
  progress: { elapsed: 'Elapsed', requests: 'Requests', rate: 'Requests/s', p95: 'p95', failed: 'Failed' },
  summary: { total: 'Requests', succeeded: 'Succeeded', failed: 'Failed', rate: 'Requests/s', received: 'Received' },
  failureBreakdown: (networkErrors, statusFailures, failureStatus) => `${networkErrors} network, ${statusFailures} with status ${failureStatus} or above`,
  percentilesLabel: 'Latency',
  percentileColumns: { name: 'Measure', value: 'Milliseconds' },
  statusLabel: 'Status codes',
  histogramLabel: 'Latency distribution',
  histogramBarLabel: (bin) => `${bin.fromMs} to ${bin.toMs} ms: ${bin.count} requests`,
  errorsLabel: 'Error samples',
  accuracy: (percent) => `Percentiles are accurate to within ${percent}%.`,
  emptyTitle: 'No results yet',
  emptyHint: 'Choose the load and press Start.',
}

export const LOAD_LIMITS = {
  concurrency: 500,
  durationSeconds: 600,
}

export const DEFAULT_LOAD = {
  concurrency: 10,
  durationSeconds: 10,
}

export const LATENCY_ACCURACY_PERCENT = 1
