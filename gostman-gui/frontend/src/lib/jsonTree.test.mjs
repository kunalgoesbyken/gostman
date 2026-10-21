import assert from "node:assert/strict"
import { test } from "node:test"
import { trimTree } from "./jsonTree.js"

test("small documents pass through unchanged", () => {
  const value = { a: [1, 2, { b: null }], c: "x" }
  assert.deepEqual(trimTree(value), { value, omitted: 0 })
})

test("long lists are cut with a marker", () => {
  const { value, omitted } = trimTree(Array.from({ length: 10 }, (_, i) => i), 3, 100)
  assert.deepEqual(value, [0, 1, 2, "7 more items not shown"])
  assert.equal(omitted, 7)
})

test("wide objects are cut with a marker key", () => {
  const { value, omitted } = trimTree({ a: 1, b: 2, c: 3 }, 2, 100)
  assert.deepEqual(value, { a: 1, b: 2, "…": "1 more keys not shown" })
  assert.equal(omitted, 1)
})

test("the node budget bounds the whole tree", () => {
  const rows = Array.from({ length: 50 }, () => Array.from({ length: 50 }, (_, i) => i))
  const { value, omitted } = trimTree(rows, 50, 120)
  const count = (node) => (Array.isArray(node) ? node.reduce((total, item) => total + 1 + count(item), 0) : 0)
  assert.ok(count(value) <= 120 + 50 + 1)
  assert.ok(omitted > 0)
})
