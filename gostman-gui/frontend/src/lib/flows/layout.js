import { CONTAINER_KINDS, END_TARGET, STEP_END, STEP_IF, STEP_SWITCH, allStepIds, indexSteps, loopsAround, routesOf } from './model'

const NODE_WIDTH = 248
export const END_NODE = '#end'
export const START_NODE = '#start'

const FOLLOW = ''
const GAP = 44
const TIGHT_GAP = 16
const COLUMN_GAP = 32
const COLUMN_MIN = 168
const FORK_DROP = 18
const LABEL_ZONE = 26
const JOIN_DROP = 18
const FRAME_PAD = 28
const BODY_INSET = 10
const FRAME_FOOT = 10
const SIDE_REACH = 60
const PILL_WIDTH = 64
const PILL_HEIGHT = 24
const EMPTY_WIDTH = 160
const MARGIN = 40
const LANE_START = 28
const LANE_GAP = 14
const LANE_LABEL = 72
const ENTRY_OFFSET = 14
const CORNER = 6
const SOURCE_SHARE = { then: 0.36, next: 0.5, onFailure: 0.72, else: 0.72 }
const CASE_SHARE = 0.5

const BRANCHING_KINDS = [STEP_IF, STEP_SWITCH]

const isOut = (step, field, target) => {
  if (BRANCHING_KINDS.includes(step.kind)) return field !== 'next'
  return field === 'next' || target !== ''
}

function outsOf(step) {
  if (step.kind === STEP_END) return []
  return routesOf(step)
    .filter(([field, target]) => isOut(step, field, target))
    .map(([field, target]) => ({ field, target: target || step.next || FOLLOW, implicit: !target && !step.next }))
}

function resolveOut(out, list, position) {
  if (out.target === FOLLOW) return { ...out, index: position + 1 }
  if (out.target === END_TARGET) return { ...out, end: true }
  const at = list.findIndex((step) => step.id === out.target)
  return at > position ? { ...out, index: at } : { ...out, away: out.target }
}

const unique = (values) => [...new Set(values)]

const targetIdOf = (list, index) => (index < list.length ? list[index].id : END_NODE)

const sameExit = (one, other) => one.source === other.source && one.field === other.field && one.index === other.index

function detachJoin(branch, exit) {
  branch.joining.filter((inner) => sameExit(inner, exit)).forEach(detach)
  branch.joining = branch.joining.filter((inner) => !sameExit(inner, exit))
  branch.exits = branch.exits.filter((outer) => !sameExit(outer, exit))
}

function detachColumn(column, exit) {
  column.exits = column.exits.filter((inner) => !sameExit(inner, exit))
  if (column.exits.length === 0) column.branch.columns = column.branch.columns.filter((other) => other !== column)
}

function detach(exit) {
  if (exit.item?.joining) detachJoin(exit.item, exit)
  if (exit.item?.branch) detachColumn(exit.item, exit)
}

function skipEdge(ctx, list, exit) {
  detach(exit)
  if (exit.index < list.length) ctx.edges.push({ from: exit.source, to: list[exit.index].id, field: exit.field })
}

function nodeBlock(ctx, step, list, position, parent) {
  const block = { type: 'node', step, position, parent, width: NODE_WIDTH, height: ctx.heightOf(step) }
  if (!CONTAINER_KINDS.includes(step.kind)) return block
  const body = buildSeq(ctx, step.steps, step.id, 0, step.steps.length, { top: true, bottom: true, boxed: true })
  return { ...block, type: 'container', body, nodeHeight: block.height }
}

function exitsOf(block, outs) {
  return outs.filter((out) => out.index !== undefined).map((out) => ({ source: block.step.id, field: out.field, index: out.index, item: block }))
}

function closingSlot(items, stop, list) {
  const last = items[items.length - 1]
  if (!last || (last.type !== 'node' && last.type !== 'container')) return false
  return outsOf(last.step).some((out) => out.implicit && out.field !== 'onFailure') && last.position + 1 === stop && stop <= list.length
}

function buildSeq(ctx, list, parent, from, stop, options = {}) {
  const items = []
  let pending = []
  let position = from
  while (position < stop) {
    const arriving = pending.filter((exit) => exit.index === position)
    pending.filter((exit) => exit.index !== position).forEach((exit) => skipEdge(ctx, list, exit))
    const step = list[position]
    const block = nodeBlock(ctx, step, list, position, parent)
    block.arriving = arriving
    items.push(block)
    const outs = outsOf(step).map((out) => resolveOut(out, list, position))
    outs.filter((out) => out.away).forEach((out) => {
      if (ctx.ids.has(out.away)) ctx.edges.push({ from: step.id, to: out.away, field: out.field })
    })
    const placed = branchOut(ctx, list, parent, block, outs, stop)
    items.push(...placed.items)
    pending = placed.exits
    position = placed.resume
  }
  return {
    type: 'seq',
    list,
    parent,
    from,
    stop,
    items,
    exits: pending,
    top: Boolean(options.top),
    bottom: Boolean(options.bottom) || closingSlot(items, stop, list),
    boxed: Boolean(options.boxed),
  }
}

function terminalBlock(ctx, source, field) {
  return { type: 'terminal', key: `${source}:${field}:${ctx.terminals++}`, width: PILL_WIDTH, height: PILL_HEIGHT, source, field }
}

function branchOut(ctx, list, parent, block, outs, stop) {
  const forward = outs.filter((out) => out.index !== undefined)
  const ends = outs.filter((out) => out.end)
  const starts = unique(forward.map((out) => out.index))
  const resume = block.position + 1
  if (ends.length === 0 && starts.length <= 1) return { items: [], exits: exitsOf(block, forward), resume }
  if (starts.length === 1) {
    block.sideEnds = ends.map((out) => terminalBlock(ctx, block.step.id, out.field))
    return { items: [], exits: exitsOf(block, forward), resume }
  }
  if (starts.length === 0 && ends.length === 1) return { items: [terminalBlock(ctx, block.step.id, ends[0].field)], exits: [], resume }
  const branch = buildBranch(ctx, list, parent, block, forward, ends, stop)
  if (branch) return { items: [branch], exits: branch.exits, resume: branch.resume }
  ends.forEach((out) => ctx.endNotes.push({ id: block.step.id, field: out.field }))
  return { items: [], exits: exitsOf(block, forward), resume }
}

function joinIndex(early, starts, lastStart, stop) {
  const candidates = [
    ...early.flatMap((seq) => seq.exits.map((exit) => exit.index)),
    ...starts.filter((start) => start === stop),
  ].filter((index) => index >= lastStart && index <= stop)
  return candidates.length > 0 ? Math.min(...candidates) : null
}

function groupOuts(outs) {
  const groups = []
  outs.forEach((out) => {
    const key = out.end ? `end:${out.field}` : `index:${out.index}`
    const group = groups.find((candidate) => candidate.key === key)
    if (group) group.outs.push(out)
    else groups.push({ key, index: out.index, end: Boolean(out.end), outs: [out] })
  })
  return groups
}

function buildBranch(ctx, list, parent, block, forward, ends, stop) {
  const starts = unique(forward.map((out) => out.index)).sort((first, second) => first - second)
  const inside = starts.filter((start) => start < stop)
  if (inside.length > 0 && inside[0] !== block.position + 1) return null
  if (inside.length === 0 && ends.length === 0) return null
  const lastStart = inside.length > 0 ? inside[inside.length - 1] : stop
  const early = inside.slice(0, -1).map((start, column) => buildSeq(ctx, list, parent, start, inside[column + 1], {}))
  const join = joinIndex(early, starts, lastStart, stop)
  const seqs = new Map(inside.slice(0, -1).map((start, column) => [start, early[column]]))
  if (inside.length > 0 && lastStart !== join) seqs.set(lastStart, buildSeq(ctx, list, parent, lastStart, join ?? stop, {}))
  const resume = join ?? (inside.length > 0 ? stop : block.position + 1)
  const branch = { type: 'branch', step: block.step, list, join, columns: [], exits: [], resume }
  groupOuts([...forward, ...ends]).forEach((group) => addColumn(ctx, list, branch, group, seqs))
  branch.exits = branchExits(ctx, list, branch)
  return branch
}

function addColumn(ctx, list, branch, group, seqs) {
  const fields = group.outs.map((out) => out.field)
  const source = branch.step.id
  if (group.end) {
    branch.columns.push({ fields, terminal: terminalBlock(ctx, source, fields[0]), to: END_NODE })
    return
  }
  const seq = seqs.get(group.index)
  if (seq) {
    seq.top = group.outs.some((out) => out.implicit)
    branch.columns.push({ fields, seq, to: list[group.index].id })
    return
  }
  if (branch.join !== null && group.index > branch.join) {
    group.outs.forEach((out) => skipEdge(ctx, list, { source, field: out.field, index: group.index }))
    return
  }
  const column = { fields, to: targetIdOf(list, group.index), branch }
  column.exits = group.outs.map((out) => ({ source, field: out.field, index: group.index, item: column }))
  branch.columns.push(column)
}

function branchExits(ctx, list, branch) {
  const leaving = branch.columns.flatMap((column) => (column.seq ? column.seq.exits : column.exits || []))
  const continues = (exit) => (branch.join === null ? exit.index >= branch.resume : exit.index === branch.join)
  leaving.filter((exit) => !continues(exit)).forEach((exit) => skipEdge(ctx, list, exit))
  const onward = leaving.filter(continues)
  if (branch.join === null) return onward
  branch.joining = onward
  return onward.map((exit) => ({ ...exit, item: branch }))
}

const ITEM_GAPS = { branch: 0 }

const gapBefore = (item) => ITEM_GAPS[item.type] ?? GAP

function measureSeq(seq) {
  seq.items.forEach(measure)
  const topGap = seq.top || seq.boxed ? GAP : TIGHT_GAP
  const inner = seq.items.reduce((sum, item, at) => sum + item.height + (at > 0 ? gapBefore(item) : 0), 0)
  seq.topGap = seq.items.length > 0 ? topGap : 0
  seq.bottomGap = seq.bottom ? GAP : 0
  seq.width = Math.max(seq.items.length === 0 ? EMPTY_WIDTH : 0, ...seq.items.map((item) => item.width))
  seq.height = seq.items.length === 0 ? GAP : seq.topGap + inner + seq.bottomGap
}

function measureContainer(item) {
  measureSeq(item.body)
  const frameWidth = item.body.width + FRAME_PAD * 2
  item.frame = { width: Math.max(NODE_WIDTH + FRAME_PAD * 2, frameWidth), height: BODY_INSET + item.body.height + FRAME_FOOT }
  item.width = item.frame.width
  item.height = item.nodeHeight + GAP / 2 + item.frame.height
}

function columnWidth(column) {
  if (column.seq) return Math.max(COLUMN_MIN, column.seq.width)
  return COLUMN_MIN
}

function columnHeight(column) {
  if (column.seq) return column.seq.height
  if (column.terminal) return TIGHT_GAP + column.terminal.height
  return TIGHT_GAP
}

function measureBranch(branch) {
  branch.columns.forEach((column) => {
    if (column.seq) measureSeq(column.seq)
    column.width = columnWidth(column)
    column.height = columnHeight(column)
  })
  const reach = Math.max(0, ...branch.columns.map((column) => column.height))
  const closes = branch.exits.length > 0
  branch.columnTop = FORK_DROP + LABEL_ZONE
  branch.width = branch.columns.reduce((sum, column) => sum + column.width, 0) + COLUMN_GAP * Math.max(0, branch.columns.length - 1)
  branch.height = branch.columnTop + reach + (closes ? JOIN_DROP : 0)
}

function measureNode(item) {
  if (item.sideEnds) item.width = NODE_WIDTH + (SIDE_REACH + PILL_WIDTH) * 2
}

const MEASURES = {
  node: measureNode,
  terminal: () => {},
  container: measureContainer,
  branch: measureBranch,
  seq: measureSeq,
}

function measure(item) {
  MEASURES[item.type](item)
}

const centreOf = (item) => item.x + item.width / 2

function placeSeq(seq, x, y) {
  seq.x = x
  seq.y = y
  const centre = x + seq.width / 2
  let top = y + seq.topGap
  seq.items.forEach((item, at) => {
    if (at > 0) top += gapBefore(item)
    place(item, centre - item.width / 2, top)
    top += item.height
  })
  seq.contentBottom = top
}

function placeContainer(item, x, y) {
  item.x = x
  item.y = y
  item.nodeX = centreOf(item) - NODE_WIDTH / 2
  item.frame.x = x
  item.frame.y = y + item.nodeHeight + GAP / 2
  placeSeq(item.body, centreOf(item) - item.body.width / 2, item.frame.y + BODY_INSET)
}

function placeBranch(branch, x, y) {
  branch.x = x
  branch.y = y
  let left = x
  branch.columns.forEach((column) => {
    column.x = left
    column.y = y + branch.columnTop
    const centre = left + column.width / 2
    if (column.seq) placeSeq(column.seq, centre - column.seq.width / 2, column.y)
    if (column.terminal) place(column.terminal, centre - column.terminal.width / 2, column.y + TIGHT_GAP)
    left += column.width + COLUMN_GAP
  })
}

function placeLeaf(item, x, y) {
  item.x = x
  item.y = y
}

const PLACES = { node: placeLeaf, terminal: placeLeaf, container: placeContainer, branch: placeBranch }

function place(item, x, y) {
  PLACES[item.type](item, x, y)
}

function anchorOf(item) {
  if (item.fields) return { x: centreOf(item), y: item.y }
  return { x: centreOf(item), y: item.y + item.height }
}

function createDrawing() {
  return { nodes: [], frames: [], terminals: [], wires: [], labels: [], slots: [], loops: [], retries: [] }
}

const pairsTo = (sources, to) => sources.map((source) => [source, to])

function wire(drawing, points, pairs, idle = false) {
  drawing.wires.push({ points, pairs, idle })
}

function firstIdOf(seq) {
  const first = seq.items[0]
  return first && first.step ? first.step.id : ''
}

function addSlot(drawing, seq, x, y, position) {
  drawing.slots.push({ x, y, parent: seq.parent, position, first: seq.parent === '' && seq.list.length === 0 })
}

function drawSeq(drawing, seq, entry) {
  const centre = seq.x + seq.width / 2
  const first = seq.items[0]
  if (!first) {
    addSlot(drawing, seq, centre, seq.y + GAP / 2, seq.from)
    return
  }
  if (seq.topGap > 0) {
    wire(drawing, [{ x: centre, y: seq.y }, { x: centre, y: first.y }], entry.pairs, entry.idle)
    if (seq.top) addSlot(drawing, seq, centre, (seq.y + first.y) / 2, seq.from)
  }
  seq.items.forEach((item, at) => {
    drawItem(drawing, item)
    const next = seq.items[at + 1]
    if (next) drawLink(drawing, seq, item, next)
  })
  if (seq.bottom) {
    const last = seq.items[seq.items.length - 1]
    const bottom = last.y + last.height
    addSlot(drawing, seq, centre, bottom + GAP / 2, seq.stop)
  }
}

function drawLink(drawing, seq, item, next) {
  if (next.type === 'branch' || (item.type === 'branch' && item.join === null)) return
  const from = anchorOf(item)
  const to = { x: centreOf(next), y: next.y }
  const sources = (next.arriving || []).map((exit) => exit.source)
  const target = next.step ? next.step.id : END_NODE
  const flows = next.type === 'terminal' || sources.length > 0
  wire(drawing, [from, to], next.type === 'terminal' ? [[next.source, END_NODE]] : pairsTo(sources, target), !flows)
  if (item.type !== 'terminal' && item.type !== 'branch' && next.step) addSlot(drawing, seq, to.x, (from.y + to.y) / 2, next.position)
}

function drawNode(drawing, item) {
  const box = { id: item.step.id, x: centreOf(item) - NODE_WIDTH / 2, y: item.y, width: NODE_WIDTH, height: item.height }
  drawing.nodes.push(box)
  if (item.step.retry?.times > 1) drawing.retries.push({ id: box.id, x: box.x, y: box.y, width: 0, height: box.height })
  const sides = item.sideEnds || []
  sides.forEach((terminal, at) => {
    const y = item.y + Math.min(item.height / 2, PILL_HEIGHT / 2 + 6) + at * (PILL_HEIGHT + 8)
    const x = box.x + NODE_WIDTH + SIDE_REACH
    drawing.terminals.push({ key: terminal.key, source: item.step.id, x, y: y - PILL_HEIGHT / 2, width: PILL_WIDTH, height: PILL_HEIGHT })
    const points = [{ x: box.x + NODE_WIDTH, y }, { x, y }]
    wire(drawing, points, [[item.step.id, END_NODE]])
    drawing.labels.push({ x: box.x + NODE_WIDTH + SIDE_REACH / 2, y, step: item.step.id, fields: [terminal.field], width: SIDE_REACH - 4 })
  })
}

function drawItem(drawing, item) {
  if (item.type === 'node') drawNode(drawing, item)
  if (item.type === 'terminal') drawing.terminals.push({ key: item.key, source: item.source, x: item.x, y: item.y, width: item.width, height: item.height })
  if (item.type === 'container') drawContainer(drawing, item)
  if (item.type === 'branch') drawBranch(drawing, item)
}

function drawContainer(drawing, item) {
  const { frame, body, step } = item
  drawing.nodes.push({ id: step.id, x: item.nodeX, y: item.y, width: NODE_WIDTH, height: item.nodeHeight })
  drawing.frames.push({ id: step.id, kind: step.kind, x: frame.x, y: frame.y, width: frame.width, height: frame.height })
  const centre = centreOf(item)
  const firstId = firstIdOf(body)
  wire(drawing, [{ x: centre, y: item.y + item.nodeHeight }, { x: centre, y: firstId ? body.y : frame.y }], firstId ? [[step.id, firstId]] : [], !firstId)
  drawSeq(drawing, body, { pairs: firstId ? [[step.id, firstId]] : [], idle: !firstId })
  drawLoopBack(drawing, item)
}

function drawLoopBack(drawing, item) {
  const { frame, body, step } = item
  if (body.exits.length === 0) return
  const centre = body.x + body.width / 2
  const low = frame.y + frame.height - FRAME_FOOT - 4
  const left = frame.x + FRAME_PAD / 2
  const reentry = body.items[0].y - 8
  body.exits.forEach((exit) => {
    const anchor = anchorOf(exit.item)
    drawing.loops.push({
      points: [anchor, { x: anchor.x, y: low }, { x: left, y: low }, { x: left, y: reentry }, { x: centre, y: reentry }],
      pairs: [[exit.source, step.id]],
    })
  })
}

function drawBranch(drawing, branch) {
  const centre = centreOf(branch)
  const forkY = branch.y + FORK_DROP
  branch.columns.forEach((column) => {
    const columnCentre = column.x + column.width / 2
    const firstId = column.seq ? firstIdOf(column.seq) : column.to
    const pairs = [[branch.step.id, firstId || column.to]]
    wire(drawing, [{ x: centre, y: branch.y }, { x: centre, y: forkY }, { x: columnCentre, y: forkY }, { x: columnCentre, y: column.y }], pairs)
    drawing.labels.push({ x: columnCentre, y: forkY + LABEL_ZONE / 2 + 2, step: branch.step.id, fields: column.fields, width: column.width })
    if (column.seq) drawSeq(drawing, column.seq, { pairs })
    if (column.terminal) {
      wire(drawing, [{ x: columnCentre, y: column.y }, { x: columnCentre, y: column.terminal.y }], pairs)
      drawItem(drawing, column.terminal)
    }
  })
  drawJoin(drawing, branch, centre)
}

function drawJoin(drawing, branch, centre) {
  if (branch.join === null) return
  const bottom = branch.y + branch.height
  const target = targetIdOf(branch.list, branch.join)
  branch.joining.forEach((exit) => {
    const anchor = anchorOf(exit.item)
    wire(drawing, [anchor, { x: anchor.x, y: bottom }, { x: centre, y: bottom }], [[exit.source, target]])
  })
}

function drawRoot(drawing, root, start, end) {
  drawing.terminals.push({ key: START_NODE, x: start.x, y: start.y, width: start.width, height: start.height, start: true })
  const firstId = firstIdOf(root)
  drawSeq(drawing, root, { pairs: firstId ? [[START_NODE, firstId]] : [], idle: !firstId })
  if (!end) return
  drawing.terminals.push({ key: END_NODE, x: end.x, y: end.y, width: end.width, height: end.height, end: true })
  const centre = root.x + root.width / 2
  const lowest = root.contentBottom
  root.exits.forEach((exit) => {
    const anchor = anchorOf(exit.item)
    if (anchor.x !== centre || anchor.y !== lowest) wire(drawing, [anchor, { x: anchor.x, y: lowest }, { x: centre, y: lowest }], [[exit.source, END_NODE]])
  })
  wire(drawing, [{ x: centre, y: lowest }, { x: centre, y: end.y }], pairsTo(root.exits.map((exit) => exit.source), END_NODE))
}

const spansRow = (box, y) => y >= box.y && y <= box.y + box.height

function crossings(boxes, edge, side) {
  const passes = (end, y) => boxes.filter((box) => box !== end && spansRow(box, y) && (side === 'right' ? box.x > end.x : box.x < end.x)).length
  return passes(edge.source, edge.sourceY) + passes(edge.target, edge.targetY)
}

function edgeSide(boxes, edge, centre) {
  const left = crossings(boxes, edge, 'left')
  const right = crossings(boxes, edge, 'right')
  if (left !== right) return left < right ? 'left' : 'right'
  return (edge.source.x + edge.source.width / 2 + edge.target.x + edge.target.width / 2) / 2 < centre - 1 ? 'left' : 'right'
}

const shareOf = (field) => SOURCE_SHARE[field] ?? CASE_SHARE

function routeEdges(drawing, edges, centre) {
  const boxes = new Map([...drawing.nodes, ...drawing.terminals].map((box) => [box.id || box.key, box]))
  const bounds = drawingBounds(drawing)
  const lanes = { left: [], right: [] }
  const obstacles = [...drawing.nodes, ...drawing.terminals]
  return edges
    .map((edge) => ({ ...edge, source: boxes.get(edge.from), target: boxes.get(edge.to) }))
    .filter((edge) => edge.source && edge.target)
    .map((edge) => {
      const sourceY = edge.source.y + edge.source.height * shareOf(edge.field)
      const targetY = edge.target.y + Math.min(ENTRY_OFFSET, edge.target.height / 2)
      const placed = { ...edge, sourceY, targetY, low: Math.min(sourceY, targetY), high: Math.max(sourceY, targetY) }
      return { ...placed, side: edgeSide(obstacles, placed, centre) }
    })
    .sort((first, second) => (first.high - first.low) - (second.high - second.low))
    .map((edge) => {
      const taken = lanes[edge.side]
      let lane = taken.findIndex((spans) => spans.every((other) => other.high + 6 < edge.low || other.low - 6 > edge.high))
      if (lane < 0) lane = taken.push([]) - 1
      taken[lane].push(edge)
      const isRight = edge.side === 'right'
      const x = isRight ? bounds.right + LANE_START + lane * LANE_GAP : bounds.left - LANE_START - lane * LANE_GAP
      const sourceX = isRight ? edge.source.x + edge.source.width : edge.source.x
      const targetX = isRight ? edge.target.x + edge.target.width : edge.target.x
      return {
        from: edge.from,
        to: edge.to,
        field: edge.field,
        side: edge.side,
        points: [{ x: sourceX, y: edge.sourceY }, { x, y: edge.sourceY }, { x, y: edge.targetY }, { x: targetX, y: edge.targetY }],
      }
    })
}

function drawingBounds(drawing) {
  const boxes = [...drawing.nodes, ...drawing.frames, ...drawing.terminals]
  return {
    left: Math.min(...boxes.map((box) => box.x)),
    right: Math.max(...boxes.map((box) => box.x + box.width)),
    top: Math.min(...boxes.map((box) => box.y)),
    bottom: Math.max(...boxes.map((box) => box.y + box.height)),
  }
}

function edgeBounds(edges, bounds) {
  const xs = edges.flatMap((edge) => edge.points.map((point) => point.x))
  const leftLabels = edges.some((edge) => edge.side === 'left') ? LANE_LABEL : 0
  const rightLabels = edges.some((edge) => edge.side === 'right') ? LANE_LABEL : 0
  return {
    left: Math.min(bounds.left, ...xs) - leftLabels,
    right: Math.max(bounds.right, ...xs) + rightLabels,
  }
}

const shiftPoint = (point, dx, dy) => ({ ...point, x: point.x + dx, y: point.y + dy })

const shiftBox = (box, dx, dy) => ({ ...box, x: box.x + dx, y: box.y + dy })

function shifted(drawing, edges, dx, dy) {
  const points = (item) => ({ ...item, points: item.points.map((point) => shiftPoint(point, dx, dy)) })
  return {
    nodes: drawing.nodes.map((box) => shiftBox(box, dx, dy)),
    frames: drawing.frames.map((box) => shiftBox(box, dx, dy)),
    terminals: drawing.terminals.map((box) => shiftBox(box, dx, dy)),
    retries: drawing.retries.map((box) => shiftBox(box, dx, dy)),
    labels: drawing.labels.map((label) => shiftPoint(label, dx, dy)),
    slots: drawing.slots.map((slot) => shiftPoint(slot, dx, dy)),
    wires: drawing.wires.map(points),
    loops: drawing.loops.map(points),
    edges: edges.map(points),
  }
}

export function layoutFlow(steps, { heightOf }) {
  const ctx = { heightOf, ids: new Set(allStepIds(steps)), edges: [], endNotes: [], terminals: 0 }
  const root = buildSeq(ctx, steps, '', 0, steps.length, { top: true, bottom: true })
  measureSeq(root)
  const start = { width: PILL_WIDTH, height: PILL_HEIGHT }
  const reachesEnd = root.exits.length > 0
  placeSeq(root, 0, PILL_HEIGHT)
  start.x = root.width / 2 - PILL_WIDTH / 2
  start.y = 0
  const end = reachesEnd ? { width: PILL_WIDTH, height: PILL_HEIGHT, x: root.width / 2 - PILL_WIDTH / 2, y: root.y + root.height } : null
  const drawing = createDrawing()
  drawRoot(drawing, root, start, end)
  const edges = routeEdges(drawing, ctx.edges, root.width / 2)
  const bounds = drawingBounds(drawing)
  const wide = edgeBounds(edges, bounds)
  const dx = MARGIN - wide.left
  const dy = MARGIN - bounds.top
  return {
    ...shifted(drawing, edges, dx, dy),
    endNotes: ctx.endNotes,
    width: wide.right - wide.left + MARGIN * 2,
    height: bounds.bottom - bounds.top + MARGIN * 2,
  }
}

export function roundedPath(points, radius = CORNER) {
  if (points.length === 0) return ''
  const parts = [`M ${points[0].x} ${points[0].y}`]
  for (let at = 1; at < points.length - 1; at += 1) {
    const before = points[at - 1]
    const corner = points[at]
    const after = points[at + 1]
    const inLength = Math.hypot(corner.x - before.x, corner.y - before.y)
    const outLength = Math.hypot(after.x - corner.x, after.y - corner.y)
    const bend = Math.min(radius, inLength / 2, outLength / 2)
    if (bend <= 0) {
      parts.push(`L ${corner.x} ${corner.y}`)
    } else {
      const enter = { x: corner.x - ((corner.x - before.x) / inLength) * bend, y: corner.y - ((corner.y - before.y) / inLength) * bend }
      const leave = { x: corner.x + ((after.x - corner.x) / outLength) * bend, y: corner.y + ((after.y - corner.y) / outLength) * bend }
      parts.push(`L ${enter.x} ${enter.y}`, `Q ${corner.x} ${corner.y} ${leave.x} ${leave.y}`)
    }
  }
  const last = points[points.length - 1]
  parts.push(`L ${last.x} ${last.y}`)
  return parts.join(' ')
}

export const pairKey = (from, to) => `${from}>${to}`

const visitedStep = (entry) => (entry.depth > 0 ? entry.root : entry.step)

export function travelled(steps, entries, isFinished) {
  const index = indexSteps(steps)
  const visited = entries.map(visitedStep).filter((id, at, all) => id && id !== all[at - 1])
  const pairs = new Set(visited.length > 0 ? [pairKey(START_NODE, visited[0])] : [])
  visited.slice(1).forEach((to, at) => {
    const from = visited[at]
    const inside = loopsAround(index, to)
    const left = loopsAround(index, from).filter((parent) => !inside.includes(parent) && parent !== to)
    pairs.add(pairKey(from, to))
    left.forEach((parent) => pairs.add(pairKey(parent, to)))
  })
  if (isFinished && visited.length > 0) pairs.add(pairKey(visited[visited.length - 1], END_NODE))
  return pairs
}
