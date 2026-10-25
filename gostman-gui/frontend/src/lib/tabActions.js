import { generateAllSnippets } from './codeGenerator'
import { isGrpcRequest } from './grpc'
import { withInheritance } from './inheritance'
import { isMcpRequest } from './mcp'
import { getPreferences } from './preferences'
import { isRequestDirty } from './requestChanges'
import { tabsToClose } from './tabOrder'
import { TAB_TEXT } from './treeText'
import { FLOW_TEXT } from './flowsText'
import { isFlowTab, useAppStore, variableTextFor } from '../store/appStore'

const DESTRUCTIVE = 'destructive'

const store = () => useAppStore.getState()

const savedFor = (tab) => store().requests.find((request) => request.id === tab.request.id)

export function createTabActions(backend, attempt, cancelTab, flows) {
  const isDirty = (tab) => (isFlowTab(tab) ? flows.isDirty(tab) : isRequestDirty(tab.request, savedFor(tab)))

  const closeAll = (tabs) => {
    tabs.forEach(cancelTab)
    tabs.filter(isFlowTab).forEach((tab) => flows.discard(tab.id))
    store().closeTabs(tabs.map((tab) => tab.id))
  }

  function closeMany(tabs) {
    const unsaved = tabs.filter(isDirty)
    if (unsaved.length === 0 || !getPreferences().confirmCloseTab) {
      closeAll(tabs)
      return
    }
    store().showConfirm(
      TAB_TEXT.closeTabsTitle,
      TAB_TEXT.closeTabsMessage(unsaved.length),
      () => closeAll(tabs),
      null,
      DESTRUCTIVE,
      TAB_TEXT.discard,
    )
  }

  const closeGroup = (tabId, scope) => {
    const targets = tabsToClose(store().tabs, tabId, scope, (tab) => !isDirty(tab))
    if (targets.length > 0) closeMany(targets)
  }

  const copyCurl = attempt(TAB_TEXT.curlFailed, async (tabId) => {
    const tab = store().tabs.find((candidate) => candidate.id === tabId)
    if (isFlowTab(tab)) throw new Error(FLOW_TEXT.noCurl)
    if (!tab || isGrpcRequest(tab.request) || isMcpRequest(tab.request)) throw new Error(TAB_TEXT.noCurl)
    if (!navigator.clipboard) throw new Error(TAB_TEXT.noClipboard)
    const prepared = await backend.prepare(withInheritance(store(), tab.request), variableTextFor(store(), tab.request))
    await navigator.clipboard.writeText(generateAllSnippets(prepared).curl)
    store().showNotice(TAB_TEXT.curlCopied)
  })

  const reveal = (tabId) => {
    const tab = store().tabs.find((candidate) => candidate.id === tabId)
    if (tab && savedFor(tab)) store().revealRequest(tab.request.id)
  }

  return {
    closeOthers: (tabId) => closeGroup(tabId, 'others'),
    closeRight: (tabId) => closeGroup(tabId, 'right'),
    closeSaved: () => closeGroup(store().activeTabId, 'saved'),
    pin: (tabId) => store().pinTab(tabId),
    pinActive: () => store().pinTab(store().activeTabId),
    step: (tabId, step) => store().stepTab(tabId, step),
    reorder: (tabId, targetId, place) => store().moveTab(tabId, targetId, place),
    reveal,
    copyCurl,
    canReveal: (tab) => !isFlowTab(tab) && Boolean(savedFor(tab)),
  }
}
