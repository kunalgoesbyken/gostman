export function createScanClient(backend) {
  async function run(collection, skipExamples) {
    const reply = await backend.scan({ collection, options: { skipExamples } })
    if (reply.error) throw new Error(reply.error)
    return reply
  }

  return { run }
}
