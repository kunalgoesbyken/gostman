import { callAt, prefixLength, sourceIndexOf, trackOf } from './callTracks'

function laneOf(entry, order, keepsTime, keepsOutcome) {
  const track = trackOf(entry)
  const allowed = Uint8Array.from(track.samples, (call) => (keepsOutcome(entry, call) ? 1 : 0))
  const end = prefixLength(track.length, (position) => keepsTime(track.times[position]))
  return { entry, order, track, allowed, end, keepsAll: allowed.every(Boolean) }
}

function nextAllowed(lane, from) {
  const { outcomes } = lane.track
  for (let position = from; position < lane.end; position += 1) if (lane.allowed[outcomes[position]]) return position
  return lane.end
}

function countAllowed(lane, start, stop) {
  const from = Math.min(start, lane.end)
  const to = Math.min(stop, lane.end)
  if (lane.keepsAll) return to - from
  const { outcomes } = lane.track
  let count = 0
  for (let position = from; position < to; position += 1) count += lane.allowed[outcomes[position]]
  return count
}

function countInWindow(lane, from, until) {
  const { times, length } = lane.track
  const start = prefixLength(length, (position) => times[position] >= until)
  const stop = prefixLength(length, (position) => times[position] >= from)
  return countAllowed(lane, start, stop)
}

function isNewer(first, second) {
  const firstTime = first.lane.track.times[first.position]
  const secondTime = second.lane.track.times[second.position]
  return firstTime > secondTime || (firstTime === secondTime && first.lane.order < second.lane.order)
}

function siftDown(heap, from) {
  let index = from
  for (;;) {
    const left = 2 * index + 1
    const right = left + 1
    let newest = index
    if (left < heap.length && isNewer(heap[left], heap[newest])) newest = left
    if (right < heap.length && isNewer(heap[right], heap[newest])) newest = right
    if (newest === index) return
    ;[heap[index], heap[newest]] = [heap[newest], heap[index]]
    index = newest
  }
}

function heapOf(lanes) {
  const heap = lanes.map((lane) => ({ lane, position: nextAllowed(lane, 0) })).filter(({ lane, position }) => position < lane.end)
  for (let index = (heap.length >> 1) - 1; index >= 0; index -= 1) siftDown(heap, index)
  return heap
}

function advance(heap) {
  const cursor = heap[0]
  cursor.position = nextAllowed(cursor.lane, cursor.position + 1)
  if (cursor.position >= cursor.lane.end) {
    const last = heap.pop()
    if (heap.length > 0) heap[0] = last
  }
  siftDown(heap, 0)
}

function rowIds() {
  const seen = new Map()
  let time = Number.NaN
  return (at, atTime) => {
    if (atTime !== time) {
      time = atTime
      seen.clear()
    }
    const earlier = seen.get(at) ?? 0
    seen.set(at, earlier + 1)
    return earlier === 0 ? at : `${at}#${earlier}`
  }
}

function rowsOf(lanes, limit) {
  const heap = heapOf(lanes)
  const idOf = rowIds()
  const rows = []
  while (rows.length < limit && heap.length > 0) {
    const { lane, position } = heap[0]
    const call = callAt(lane.track, position)
    rows.push({ id: idOf(call.at, lane.track.times[position]), index: sourceIndexOf(lane.track, position), timestamp: call.at, entry: lane.entry, call })
    advance(heap)
  }
  return rows
}

export function mergeCalls(entries, keepsTime, keepsOutcome) {
  const lanes = entries.map((entry, order) => laneOf(entry, order, keepsTime, keepsOutcome))
  const countCalls = (from, until) => lanes.reduce((total, lane) => total + countInWindow(lane, from, until), 0)
  return {
    count: countCalls(-Infinity, Infinity),
    countCalls,
    rows: (limit) => rowsOf(lanes, limit),
  }
}
