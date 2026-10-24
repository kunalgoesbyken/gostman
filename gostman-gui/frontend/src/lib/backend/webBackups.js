import { KIND_AUTOMATIC } from '../backupKinds'
import { READ_ONLY, READ_WRITE, indexedStore, settled } from './indexedStore'

const KEPT_SNAPSHOTS = 10
const SNAPSHOT_INTERVAL_MS = 24 * 60 * 60 * 1000

const withStore = indexedStore('gostman-backups', 'snapshots', { keyPath: 'id' })

const summaryOf = ({ id, kind, version, createdAt, size }) => ({ id, kind, version, createdAt, size })

const newestFirst = (first, second) => second.createdAt - first.createdAt

const readAll = (store) => settled(store.getAll()).then((records) => records.sort(newestFirst))

export const listSnapshots = () => withStore(READ_ONLY, readAll).then((records) => records.map(summaryOf))

export const clearSnapshots = () => withStore(READ_WRITE, (store) => settled(store.clear()))

export const readSnapshot = (id) => withStore(READ_ONLY, (store) => settled(store.get(id)))

export function saveSnapshot(kind, data) {
  const createdAt = Date.now()
  const record = { id: `${createdAt}-${kind}`, kind, version: __APP_VERSION__, createdAt, size: new Blob([data]).size, data }
  return withStore(READ_WRITE, async (store) => {
    await settled(store.put(record))
    const records = await readAll(store)
    await Promise.all(records.slice(KEPT_SNAPSHOTS).map((old) => settled(store.delete(old.id))))
  })
}

function isSnapshotDue(snapshots, now) {
  const [newest] = snapshots
  return !newest || newest.version !== __APP_VERSION__ || now - newest.createdAt >= SNAPSHOT_INTERVAL_MS
}

async function snapshotNowIfDue(data) {
  if (data === null) return
  if (isSnapshotDue(await listSnapshots(), Date.now())) await saveSnapshot(KIND_AUTOMATIC, data)
}

let pendingSnapshot = Promise.resolve()

export function snapshotIfDue(data) {
  const next = pendingSnapshot.then(() => snapshotNowIfDue(data))
  pendingSnapshot = next.catch(() => {})
  return next
}
