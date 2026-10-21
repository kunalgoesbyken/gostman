export const RUN_STREAM_SECONDS = 10
export const RUN_STREAM_EVENTS = 100

export function withRunStreamBudget(request) {
  if (!request.options?.stream) return request
  const { streamMaxSeconds, streamMaxEvents } = request.options
  return {
    ...request,
    options: {
      ...request.options,
      streamMaxSeconds: streamMaxSeconds > 0 ? streamMaxSeconds : RUN_STREAM_SECONDS,
      streamMaxEvents: streamMaxEvents > 0 ? streamMaxEvents : RUN_STREAM_EVENTS,
    },
  }
}
