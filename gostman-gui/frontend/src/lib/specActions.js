import { withoutActiveContent } from './activeContent'
import { CONTRACT_TEXT } from './checksText'
import { checksContract } from './contractCheck'
import { parseJSON } from './dataUtils'
import { sanitizeImport } from './importExport'
import { createSpecClient } from './openapiSpec'
import { normalizeRequest } from './request'
import { createLink, diffSpec, linkEntry, selectedChanges, specPatch, upgradedLink } from './specSync'
import { SPEC_ALERTS, SPEC_TEXT } from './specText'
import { selectActiveVariables, useAppStore } from '../store/appStore'

const store = () => useAppStore.getState()
const idsOf = (items) => items.map((item) => item.id)

function missingVariables(variables) {
  const existing = parseJSON(selectActiveVariables(store()), {})
  return Object.fromEntries(Object.entries(variables || {}).filter(([name]) => !(name in existing)))
}

const owningRoot = ({ folders, variables }) => (
  folders.map((folder, index) => (index === 0 ? { ...folder, collectionVariables: JSON.stringify(variables || {}, null, 2) } : folder))
)

const sharedVariables = (result) => (result.folders.length > 0 ? {} : missingVariables(result.variables))

function folderForTag(tag, rootId, created) {
  if (tag === '') return rootId
  const known = [...store().folders, ...created].find((folder) => folder.name === tag && folder.parentId === rootId)
  if (known) return known.id
  const folder = { id: crypto.randomUUID(), name: tag, isOpen: false, parentId: rootId }
  created.push(folder)
  return folder.id
}

export function createSpecActions({ backend, attempt, addImported }) {
  const client = createSpecClient(backend)

  const importSpec = attempt('Import failed', async (result) => {
    const existing = { requestIds: idsOf(store().requests), folderIds: idsOf(store().folders) }
    const data = sanitizeImport({ ...result, folders: owningRoot(result), variables: sharedVariables(result) }, existing)
    const imported = await addImported(data)
    const { source, hash, operations } = result.spec
    if (!imported || !source) return
    const present = new Set(idsOf(store().requests))
    const entries = data.requests
      .map((request, index) => [operations[index], request])
      .filter(([, request]) => present.has(request.id))
      .map(([operation, request]) => [operation.key, linkEntry(request.id, operation.hash, request, operation.operationId)])
    store().setSpecLink(data.folders[0].id, createLink(source, hash, entries))
  })

  const check = attempt(SPEC_ALERTS.syncTitle, async (folderId) => {
    const saved = store().specLinks[folderId]
    if (!saved?.source) throw new Error(SPEC_TEXT.sourceMissing)
    const link = upgradedLink(saved, store().requests)
    store().setSpecLink(folderId, link)
    const summary = await client.summary(link.source)
    const plan = { ...diffSpec(link, summary.operations, store().requests), hash: summary.hash }
    store().openSpecDialog({ mode: 'sync', folderId, plan })
  })

  async function removeRequests(items, ops) {
    if (items.length === 0) return
    const ids = items.map((item) => item.requestId)
    await backend.deleteRequests(ids)
    store().removeRequests(ids)
    items.forEach((item) => { delete ops[item.key] })
  }

  async function updateRequests(items, generated, ops) {
    const rewritten = items.map((item) => {
      const current = store().requests.find((candidate) => candidate.id === item.requestId)
      return normalizeRequest({ ...current, ...specPatch(generated.get(item.newKey).request) })
    })
    if (rewritten.length === 0) return
    const saved = await backend.saveRequests(rewritten)
    store().upsertRequests(saved)
    items.forEach((item, index) => {
      const { operation } = generated.get(item.newKey)
      store().patchOpenRequest(saved[index].id, specPatch(saved[index]))
      delete ops[item.key]
      ops[operation.key] = linkEntry(saved[index].id, operation.hash, saved[index], operation.operationId)
    })
  }

  async function addRequests(operations, generated, rootId, ops) {
    const created = []
    const requests = operations.map((operation) => {
      const entry = generated.get(operation.key)
      return normalizeRequest({ ...entry.request, folderId: folderForTag(entry.operation.tag, rootId, created) })
    })
    if (requests.length === 0) return
    store().mergeFolders(created)
    const saved = await backend.saveRequests(requests)
    store().upsertRequests(saved)
    operations.forEach((operation, index) => {
      ops[operation.key] = linkEntry(saved[index].id, operation.hash, saved[index], operation.operationId)
    })
  }

  const apply = attempt(SPEC_ALERTS.syncTitle, async (folderId, plan, selected) => {
    const link = store().specLinks[folderId]
    const picks = selectedChanges(plan, selected)
    const keys = [...picks.added.map((operation) => operation.key), ...picks.changed.map((item) => item.newKey)]
    const fetched = keys.length > 0 ? await client.requestsFor(link.source, keys) : { requests: [], operations: [] }
    const generated = new Map(fetched.operations.map((operation, index) => [operation.key, { operation, request: withoutActiveContent(fetched.requests[index]) }]))
    const ops = { ...link.ops }
    await removeRequests(picks.removed, ops)
    await updateRequests(picks.changed, generated, ops)
    await addRequests(picks.added, generated, folderId, ops)
    store().setSpecLink(folderId, { ...link, hash: plan.hash, syncedAt: new Date().toISOString(), ops })
    store().closeSpecDialog()
    store().showAlert(SPEC_ALERTS.appliedTitle, SPEC_ALERTS.applied({
      added: picks.added.length,
      changed: picks.changed.length,
      removed: picks.removed.length,
    }), 'OK', 'success')
  })

  const sourceFor = (address) => (address.startsWith('http://') || address.startsWith('https://') ? { url: address } : { path: address })

  const linkAddress = (folder) => attempt(CONTRACT_TEXT.linkTitle, async (input) => {
    const address = input.trim()
    if (address === '') return
    const source = sourceFor(address)
    const summary = await client.summary(source)
    store().setSpecLink(folder.id, { ...createLink(source, summary.hash, []), sync: false })
    store().showNotice(CONTRACT_TEXT.linked(folder.name))
  })

  const linkFolder = (folder) => store().showPrompt(CONTRACT_TEXT.linkTitle, CONTRACT_TEXT.linkMessage, '', SPEC_TEXT.addressPlaceholder, linkAddress(folder), CONTRACT_TEXT.linkConfirm)

  const toggleContract = (folderId) => {
    const link = store().specLinks[folderId]
    store().setSpecLink(folderId, { ...link, contract: !checksContract(link) })
  }

  const browse = (source) => store().openSpecDialog({ mode: 'view', source })

  const browseFolder = (folderId) => browse(store().specLinks[folderId].source)

  const lintLatest = () => {
    const linked = Object.values(store().specLinks).filter((link) => link.source)
    if (linked.length === 0) {
      store().showAlert(SPEC_ALERTS.lintTitle, SPEC_TEXT.lintNoSpec)
      return
    }
    const [newest] = linked.sort((a, b) => (b.syncedAt || '').localeCompare(a.syncedAt || ''))
    store().openSpecDialog({ mode: 'view', source: newest.source, tab: 'lint' })
  }

  const sendToTab =(detail, variables) => {
    store().mergeActiveVariables(missingVariables(variables))
    store().openRequestTab({ ...detail.request, id: '', folderId: '' })
    store().closeSpecDialog()
  }

  return {
    read: client.read,
    summary: client.summary,
    operation: client.operation,
    schema: client.schema,
    lint: client.lint,
    lintLatest,
    importSpec,
    check,
    apply,
    toggleContract,
    linkFolder,
    browse,
    browseFolder,
    sendToTab,
  }
}
