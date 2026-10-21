import assert from "node:assert/strict"
import { test } from "node:test"
import { applyCompletion, describeReference, findReferences, isDefined, looksSecret, openReference, suggestNames } from "./variables.js"

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

test("references accept names in any script", () => {
  assert.deepEqual(openReference("{{名前", 4), { start: 0, query: "名前" })
  assert.deepEqual(openReference("{{ имя", 6), { start: 0, query: "имя" })
})

test("dynamic and prompt names count as defined and complete after their prefix", () => {
  assert.ok(isDefined("$guid", vars) && isDefined("$randomInt(1,9)", vars) && isDefined("?who", vars))
  assert.ok(!isDefined("$nope", vars))
  assert.equal(describeReference("$guid", vars).kind, "dynamic")
  assert.ok(suggestNames(vars, "$ran").includes("$randomEmail"))
  assert.ok(!suggestNames(vars, "ba").some((name) => name.startsWith("$")))
})

test("secret rows are masked using scope details", () => {
  const scoped = new Map([["db", "pw"]])
  scoped.details = new Map([["db", { secret: true, source: "environment" }]])
  const info = describeReference("db", scoped)
  assert.equal(info.shown, "•".repeat(8))
  assert.equal(info.source, "Environment")
})
