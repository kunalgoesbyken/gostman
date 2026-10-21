import assert from "node:assert/strict"
import { test } from "node:test"
import { DATA_FILE_ERROR, iterationCount, MAX_ITERATIONS, parseDataFile } from "./runData.js"

test("iteration count is capped", () => {
  assert.equal(iterationCount([], 100000000), MAX_ITERATIONS)
  assert.equal(iterationCount([], 5), 5)
  assert.equal(iterationCount([], 0), 1)
  assert.equal(iterationCount([{ a: "1" }, { a: "2" }], 100000000), 2)
})

test("a data file over the limit is refused", () => {
  const lines = ["a", ...Array.from({ length: MAX_ITERATIONS + 1 }, (_, index) => String(index))]
  assert.throws(() => parseDataFile("big.csv", lines.join("\n")), { message: DATA_FILE_ERROR.tooManyRows })
  const allowed = ["a", ...Array.from({ length: MAX_ITERATIONS }, (_, index) => String(index))]
  assert.equal(parseDataFile("ok.csv", allowed.join("\n")).length, MAX_ITERATIONS)
})
