import { READ_ONLY, READ_WRITE, indexedStore, settled } from './indexedStore'

const withRuns = indexedStore('gostman-monitors', 'runs')
const KEY_PREFIX = 'runs:'
const keyOf = (scope) => `${KEY_PREFIX}${scope}`

const read = (scope) => withRuns(READ_ONLY, (store) => settled(store.get(keyOf(scope)))).then((value) => (Array.isArray(value) ? value : []))

export const webMonitors = {
  runs: (scope) => read(scope),
  save: async (scope, record, keep) => {
    const kept = [...(await read(scope)), record].slice(-keep)
    await withRuns(READ_WRITE, (store) => {
      store.put(kept, keyOf(scope))
    })
  },
  webhook: null,
}
