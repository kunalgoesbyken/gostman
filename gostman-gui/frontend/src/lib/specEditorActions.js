import { DIALOG_TEXT } from './dialogText'
import { specSourceOf } from './mockServer'
import { copiedSpec, detectSpecFormat, isSpecDirty, newSpec, normalizeSpec, specSource, stemOfFileName, uniqueSpecName } from './specDocument'
import { SPEC_EDITOR_TEXT as TEXT } from './specEditorText'
import { linkedFolderId } from './specLinked'
import { DEFAULT_TEMPLATE, SPEC_TEMPLATES } from './specTemplates'
import { useAppStore } from '../store/appStore'

const DESTRUCTIVE = 'destructive'
const NEW_FORMAT = 'yaml'

const store = () => useAppStore.getState()
const tabById = (tabId) => store().tabs.find((tab) => tab.id === tabId)
const specById = (specId) => store().specs.find((spec) => spec.id === specId)

function relink(oldId, newId) {
  const { specLinks, setSpecLink } = store()
  Object.entries(specLinks)
    .filter(([, link]) => link.specId === oldId)
    .forEach(([folderId, link]) => setSpecLink(folderId, { ...link, specId: newId }))
}

export function createSpecEditorActions(backend, { attempt, promptForName, openapi, mock }) {
  async function persist(specs) {
    const saved = (await backend.saveSpecs(specs)).map(normalizeSpec)
    store().setSpecs(saved)
    specs.forEach((spec, index) => {
      if (spec.id !== saved[index].id) relink(spec.id, saved[index].id)
    })
    return saved
  }

  async function upsert(spec) {
    const { specs } = store()
    const next = specs.some((candidate) => candidate.id === spec.id) ? specs.map((candidate) => (candidate.id === spec.id ? spec : candidate)) : [...specs, spec]
    const saved = await persist(next)
    return saved[next.findIndex((candidate) => candidate.id === spec.id)]
  }

  const add = async (spec) => store().openSpecTab(await upsert(spec))

  const create = attempt(TEXT.createFailed, async (templateId = DEFAULT_TEMPLATE) => {
    const name = uniqueSpecName(TEXT.templates[templateId].name, store().specs)
    await add(newSpec({ name, format: NEW_FORMAT, text: SPEC_TEMPLATES[templateId] }))
  })

  const importText = attempt(TEXT.importFailed, async (name, text) => {
    await openapi.summary({ text })
    await add(newSpec({ name: uniqueSpecName(name, store().specs), format: detectSpecFormat(text), text }))
  })

  const importFile = async (file) => importText(stemOfFileName(file.name), await file.text())

  const importAddress = attempt(TEXT.importFailed, async (address) => {
    const trimmed = address.trim()
    if (trimmed === '') return
    await importText(TEXT.importedName, await openapi.text(specSourceOf(trimmed)))
  })

  const promptAddress = () => store().showPrompt(TEXT.importAddressTitle, TEXT.importAddressMessage, '', TEXT.importAddressPlaceholder, importAddress, TEXT.importAddressConfirm)

  const open = (specId) => {
    const spec = specById(specId)
    if (spec) store().openSpecTab(spec)
  }

  const renameTo = attempt(TEXT.saveFailed, async (specId, name) => {
    const saved = await upsert({ ...specById(specId), name })
    store().tabs
      .filter((tab) => tab.specId === specId)
      .forEach((tab) => store().replaceSpecTab(tab.id, { ...tab.specDraft, id: saved.id, name: saved.name }))
  })

  const rename = (specId) => {
    const spec = specById(specId)
    if (spec) promptForName(TEXT.renameTitle, TEXT.nameLabel, spec.name, (name) => renameTo(specId, name), DIALOG_TEXT.rename)
  }

  const duplicate = attempt(TEXT.createFailed, async (specId) => {
    const spec = specById(specId)
    if (spec) await add(copiedSpec(spec, uniqueSpecName(TEXT.copyName(spec.name), store().specs)))
  })

  const removeNow = attempt(TEXT.deleteFailed, async (specId) => {
    await persist(store().specs.filter((spec) => spec.id !== specId))
    store().closeTabs(store().tabs.filter((tab) => tab.specId === specId).map((tab) => tab.id))
  })

  const remove = (specId) => {
    const spec = specById(specId)
    if (spec) store().showConfirm(TEXT.deleteTitle, TEXT.deleteMessage(spec.name), () => removeNow(specId), null, DESTRUCTIVE)
  }

  async function saveTab(tabId) {
    const tab = tabById(tabId)
    if (!tab?.specId) return
    const saved = await upsert({ ...tab.specDraft, id: tab.specId })
    store().replaceSpecTab(tabId, saved)
    store().showNotice(TEXT.saved(saved.name))
  }

  const save = attempt(TEXT.saveFailed, saveTab)

  const isDirty = (tab) => Boolean(tab?.specId) && isSpecDirty(tab.specDraft, specById(tab.specId))

  function close(tabId, closeNow) {
    const tab = tabById(tabId)
    if (!isDirty(tab)) {
      closeNow()
      return
    }
    const saveAndClose = attempt(TEXT.saveFailed, async () => {
      await saveTab(tabId)
      closeNow()
    })
    store().showConfirm(TEXT.closeTitle, TEXT.closeMessage(tab.specDraft.name), closeNow, null, DESTRUCTIVE, TEXT.dontSave, { text: TEXT.save, run: saveAndClose })
  }

  const convert = attempt(TEXT.convertFailed, async (tabId, format) => {
    const draft = tabById(tabId).specDraft
    if (draft.format === format) return
    const { convertSpec } = await import('./specFormat')
    store().updateSpecDraft(tabId, { ...draft, format, text: convertSpec(draft.text, format) })
  })

  const sourceOf = (tabId) => specSource(tabById(tabId).specDraft)

  const viewDocs = (tabId) => store().openSpecDialog({ mode: 'view', source: sourceOf(tabId) })

  const compare = (tabId) => openapi.openDiff(sourceOf(tabId), tabById(tabId).specDraft.name)

  const startMock = attempt(TEXT.mockFailed, async (tabId) => {
    await mock.open()
    await mock.importSpec(sourceOf(tabId))
  })

  function pointLinkAtSpec(folderId, source, changes = {}) {
    store().setSpecLink(folderId, { ...store().specLinks[folderId], source, ...changes })
  }

  const generate = attempt(TEXT.generateFailed, async (tabId) => {
    const { specId } = tabById(tabId)
    const source = sourceOf(tabId)
    const folderId = linkedFolderId(store(), specId)
    if (folderId) {
      pointLinkAtSpec(folderId, source)
      await openapi.check(folderId)
      return
    }
    const result = await openapi.read(source)
    if (!result.success) throw new Error(result.error)
    await openapi.importSpec({ ...result, spec: { ...result.spec, specId } })
  })

  const checkResponses = (tabId) => {
    const folderId = linkedFolderId(store(), tabById(tabId).specId)
    if (!folderId) {
      store().showAlert(TEXT.checkResponsesTitle, TEXT.generateFirst)
      return
    }
    pointLinkAtSpec(folderId, sourceOf(tabId), { contract: true })
    store().showNotice(TEXT.checkingResponses(store().folders.find((folder) => folder.id === folderId).name))
  }

  return {
    create,
    open,
    rename,
    duplicate,
    remove,
    save,
    close,
    isDirty,
    importFile,
    promptAddress,
    convert,
    viewDocs,
    compare,
    generate,
    checkResponses,
    startMock: backend.mock ? startMock : null,
    updateDraft: (tabId, draft) => store().updateSpecDraft(tabId, draft),
    browser: {
      summary: openapi.summary,
      lint: openapi.lint,
      operation: openapi.operation,
      schema: openapi.schema,
      sendToTab: openapi.sendToTab,
    },
  }
}
