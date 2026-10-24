export function createStorageGate() {
  let pending = Promise.resolve()
  return {
    during: (change) => {
      const result = change()
      pending = result.then(() => {}, () => {})
      return result
    },
    settled: () => pending,
  }
}
