import {
  canSaveAsExample, cleanExampleName, exampleFromResponse, parseExamples, renameExample, serializeExamples,
  withDefaultExample, withExample, withExampleBody, withoutExample,
} from './examples'
import { normalizeRequest } from './request'
import { selectActiveTab, useAppStore } from '../store/appStore'

const SAVE_FAILURE = 'Could not save the example'
const CHANGE_FAILURE = 'Could not change the example'
const DESTRUCTIVE = 'destructive'

const store = () => useAppStore.getState()
const activeTab = () => selectActiveTab(store())
const tabById = (tabId) => store().tabs.find((candidate) => candidate.id === tabId)
const messageOf = (error) => error?.message || String(error)
const quoted = (name) => `"${name}"`

export const isAsking = () => store().promptDialog.isOpen || store().confirmDialog.isOpen || store().alertDialog.isOpen

const attempt = (failureTitle, run) => async (...args) => {
  try {
    await run(...args)
  } catch (error) {
    store().showAlert(failureTitle, messageOf(error), 'OK', 'warning')
  }
}

export function createExampleActions(backend) {
  async function keepWithNewRequest(tab, examples) {
    const saved = await backend.saveRequest(normalizeRequest({ ...tab.request, examples }))
    store().upsertRequest(saved)
    store().updateTabRequest(tab.id, { id: saved.id, examples })
  }

  async function keepWithSavedRequest(saved, examples) {
    store().upsertRequest(await backend.saveRequest(normalizeRequest({ ...saved, examples })))
    store().patchOpenRequest(saved.id, { examples })
  }

  async function change(tabId, update) {
    const tab = tabById(tabId)
    if (!tab) return null
    const examples = serializeExamples(update(parseExamples(tab.request.examples)))
    const saved = store().requests.find((request) => request.id === tab.request.id)
    if (saved) await keepWithSavedRequest(saved, examples)
    else await keepWithNewRequest(tab, examples)
    return tabById(tabId).request
  }

  const add = attempt(SAVE_FAILURE, async (tabId, response, name) => {
    const example = exampleFromResponse(response, name)
    const request = await change(tabId, (examples) => withExample(examples, example))
    if (request) store().showAlert('Saved', `Example ${quoted(example.name)} was saved with ${quoted(request.name)}.`, 'OK', 'success')
  })

  function saveResponse() {
    const { id, response } = activeTab()
    if (!canSaveAsExample(response)) return
    store().showPrompt('Save as example', 'Example name', response.status, '', (name) => add(id, response, name))
  }

  const applyRename = attempt(CHANGE_FAILURE, (tabId, example, name) => (
    change(tabId, (examples) => renameExample(examples, example.id, name))
  ))

  function rename(example) {
    const { id } = activeTab()
    store().showPrompt('Rename example', 'Example name', example.name, '', (name) => {
      const cleaned = cleanExampleName(name, example.name)
      if (cleaned !== example.name) applyRename(id, example, cleaned)
    })
  }

  const applyRemove = attempt(CHANGE_FAILURE, (tabId, example) => (
    change(tabId, (examples) => withoutExample(examples, example.id))
  ))

  function remove(example) {
    const { id } = activeTab()
    store().showConfirm(
      'Delete example',
      `Delete example ${quoted(example.name)}? This can't be undone.`,
      () => applyRemove(id, example),
      null,
      DESTRUCTIVE,
    )
  }

  const markDefault = attempt(CHANGE_FAILURE, (example) => (
    change(activeTab().id, (examples) => withDefaultExample(examples, example.id))
  ))

  const saveBody = attempt(CHANGE_FAILURE, (example, body) => (
    change(activeTab().id, (examples) => withExampleBody(examples, example.id, body))
  ))

  function close() {
    if (!isAsking()) store().closeExamplesDialog()
  }

  return {
    saveResponse,
    rename,
    remove,
    markDefault,
    saveBody,
    open: () => store().openExamplesDialog(),
    close,
  }
}
