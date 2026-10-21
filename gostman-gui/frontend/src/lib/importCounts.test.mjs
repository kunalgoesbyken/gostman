import assert from "node:assert/strict"
import { test } from "node:test"
import { describeCounts } from "./importCounts.js"

test("requests and folders are always named", () => {
  assert.equal(describeCounts({ requests: 4, folders: 1, environments: 0, variables: 0, folderSettings: 0 }), "4 requests and 1 folder")
})

test("environments, variables and folder settings are included when present", () => {
  const counts = { requests: 4, folders: 1, environments: 2, variables: 3, folderSettings: 1 }
  assert.equal(describeCounts(counts), "4 requests, 1 folder, 2 environments, 3 variables and 1 folder setting")
})

test("singular forms", () => {
  const counts = { requests: 1, folders: 0, environments: 1, variables: 1, folderSettings: 0 }
  assert.equal(describeCounts(counts), "1 request, 0 folders, 1 environment and 1 variable")
})
