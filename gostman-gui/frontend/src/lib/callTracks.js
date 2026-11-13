import { callsOf, normalizeCall, outcomeKeyOf } from './callHistory'

const tracks = new WeakMap()

const timeOfRaw = (call) => (typeof call?.at === 'string' ? Date.parse(call.at) : Number.NaN)

function timesOf(calls) {
  const times = new Float64Array(calls.length)
  for (let index = 0; index < calls.length; index += 1) times[index] = timeOfRaw(calls[index])
  return times
}

function sourceOf(entry) {
  const calls = Array.isArray(entry?.calls) ? entry.calls : []
  const times = timesOf(calls)
  if (calls.length > 0 && !times.includes(Number.NaN)) return { calls, times }
  const normalized = callsOf(entry)
  return { calls: normalized, times: timesOf(normalized) }
}

const isNewestFirst = (times) => times.every((time, index) => index === 0 || time <= times[index - 1])

const newestFirstOrder = (times) => Int32Array.from(times.keys()).sort((first, second) => times[second] - times[first] || first - second)

function outcomesOf(calls, order) {
  const ids = new Map()
  const samples = []
  const outcomes = new Uint32Array(calls.length)
  for (let position = 0; position < calls.length; position += 1) {
    const call = calls[order ? order[position] : position]
    const key = outcomeKeyOf(call)
    if (!ids.has(key)) {
      ids.set(key, samples.length)
      samples.push(normalizeCall(call))
    }
    outcomes[position] = ids.get(key)
  }
  return { outcomes, samples }
}

function buildTrack(entry) {
  const { calls, times } = sourceOf(entry)
  const order = isNewestFirst(times) ? null : newestFirstOrder(times)
  const { outcomes, samples } = outcomesOf(calls, order)
  return { calls, order, times: order ? Float64Array.from(order, (index) => times[index]) : times, outcomes, samples, length: calls.length }
}

export function trackOf(entry) {
  if (!tracks.has(entry)) tracks.set(entry, buildTrack(entry))
  return tracks.get(entry)
}

export const sourceIndexOf = (track, position) => (track.order ? track.order[position] : position)

export const callAt = (track, position) => normalizeCall(track.calls[sourceIndexOf(track, position)])

export function prefixLength(length, holds) {
  let low = 0
  let high = length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (holds(middle)) low = middle + 1
    else high = middle
  }
  return low
}
