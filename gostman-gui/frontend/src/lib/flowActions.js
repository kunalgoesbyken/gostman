import { textToBase64 } from './base64'
import { DIALOG_TEXT } from './dialogText'
import { FLOW_TEXT } from './flowsText'
import { requestCatalog, withRequestPaths } from './flows/catalog'
import { blankFlow, copiedFlow, exampleFlow, isFlowDirty, uniqueFlowName } from './flows/edit'
import { createFlowRunner, runResults, useFlowRunStore } from './flows/flowRunner'
import { compactFlow, normalizeFlow, slugOf } from './flows/model'
import { buildReportPage } from './runReport'
import { findActiveEnvironment, useAppStore } from '../store/appStore'

const DESTRUCTIVE = 'destructive'
const REPORT_TYPE = 'text/html'

const store = () => useAppStore.getState()
const tabById = (tabId) => store().tabs.find((tab) => tab.id === tabId)
const flowById = (flowId) => store().flows.find((flow) => flow.id === flowId)

const reportName = (name) => `${slugOf(name, 'flow')}-report.html`

export function createFlowActions(backend, { attempt, execute, promptForName }) {
  const runner = createFlowRunner(execute, (sendId) => backend.cancel(sendId))
  const catalog = () => requestCatalog(store().requests, store().folders)
  const named = (flow) => withRequestPaths(normalizeFlow(flow), catalog())

  async function persist(flows) {
    store().setFlows(flows)
    await backend.saveFlows(flows.map((flow) => compactFlow(named(flow))))
  }

  const create = attempt(FLOW_TEXT.createFailed, async (fromExample = false) => {
    const name = uniqueFlowName(fromExample ? FLOW_TEXT.exampleName : FLOW_TEXT.newName, store().flows)
    const flow = fromExample ? exampleFlow(name) : blankFlow(name)
    await persist([...store().flows, flow])
    store().openFlowTab(flow)
  })

  const open = (flowId) => {
    const flow = flowById(flowId)
    if (flow) store().openFlowTab(flow)
  }

  const renameTo = attempt(FLOW_TEXT.saveFailed, async (flowId, name) => {
    await persist(store().flows.map((flow) => (flow.id === flowId ? { ...flow, name } : flow)))
    store().renameFlowTabs(flowId, name)
  })

  const rename = (flowId) => {
    const flow = flowById(flowId)
    if (flow) promptForName(FLOW_TEXT.renameTitle, FLOW_TEXT.nameLabel, flow.name, (name) => renameTo(flowId, name), DIALOG_TEXT.rename)
  }

  const duplicate = attempt(FLOW_TEXT.createFailed, async (flowId) => {
    const flow = flowById(flowId)
    if (!flow) return
    const copy = copiedFlow(flow, uniqueFlowName(FLOW_TEXT.copyName(flow.name), store().flows))
    await persist([...store().flows, copy])
    store().openFlowTab(copy)
  })

  const removeNow = attempt(FLOW_TEXT.deleteFailed, async (flowId) => {
    const tabs = store().tabs.filter((tab) => tab.flowId === flowId)
    tabs.forEach((tab) => runner.discard(tab.id))
    await persist(store().flows.filter((flow) => flow.id !== flowId))
    store().closeTabs(tabs.map((tab) => tab.id))
  })

  const remove = (flowId) => {
    const flow = flowById(flowId)
    if (flow) store().showConfirm(FLOW_TEXT.deleteTitle, FLOW_TEXT.deleteMessage(flow.name), () => removeNow(flowId), null, DESTRUCTIVE)
  }

  async function saveTab(tabId) {
    const tab = tabById(tabId)
    if (!tab?.flowId) return
    const saved = named({ ...tab.flowDraft, id: tab.flowId })
    const exists = store().flows.some((flow) => flow.id === saved.id)
    await persist(exists ? store().flows.map((flow) => (flow.id === saved.id ? saved : flow)) : [...store().flows, saved])
    store().updateFlowDraft(tabId, saved)
    store().showNotice(FLOW_TEXT.saved(saved.name))
  }

  const save = attempt(FLOW_TEXT.saveFailed, saveTab)

  async function addImported(imported) {
    const added = imported.reduce((list, flow) => [...list, { ...flow, name: uniqueFlowName(flow.name, [...store().flows, ...list]) }], [])
    await persist([...store().flows, ...added])
  }

  const isDirty = (tab) => Boolean(tab?.flowId) && isFlowDirty(tab.flowDraft, flowById(tab.flowId))

  function close(tabId, closeNow) {
    const tab = tabById(tabId)
    const closeAndStop = () => {
      runner.discard(tabId)
      closeNow()
    }
    if (!isDirty(tab)) {
      closeAndStop()
      return
    }
    const saveAndClose = attempt(FLOW_TEXT.saveFailed, async () => {
      await saveTab(tabId)
      closeAndStop()
    })
    store().showConfirm(FLOW_TEXT.closeTitle, FLOW_TEXT.closeMessage(tab.flowDraft.name), closeAndStop, null, DESTRUCTIVE, FLOW_TEXT.dontSave, { text: FLOW_TEXT.save, run: saveAndClose })
  }

  const run = (tabId) => {
    const tab = tabById(tabId)
    if (tab?.flowId && !runner.isRunning(tabId)) runner.start(tabId, tab.flowDraft)
  }

  const downloadReport = attempt(FLOW_TEXT.reportFailed, async (tabId) => {
    const flowRun = useFlowRunStore.getState().runs[tabId]
    if (!flowRun) return
    const results = runResults(flowRun)
    const timing = { startedAt: flowRun.startedAt, finishedAt: flowRun.finishedAt || new Date(), planned: results.length, iterations: 0, parallel: 1 }
    const flow = { name: flowRun.flowName, outcome: flowRun.status, message: flowRun.message }
    const page = buildReportPage(results, timing, findActiveEnvironment(store())?.name || '', flow)
    await backend.saveFile(reportName(flowRun.flowName), textToBase64(page), REPORT_TYPE)
  })

  return {
    create,
    open,
    rename,
    duplicate,
    remove,
    save,
    addImported,
    close,
    isDirty,
    run,
    stop: (tabId) => runner.stop(tabId),
    discard: (tabId) => runner.discard(tabId),
    downloadReport,
    updateDraft: (tabId, draft) => store().updateFlowDraft(tabId, draft),
  }
}
