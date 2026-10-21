import { SPEC_TEXT } from './specText'

const SNIFF_LENGTH = 65536
const SPEC_MARKERS = ['"openapi"', '"swagger"', 'openapi:', 'swagger:']
const KEYS_PER_REQUEST = 200

export const mayBeSpec = (text) => {
  const head = text.slice(0, SNIFF_LENGTH)
  return SPEC_MARKERS.some((marker) => head.includes(marker))
}

const sourceOf = (input) => {
  if (input.url) return { url: input.url }
  if (input.path) return { path: input.path }
  return null
}

export const sourceLabel = (source) => source?.url || source?.path || ''

const chunk = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))

export function createSpecClient(backend) {
  const pageSize = backend.openapiPageSize

  async function ask(query) {
    const reply = await backend.openapi(query)
    if (reply.error) throw new Error(reply.error)
    return reply
  }

  async function readPages(source) {
    const pages = []
    let offset = 0
    do {
      const { collection } = await ask({ action: 'collection', source, offset, limit: pageSize })
      pages.push(collection)
      offset += pageSize
    } while (pageSize > 0 && offset < pages[0].total)
    return pages
  }

  async function read(source) {
    try {
      const pages = await readPages(source)
      const [first] = pages
      return {
        success: true,
        label: SPEC_TEXT.label,
        requests: pages.flatMap((page) => page.requests),
        folders: first.folders,
        variables: first.variables,
        warnings: first.warnings,
        spec: { source: sourceOf(source), hash: first.hash, operations: pages.flatMap((page) => page.operations) },
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async function requestsFor(source, keys) {
    const pages = await Promise.all(chunk(keys, KEYS_PER_REQUEST).map(async (part) => (
      (await ask({ action: 'requests', source, keys: part })).collection
    )))
    return {
      requests: pages.flatMap((page) => page.requests),
      operations: pages.flatMap((page) => page.operations),
    }
  }

  return {
    read,
    requestsFor,
    summary: async (source) => (await ask({ action: 'summary', source })).summary,
    operation: async (source, key) => (await ask({ action: 'operation', source, key })).detail,
    schema: async (source, name) => (await ask({ action: 'schema', source, name })).schema,
    lint: async (source) => {
      const reply = await backend.lint({ source, config: '' })
      if (reply.error) throw new Error(reply.error)
      return reply.report
    },
  }
}
