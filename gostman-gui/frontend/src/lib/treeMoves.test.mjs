import assert from "node:assert/strict"
import { test } from "node:test"
import { buildCollectionTree, requestsIn, foldersIn, ROOT_ID, ROW_FOLDER, ROW_REQUEST } from "./collectionTree.js"
import { PLACE_BEFORE, PLACE_INSIDE } from "./dropPlace.js"
import { STEP_DOWN, STEP_UP, planClone, planMove, planStep } from "./treeMoves.js"

const folder = (id, parentId = "", sortOrder = 0) => ({ id, name: id, parentId, sortOrder })
const request = (id, folderId = "", sortOrder = 0) => ({ id, name: id, folderId, sortOrder })

const apply = (state, patches) => {
  const patch = (items, list) => items.map((item) => ({ ...item, ...(list.find((entry) => entry.id === item.id) || {}) }))
  return { folders: patch(state.folders, patches[ROW_FOLDER]), requests: patch(state.requests, patches[ROW_REQUEST]) }
}

const order = (state, containerId, kind = ROW_REQUEST) => {
  const tree = buildCollectionTree(state.folders, state.requests)
  return (kind === ROW_REQUEST ? requestsIn : foldersIn)(tree, containerId).map((item) => item.id)
}

const sample = () => ({
  folders: [folder("a", "", 1), folder("b", "", 2), folder("c", "a", 1)],
  requests: [request("r1", "", 1), request("r2", "", 2), request("r3", "", 3), request("r4", "a", 1)],
})

test("items without an order sort after ordered ones and keep their array order", () => {
  const state = { folders: [], requests: [request("x"), request("y", "", 2), request("z"), request("w", "", 1)] }
  assert.deepEqual(order(state, ROOT_ID), ["w", "y", "x", "z"])
})

test("moving before a sibling renumbers the siblings", () => {
  const state = sample()
  const plan = planMove(state, { kind: ROW_REQUEST, id: "r3" }, { kind: ROW_REQUEST, id: "r1", place: PLACE_BEFORE })
  assert.deepEqual(order(apply(state, plan.patches), ROOT_ID), ["r3", "r1", "r2"])
})

test("moving into a folder appends and undo restores the original order", () => {
  const state = sample()
  const plan = planMove(state, { kind: ROW_REQUEST, id: "r1" }, { kind: ROW_FOLDER, id: "a", place: PLACE_INSIDE })
  const moved = apply(state, plan.patches)
  assert.deepEqual(order(moved, "a"), ["r4", "r1"])
  assert.deepEqual(order(moved, ROOT_ID), ["r2", "r3"])
  const restored = apply(moved, plan.undo)
  assert.deepEqual(order(restored, "a"), ["r4"])
  assert.deepEqual(order(restored, ROOT_ID), ["r1", "r2", "r3"])
})

test("a folder cannot move into itself or its descendants", () => {
  const state = sample()
  assert.equal(planMove(state, { kind: ROW_FOLDER, id: "a" }, { kind: ROW_FOLDER, id: "a", place: PLACE_INSIDE }), null)
  assert.equal(planMove(state, { kind: ROW_FOLDER, id: "a" }, { kind: ROW_FOLDER, id: "c", place: PLACE_INSIDE }), null)
})

test("dropping on the item's own position changes nothing", () => {
  const state = sample()
  assert.equal(planMove(state, { kind: ROW_REQUEST, id: "r1" }, { kind: ROW_REQUEST, id: "r2", place: PLACE_BEFORE }), null)
})

test("unknown ids are ignored", () => {
  const state = sample()
  assert.equal(planMove(state, { kind: ROW_REQUEST, id: "missing" }, { kind: ROW_FOLDER, id: "a", place: PLACE_INSIDE }), null)
  assert.equal(planMove(state, { kind: ROW_REQUEST, id: "r1" }, { kind: ROW_FOLDER, id: "missing", place: PLACE_INSIDE }), null)
})

test("steps swap with the neighbour and stop at the ends", () => {
  const state = sample()
  const down = planStep(state, { kind: ROW_REQUEST, id: "r1" }, STEP_DOWN)
  assert.deepEqual(order(apply(state, down.patches), ROOT_ID), ["r2", "r1", "r3"])
  assert.equal(planStep(state, { kind: ROW_REQUEST, id: "r1" }, STEP_UP), null)
  assert.equal(planStep(state, { kind: ROW_FOLDER, id: "b" }, STEP_DOWN), null)
})

test("moving a folder carries its descendants and keeps their ids", () => {
  const state = sample()
  const plan = planMove(state, { kind: ROW_FOLDER, id: "a" }, { kind: ROW_FOLDER, id: "b", place: PLACE_INSIDE })
  const moved = apply(state, plan.patches)
  assert.deepEqual(order(moved, "b", ROW_FOLDER), ["a"])
  assert.deepEqual(order(moved, "a", ROW_FOLDER), ["c"])
  assert.deepEqual(order(moved, "a"), ["r4"])
})

let counter = 0
const freshId = () => `new-${++counter}`

test("cloning a folder copies the subtree with fresh ids next to the original", () => {
  const state = sample()
  const plan = planClone(state, { kind: ROW_FOLDER, id: "a" }, { containerId: ROOT_ID, anchorId: "a" }, freshId)
  assert.equal(plan.created.folders.length, 2)
  assert.equal(plan.created.requests.length, 1)
  const taken = new Set([...state.folders, ...state.requests].map((item) => item.id))
  for (const item of [...plan.created.folders, ...plan.created.requests]) assert.ok(!taken.has(item.id))
  const [copy, child] = plan.created.folders
  assert.equal(copy.name, "a copy")
  assert.equal(child.parentId, copy.id)
  assert.equal(plan.created.requests[0].folderId, copy.id)
  const merged = apply({ folders: [...state.folders, ...plan.created.folders], requests: state.requests }, plan.patches)
  assert.deepEqual(order(merged, ROOT_ID, ROW_FOLDER), ["a", copy.id, "b"])
})

test("cloning a request into a folder appends it and avoids the name in use", () => {
  const state = sample()
  const plan = planClone(state, { kind: ROW_REQUEST, id: "r4" }, { containerId: "a", anchorId: "" }, freshId)
  assert.equal(plan.root.name, "r4 copy")
  assert.equal(plan.root.folderId, "a")
  assert.equal(plan.root.sortOrder, 2)
})
