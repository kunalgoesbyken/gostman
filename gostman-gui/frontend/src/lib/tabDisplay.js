import { TAB_BAR_TEXT } from './tabBarText'
import { FLOW_TEXT } from './flowsText'
import { isFlowDirty } from './flows/edit'
import { isRequestDirty } from './requestChanges'
import { isSpecDirty } from './specDocument'
import { SPEC_EDITOR_TEXT } from './specEditorText'

const draftOf = (tab) => tab.flowDraft ?? tab.specDraft

export const tabTitle = (tab) => (draftOf(tab)?.name ?? (tab.request.name || tab.request.url)) || TAB_BAR_TEXT.untitled

export const tabHint = (tab) => {
  const title = tabTitle(tab)
  if (tab.flowId) return FLOW_TEXT.tabLabel(title)
  if (tab.specId) return SPEC_EDITOR_TEXT.tabLabel({ name: title })
  return tab.request.url ? `${title}\n${tab.request.url}` : title
}

export function isTabDirty(tab, saved) {
  if (tab.flowId) return isFlowDirty(tab.flowDraft, saved)
  if (tab.specId) return isSpecDirty(tab.specDraft, saved)
  return isRequestDirty(tab.request, saved)
}

export function savedForTab(tab, { requests, flows, specs }) {
  if (tab.flowId) return flows.get(tab.flowId)
  if (tab.specId) return specs.get(tab.specId)
  return requests.get(tab.request.id)
}
