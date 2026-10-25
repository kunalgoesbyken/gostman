import { RESPONSE_TEXT } from './responseText'

export const COOKIES_TEXT = {
  title: RESPONSE_TEXT.tabs.cookies,
  clearAll: 'Clear all',
  filter: 'Filter by name or domain',
  emptyTitle: 'No cookies stored',
  emptyHint: 'Cookies set by responses are kept here and sent back to the same site on later requests.',
  noMatches: 'No cookie name or domain matches.',
  remove: (name) => `Delete cookie ${name}`,
  columns: RESPONSE_TEXT.columns,
  session: RESPONSE_TEXT.sessionCookie,
}
