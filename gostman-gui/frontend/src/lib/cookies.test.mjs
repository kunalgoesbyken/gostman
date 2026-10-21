import assert from "node:assert/strict"
import { test } from "node:test"
import { MAX_STORED_COOKIES, mergeCookies } from "./cookies.js"

const cookie = (name) => ({ name, value: "v", domain: "a.test", path: "/", expires: "", expired: false })

test("a cookie with the same identity is replaced", () => {
  const merged = mergeCookies([{ ...cookie("a"), value: "old" }], [cookie("a")])
  assert.deepEqual(merged.map((entry) => entry.value), ["v"])
})

test("the jar keeps only the newest cookies once it is full", () => {
  const stored = Array.from({ length: MAX_STORED_COOKIES }, (_, i) => cookie("c" + i))
  const merged = mergeCookies(stored, [cookie("fresh")])
  assert.equal(merged.length, MAX_STORED_COOKIES)
  assert.equal(merged.at(-1).name, "fresh")
  assert.equal(merged[0].name, "c1")
})
