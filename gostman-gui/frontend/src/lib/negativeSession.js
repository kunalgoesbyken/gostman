import { create } from 'zustand'
import { ROOT_ID } from './collectionTree'
import { MODELESS_WINDOWS } from './dialogWindows'
import { showWindow } from './windowLayers'

export const IDLE = 'idle'
export const RUNNING = 'running'
export const DONE = 'done'

const FRESH_RUN = { isConfirmed: false, phase: IDLE, sent: 0, planned: 0, findings: [] }

const INITIAL_STATE = { isOpen: false, folderId: ROOT_ID, ...FRESH_RUN }

export const useNegativeStore = create(() => INITIAL_STATE)

const state = () => useNegativeStore.getState()
const patch = (changes) => useNegativeStore.setState(changes)

export function createNegativeActions(runPlan) {
  let current = null

  function open(folderId) {
    if (!state().isOpen) return patch({ ...INITIAL_STATE, isOpen: true, folderId: folderId ?? ROOT_ID })
    showWindow(MODELESS_WINDOWS.negative.id)
    if (folderId !== undefined && state().phase !== RUNNING) setScope(folderId)
  }

  function setScope(folderId) {
    patch({ ...FRESH_RUN, folderId })
  }

  async function start(plan, options, planned) {
    const run = { isStopped: false }
    current = run
    patch({ phase: RUNNING, sent: 0, planned, findings: [] })
    try {
      await runPlan(plan, {
        ...options,
        isStopped: () => run.isStopped,
        onSent: (sent) => current === run && patch({ sent }),
        onFinding: (found) => current === run && patch({ findings: [...state().findings, found] }),
      })
    } finally {
      if (current === run) {
        current = null
        patch({ phase: DONE })
      }
    }
  }

  function stop() {
    if (current) current.isStopped = true
  }

  function close() {
    stop()
    current = null
    patch(INITIAL_STATE)
  }

  return {
    open,
    close,
    start,
    stop,
    setScope,
    setConfirmed: (isConfirmed) => patch({ isConfirmed }),
  }
}
