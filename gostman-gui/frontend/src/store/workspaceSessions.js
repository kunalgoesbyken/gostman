const MAX_SESSIONS = 12

export const NO_WORKSPACE = { path: '', name: '', workspaces: [], problems: [], notice: '' }

const sessionOf = ({ tabs, activeTabId, nextTabId, requests }) => ({ tabs, activeTabId, nextTabId, requests })

const newest = (sessions) => Object.fromEntries(Object.entries(sessions).slice(-MAX_SESSIONS))

export function enterWorkspace(state, status, freshSession) {
  const from = state.workspaceStatus.path
  if (from === status.path) return { workspaceStatus: status }
  const { [status.path]: restored, ...others } = state.workspaceSessions
  const next = restored || freshSession()
  return {
    workspaceStatus: status,
    workspaceSessions: newest({ ...others, [from]: sessionOf(state) }),
    tabs: next.tabs,
    activeTabId: next.activeTabId,
    nextTabId: next.nextTabId,
    requests: next.requests,
    sessionVariables: {},
  }
}

export function leaveWorkspace(state, path) {
  const { [path]: dropped, ...kept } = state.workspaceSessions
  return { workspaceSessions: kept }
}

export function persistableSessions(sessions, persistableTab) {
  return Object.fromEntries(Object.entries(sessions).map(([path, session]) => [path, {
    tabs: session.tabs.map(persistableTab(session.requests)),
    activeTabId: session.activeTabId,
    nextTabId: session.nextTabId,
  }]))
}

export function restoreSessions(persisted, restoreTabs, nextIdAfter) {
  if (!persisted || typeof persisted !== 'object') return {}
  return Object.fromEntries(Object.entries(persisted).map(([path, session]) => {
    const tabs = restoreTabs(session?.tabs)
    const hasActive = tabs.some((tab) => tab.id === session?.activeTabId)
    return [path, {
      tabs,
      activeTabId: hasActive ? session.activeTabId : tabs[0].id,
      nextTabId: Math.max(session?.nextTabId || 0, nextIdAfter(tabs)),
      requests: [],
    }]
  }))
}
