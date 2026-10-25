const scannable = (collection) => (
  collection.variables && typeof collection.variables !== 'string'
    ? { ...collection, variables: JSON.stringify(collection.variables) }
    : collection
)

export function createScanClient(backend) {
  async function run(collection, skipExamples) {
    const reply = await backend.scan({ collection: scannable(collection), options: { skipExamples } })
    if (reply.error) throw new Error(reply.error)
    return reply
  }

  return { run }
}
