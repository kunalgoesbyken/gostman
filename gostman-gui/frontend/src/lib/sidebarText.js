import { pluralize } from './dataUtils'

export const SIDEBAR_TEXT = {
  views: 'Sidebar view',
  collections: 'Collections',
  history: 'History',
  runRequests: 'Run requests',
  newFolder: 'New folder',
  newRequest: 'New request',
  toggle: 'Toggle sidebar',
  close: 'Close sidebar',
  resize: 'Resize sidebar',
}

export const HISTORY_TEXT = {
  search: 'Search history',
  emptyTitle: 'No history yet',
  emptyDescription: 'Sent requests appear here.',
  noMatches: 'No sent request matches.',
  remove: 'Remove from history',
  clear: 'Clear history',
  noResponse: 'No response',
  sentAgo: {
    now: 'now',
    minutes: (count) => `${count}m`,
    hours: (count) => `${count}h`,
    days: (count) => `${count}d`,
  },
  sentAgoSpoken: {
    now: 'sent just now',
    minutes: (count) => `sent ${pluralize(count, 'minute')} ago`,
    hours: (count) => `sent ${pluralize(count, 'hour')} ago`,
    days: (count) => `sent ${pluralize(count, 'day')} ago`,
    date: (date) => `sent on ${date}`,
  },
}
