export const VIEW_FULL = 'full'
export const VIEW_VARIABLES = 'variables'

const VIEWS = [VIEW_FULL, VIEW_VARIABLES]

export const defaultViewOf = (request) => (request.defaultView === VIEW_VARIABLES ? VIEW_VARIABLES : VIEW_FULL)

export const viewOf = (tab) => (VIEWS.includes(tab?.view) ? tab.view : defaultViewOf(tab?.request ?? {}))
