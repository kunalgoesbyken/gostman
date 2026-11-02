export const LANE_WIDTH = 14
export const ROW_HEIGHT = 44
export const NODE_RADIUS = 4
const LANE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--info))',
  'hsl(var(--syntax-boolean))',
  'hsl(var(--destructive))',
]

const firstFree = (lanes) => {
  const free = lanes.indexOf(null)
  return free < 0 ? lanes.length : free
}

function trimTail(lanes) {
  while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop()
}

export function layoutGraph(commits) {
  const lanes = []
  const rows = commits.map((commit) => {
    const top = [...lanes]
    let node = lanes.indexOf(commit.hash)
    if (node < 0) {
      node = firstFree(lanes)
      lanes[node] = commit.hash
    }
    const merging = []
    lanes.forEach((hash, index) => {
      if (hash === commit.hash && index !== node) merging.push(index)
    })
    merging.forEach((index) => { lanes[index] = null })

    const parents = commit.parents ?? []
    const parentLanes = []
    if (parents.length === 0) {
      lanes[node] = null
    } else {
      lanes[node] = parents[0]
      parentLanes.push(node)
      parents.slice(1).forEach((parent) => {
        let index = lanes.indexOf(parent)
        if (index < 0) {
          index = firstFree(lanes)
          lanes[index] = parent
        }
        parentLanes.push(index)
      })
    }
    const bottom = [...lanes]
    trimTail(lanes)
    return { hash: commit.hash, node, top, bottom, merging, parentLanes, isMerge: parents.length > 1 }
  })
  const width = rows.reduce((widest, row) => Math.max(widest, row.top.length, row.bottom.length, row.node + 1), 1)
  return { rows, width }
}

export const laneColor = (index) => LANE_COLORS[index % LANE_COLORS.length]
export const laneX = (index) => index * LANE_WIDTH + LANE_WIDTH / 2
