import assert from "node:assert/strict"
import { test } from "node:test"
import { applyCompletion, describeReference, findReferences, looksSecret, openReference, suggestNames } from "./variables.js"

const vars = new Map([["base_url", "https://x"], ["apiToken", "abc"], ["user", "1"]])

test("findReferences trims names and reports offsets", () => {
  assert.deepEqual(findReferences("a {{ user }}/{{x}}"), [
    { name: "user", start: 2, end: 12 },
    { name: "x", start: 13, end: 18 },
  ])
})

test("describeReference masks secret-looking variables", () => {
  assert.equal(describeReference("apiToken", vars).shown, "•".repeat(8))
  assert.equal(describeReference("base_url", vars).shown, "https://x")
  assert.equal(describeReference("nope", vars).defined, false)
  assert.ok(looksSecret("PASSWORD") && !looksSecret("user"))
})

test("openReference and completion", () => {
  const text = "{{ba}}/x"
  const ref = openReference(text, 4)
  assert.deepEqual(ref, { start: 0, query: "ba" })
  assert.deepEqual(suggestNames(vars, "ba"), ["base_url"])
  assert.deepEqual(applyCompletion(text, ref, 4, "base_url"), { text: "{{base_url}}/x", caret: 12 })
  assert.equal(openReference("{{a}} b", 7), null)
})

test("secret masking uses the shared sensitive-name list", () => {
  for (const name of ["pwd", "bearer", "db_credential", "sessionId", "apiKey", "x-signature"]) {
    assert.ok(looksSecret(name), name)
  }
  assert.ok(!looksSecret("base_url"))
})
