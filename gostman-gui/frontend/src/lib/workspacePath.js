export const workspacePathOf = (state) => state.workspaceStatus?.path || ''

export const isAnotherWorkspace = (state, previous) => workspacePathOf(state) !== workspacePathOf(previous)
