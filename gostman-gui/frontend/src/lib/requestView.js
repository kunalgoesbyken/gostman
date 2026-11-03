export const VIEW_FULL = 'full'
export const VIEW_VARIABLES = 'variables'

export const defaultViewOf = (request) => (request.defaultView === VIEW_VARIABLES ? VIEW_VARIABLES : VIEW_FULL)
