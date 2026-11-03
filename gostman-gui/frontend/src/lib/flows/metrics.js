import { indexSteps, loopsAround, normalizeFlow } from './model'

export const emptyMeter = () => ({ sends: 0, bytesSent: 0, bytesReceived: 0, steps: {}, passes: {}, names: {} })

function tally(steps, id, ms) {
  const known = steps[id]
  const counted = known
    ? { count: known.count + 1, totalMs: known.totalMs + ms, minMs: Math.min(known.minMs, ms), maxMs: Math.max(known.maxMs, ms), lastMs: ms }
    : { count: 1, totalMs: ms, minMs: ms, maxMs: ms, lastMs: ms }
  return { ...steps, [id]: counted }
}

const isContainer = (index, id) => Array.isArray(index.get(id)?.step.steps)

const isPass = (index, event) => Number.isInteger(event.index) && isContainer(index, event.step)

function closePass(meter, id) {
  if (!Object.hasOwn(meter.passes, id)) return meter
  const passes = { ...meter.passes }
  delete passes[id]
  return { ...meter, steps: tally(meter.steps, id, meter.passes[id]), passes }
}

function meterEvent(meter, index, event) {
  const named = { ...meter, names: { ...meter.names, [event.step]: { title: event.title, kind: event.kind } } }
  if (!isPass(index, event)) return named
  const closed = closePass(named, event.step)
  return { ...closed, passes: { ...closed.passes, [event.step]: 0 } }
}

export const meterEvents = (meter, index, events) => events.reduce((current, event) => meterEvent(current, index, event), meter)

function addToPasses(passes, index, id, ms) {
  const open = loopsAround(index, id).filter((loop) => Object.hasOwn(passes, loop))
  return open.reduce((current, loop) => ({ ...current, [loop]: current[loop] + ms }), passes)
}

const isTimedStep = (index, id) => index.has(id) && !isContainer(index, id)

export function meterTiming(meter, index, { step, ms, sent = 0, received = 0, send = false }) {
  const measured = Math.max(Math.round(ms), 0)
  return {
    ...meter,
    sends: meter.sends + (send ? 1 : 0),
    bytesSent: meter.bytesSent + sent,
    bytesReceived: meter.bytesReceived + received,
    steps: isTimedStep(index, step) ? tally(meter.steps, step, measured) : meter.steps,
    passes: addToPasses(meter.passes, index, step, measured),
  }
}

const reported = (meter, id, { count, totalMs, minMs, maxMs }) => ({ ...meter.names[id], count, totalMs, minMs, maxMs })

export function finishMeter(meter, totalMs) {
  const closed = Object.keys(meter.passes).reduce(closePass, meter)
  const steps = Object.fromEntries(Object.entries(closed.steps).map(([id, counted]) => [id, reported(closed, id, counted)]))
  return { totalMs: Math.max(Math.round(totalMs), 0), sends: closed.sends, bytesSent: closed.bytesSent, bytesReceived: closed.bytesReceived, steps }
}

const meterMoment = (index) => (meter, moment) => (moment.events ? meterEvents(meter, index, moment.events) : meterTiming(meter, index, moment))

export const stepIndexOf = (flow) => indexSteps(normalizeFlow(flow).steps)

export const flowMetrics = (flow, timeline, totalMs) => finishMeter((timeline || []).reduce(meterMoment(stepIndexOf(flow)), emptyMeter()), totalMs)
