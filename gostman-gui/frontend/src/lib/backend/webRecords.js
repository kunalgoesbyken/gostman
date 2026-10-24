import { DATA_TEXT } from '../dataText'
import { isStorageFull, localRecords, storageFullError, storageRoom } from '../storage'
import { READ_ONLY, READ_WRITE, indexedStore, settled } from './indexedStore'

const LOCATION_KEY = 'gostman-data-location'
const IN_DATABASE = 'indexeddb'
const OPEN_TIMEOUT_MS = 10000

const withRecords = indexedStore('gostman', 'records')

async function asStorageFull(error) {
  throw isStorageFull(error) ? storageFullError(await storageRoom()) : error
}

const databaseRecords = {
  inDatabase: true,
  read: (key) => withRecords(READ_ONLY, (store) => settled(store.get(key))).then((value) => (typeof value === 'string' ? value : null)),
  write: (key, text) => withRecords(READ_WRITE, (store) => {
    store.put(text, key)
    store.transaction.commit?.()
  }).catch(asStorageFull),
  remove: (key) => withRecords(READ_WRITE, (store) => {
    store.delete(key)
  }),
  keys: () => withRecords(READ_ONLY, (store) => settled(store.getAllKeys())),
}

const timedOut = (milliseconds) => new Promise((resolve, reject) => {
  setTimeout(() => reject(new Error(DATA_TEXT.databaseUnavailable)), milliseconds)
})

async function copyIntoDatabase(storage, key) {
  const text = storage.getItem(key)
  await databaseRecords.write(key, text)
  if ((await databaseRecords.read(key)) !== text) throw new Error(DATA_TEXT.databaseUnavailable)
  return [key, text]
}

async function moveIntoDatabase(storage, keys) {
  const copied = []
  for (const key of keys.filter((candidate) => storage.getItem(candidate) !== null)) {
    copied.push(await copyIntoDatabase(storage, key))
  }
  copied.filter(([key, text]) => storage.getItem(key) === text).forEach(([key]) => storage.removeItem(key))
  rememberDatabase(storage)
}

function rememberDatabase(storage) {
  try {
    storage.setItem(LOCATION_KEY, IN_DATABASE)
  } catch {
    return
  }
}

const unopenedError = (error) => new Error(isStorageFull(error) ? DATA_TEXT.browserStorageFull(error.room) : DATA_TEXT.databaseUnavailable)

async function chooseRecords(storage, keys) {
  const usedDatabase = storage.getItem(LOCATION_KEY) === IN_DATABASE
  try {
    await Promise.race([databaseRecords.keys(), timedOut(OPEN_TIMEOUT_MS)])
    await moveIntoDatabase(storage, keys)
    return databaseRecords
  } catch (error) {
    if (usedDatabase) throw unopenedError(error)
    return localRecords(storage)
  }
}

export function webRecords(storage, keys) {
  let opening = null
  return () => {
    if (!opening) {
      opening = chooseRecords(storage, keys)
      opening.catch(() => {
        opening = null
      })
    }
    return opening
  }
}
