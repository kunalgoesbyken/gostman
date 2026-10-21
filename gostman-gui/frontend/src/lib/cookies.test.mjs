import assert from "node:assert/strict"
import { test } from "node:test"
import { MAX_COOKIES_PER_DOMAIN, MAX_STORED_COOKIES, mergeCookies } from "./cookies.js"

const cookie = (name) => ({ name, value: "v", domain: "a.test", path: "/", expires: "", expired: false })

test("a cookie with the same identity is replaced", () => {
  const merged = mergeCookies([{ ...cookie("a"), value: "old" }], [cookie("a")])
  assert.deepEqual(merged.map((entry) => entry.value), ["v"])
})

test("the jar keeps only the newest cookies once it is full", () => {
  const stored = Array.from({ length: MAX_STORED_COOKIES }, (_, i) => ({ ...cookie("c" + i), domain: "d" + i + ".test" }))
  const merged = mergeCookies(stored, [cookie("fresh")])
  assert.equal(merged.length, MAX_STORED_COOKIES)
  assert.equal(merged.at(-1).name, "fresh")
  assert.equal(merged[0].name, "c1")
})

test("one domain flooding the jar cannot evict another domain", () => {
  const victim = { ...cookie("session"), domain: "bank.test" }
  const flood = Array.from({ length: MAX_STORED_COOKIES }, (_, i) => ({ ...cookie("f" + i), domain: "evil.test" }))
  const merged = mergeCookies([victim], flood)
  assert.ok(merged.some((entry) => entry.domain === "bank.test"))
  assert.equal(merged.filter((entry) => entry.domain === "evil.test").length, MAX_COOKIES_PER_DOMAIN)
})
