import { create } from 'zustand'
import { isGrpcRequest } from './grpc'
import { withInheritance } from './inheritance'
import { LOAD_LIMITS, LOAD_TEST_TEXT, DEFAULT_LOAD } from './loadTestText'
import { isMcpRequest } from './mcp'
import { isSocketAddress } from './socketSessions'
import { isStreamRequest } from './sse'
import { selectActiveTab, selectActiveVariables, useAppStore } from '../store/appStore'

const MS_PER_SECOND = 1000

const INITIAL_STATE = {
  isOpen: false,
  isRunning: false,
  request: null,
  variables: '',
  blocked: '',
  concurrency: DEFAULT_LOAD.concurrency,
  durationSeconds: DEFAULT_LOAD.durationSeconds,
  rateLimit: 0,
  progress: null,
  report: null,
  failure: '',
}

export const useLoadTestStore = create(() => INITIAL_STATE)

const state = () => useLoadTestStore.getState()
const patch = (changes) => useLoadTestStore.setState(changes)
const messageOf = (error) => error?.message || String(error)

export const toBoundedCount = (text, highest) => {
  const count = Math.trunc(Number(text))
  if (!Number.isFinite(count) || count < 0) return 0
  return Math.min(count, highest)
}

function unsupportedReason(request, variables) {
  if (!request.url.trim()) return LOAD_TEST_TEXT.noUrl
  const isOtherProtocol = isGrpcRequest(request) || isMcpRequest(request) || isStreamRequest(request) || isSocketAddress(request.url, variables)
  return isOtherProtocol ? LOAD_TEST_TEXT.unsupported : ''
}

const toConfig = ({ concurrency, durationSeconds, rateLimit }) => ({
  concurrency,
  durationMs: durationSeconds * MS_PER_SECOND,
  requests: 0,
  ratePerSecond: rateLimit,
  rampMs: 0,
  failureStatus: 0,
})

export function createLoadTestActions(backend) {
  const runner = backend.loadTest

  async function start() {
    const { request, variables } = state()
    patch({ isRunning: true, progress: null, report: null, failure: '' })
    const stopListening = runner.onProgress((progress) => patch({ progress }))
    try {
      patch({ report: await runner.run(request, variables, toConfig(state())) })
    } catch (error) {
      patch({ failure: messageOf(error) })
    } finally {
      stopListening()
      patch({ isRunning: false })
    }
  }

  function open() {
    const appState = useAppStore.getState()
    const request = withInheritance(appState, selectActiveTab(appState).request)
    const variables = selectActiveVariables(appState)
    patch({ ...INITIAL_STATE, isOpen: true, request, variables, blocked: unsupportedReason(request, variables) })
  }

  function stop() {
    runner.stop()
  }

  function close() {
    if (state().isRunning) stop()
    patch({ isOpen: false })
  }

  return {
    isAvailable: Boolean(runner),
    open,
    close,
    start,
    stop,
    setConcurrency: (text) => patch({ concurrency: toBoundedCount(text, LOAD_LIMITS.concurrency) }),
    setDuration: (text) => patch({ durationSeconds: toBoundedCount(text, LOAD_LIMITS.durationSeconds) }),
    setRateLimit: (text) => patch({ rateLimit: toBoundedCount(text, Number.MAX_SAFE_INTEGER) }),
  }
}
