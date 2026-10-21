import assert from "node:assert/strict"
import { test } from "node:test"
import { RUN_STREAM_EVENTS, RUN_STREAM_SECONDS, withRunStreamBudget } from "./runStream.js"

test("a stream without limits gets the run budget", () => {
  const { options } = withRunStreamBudget({ options: { stream: true, streamMaxSeconds: 0, streamMaxEvents: 0 } })
  assert.equal(options.streamMaxSeconds, RUN_STREAM_SECONDS)
  assert.equal(options.streamMaxEvents, RUN_STREAM_EVENTS)
})

test("limits set on the request are kept", () => {
  const { options } = withRunStreamBudget({ options: { stream: true, streamMaxSeconds: 90, streamMaxEvents: 7 } })
  assert.equal(options.streamMaxSeconds, 90)
  assert.equal(options.streamMaxEvents, 7)
})

test("other requests are untouched", () => {
  const request = { options: { stream: false, streamMaxSeconds: 0 } }
  assert.equal(withRunStreamBudget(request), request)
  const bare = {}
  assert.equal(withRunStreamBudget(bare), bare)
})
