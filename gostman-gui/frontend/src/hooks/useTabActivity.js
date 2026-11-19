import { useShallow } from "zustand/react/shallow"
import { RUN_RUNNING, useFlowRunStore } from "../lib/flows/flowRunner"
import { FLOW_RUN_TEXT } from "../lib/flowsText"
import { SOCKET_CONNECTING, SOCKET_OPEN, SOCKET_WAITING, useSocketStore } from "../lib/socketSessions"
import { SOCKET_TEXT } from "../lib/socketText"
import { STREAM_CONNECTING, STREAM_OPEN, STREAM_RECONNECTING } from "../lib/sse"
import { useSseStore } from "../lib/sseSessions"
import { STATUS_TEXT } from "../lib/sseText"
import { useAppStore } from "../store/appStore"

export const KIND_SOCKET = "socket"
export const KIND_STREAM = "stream"
export const KIND_FLOW = "flow"

export const PHASE_CONNECTING = "connecting"
export const PHASE_OPEN = "open"
export const PHASE_RUNNING = "running"

const PHASES = {
  [KIND_SOCKET]: { [SOCKET_CONNECTING]: PHASE_CONNECTING, [SOCKET_OPEN]: PHASE_OPEN, [SOCKET_WAITING]: PHASE_CONNECTING },
  [KIND_STREAM]: { [STREAM_CONNECTING]: PHASE_CONNECTING, [STREAM_OPEN]: PHASE_OPEN, [STREAM_RECONNECTING]: PHASE_CONNECTING },
  [KIND_FLOW]: { [RUN_RUNNING]: PHASE_RUNNING },
}

const STATUS_WORDS = {
  [KIND_SOCKET]: () => SOCKET_TEXT.statuses,
  [KIND_STREAM]: () => STATUS_TEXT,
  [KIND_FLOW]: () => FLOW_RUN_TEXT.status,
}

const activityFor = (kind, status) => {
  const phase = PHASES[kind][status]
  return phase && { kind, status, phase }
}

const activityOf = ({ socket, stream, flow }) => (
  activityFor(KIND_FLOW, flow) ?? activityFor(KIND_SOCKET, socket) ?? activityFor(KIND_STREAM, stream)
)

const statusesOf = (records) => Object.fromEntries(Object.entries(records).map(([id, record]) => [id, record.status]))

export const statusLabel = (activity) => STATUS_WORDS[activity.kind]()[activity.status]

export function useTabActivity(tab) {
  const socket = useSocketStore((state) => state.sessions[tab.id]?.status)
  const stream = useSseStore((state) => (tab.pendingId ? state.sessions[tab.pendingId]?.status : undefined))
  const flow = useFlowRunStore((state) => state.runs[tab.id]?.status)
  return activityOf({ socket, stream, flow })
}

export function useLiveActivities() {
  const sockets = useSocketStore(useShallow((state) => statusesOf(state.sessions)))
  const streams = useSseStore(useShallow((state) => statusesOf(state.sessions)))
  const flows = useFlowRunStore(useShallow((state) => statusesOf(state.runs)))
  const pending = useAppStore(useShallow((state) => Object.fromEntries(state.tabs.map((tab) => [tab.id, tab.pendingId]))))

  const activities = new Map()
  Object.entries(pending).forEach(([tabId, pendingId]) => {
    const activity = activityOf({ socket: sockets[tabId], stream: streams[pendingId], flow: flows[tabId] })
    if (activity) activities.set(tabId, activity)
  })
  return activities
}
