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
  sentAgo: {
    now: 'now',
    minutes: (count) => `${count}m`,
    hours: (count) => `${count}h`,
    days: (count) => `${count}d`,
  },
}
