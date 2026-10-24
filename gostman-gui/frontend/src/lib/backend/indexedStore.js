export const READ_ONLY = 'readonly'
export const READ_WRITE = 'readwrite'

export const settled = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const completed = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = resolve
  transaction.onerror = () => reject(transaction.error)
  transaction.onabort = () => reject(transaction.error)
})

function openDatabase(name, storeName, options) {
  const request = indexedDB.open(name, 1)
  request.onupgradeneeded = () => request.result.createObjectStore(storeName, options)
  return settled(request)
}

export function indexedStore(name, storeName, options) {
  let connecting = null
  const forget = () => {
    connecting = null
  }
  const adopt = (database) => {
    database.onversionchange = () => {
      database.close()
      forget()
    }
    database.onclose = forget
    return database
  }
  const connect = () => {
    if (!connecting) {
      connecting = Promise.resolve().then(() => openDatabase(name, storeName, options)).then(adopt)
      connecting.catch(forget)
    }
    return connecting
  }
  return async (mode, use) => {
    const database = await connect()
    const transaction = database.transaction(storeName, mode)
    const [result] = await Promise.all([use(transaction.objectStore(storeName)), completed(transaction)])
    return result
  }
}
