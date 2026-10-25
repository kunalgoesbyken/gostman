export const APP_TEXT = {
  loading: 'Loading',
  loadingEditor: 'Loading editor',
  backToLanding: 'Back to the landing page',
  requestSection: 'Request',
  window: {
    minimize: 'Minimize',
    maximize: 'Maximize',
    restore: 'Restore',
  },
  crash: {
    title: 'Gostman ran into an error',
    description: (error) => `Your saved requests are not affected. Reload to continue. If it happens again, report it with this message:

${error}`,
    reload: 'Reload',
  },
  loadFailure: {
    title: 'Saved data could not be loaded',
    description: (reason) => `Nothing was changed or overwritten. ${reason}`,
    retry: 'Try again',
    unreadable: 'Saved data was unreadable',
    ok: 'OK',
  },
}
