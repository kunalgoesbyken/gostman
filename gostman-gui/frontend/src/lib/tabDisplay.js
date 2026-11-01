import { TAB_BAR_TEXT } from './tabBarText'
import { FLOW_TEXT } from './flowsText'
import { isFlowDirty } from './flows/edit'
import { isRequestDirty } from './requestChanges'

export const tabTitle = (tab) => (tab.flowId ? tab.flowDraft.name : tab.request.name || tab.request.url) || TAB_BAR_TEXT.untitled

export const tabHint = (tab) => {
  const title = tabTitle(tab)
  if (tab.flowId) return FLOW_TEXT.tabLabel(title)
  return tab.request.url ? `${title}\n${tab.request.url}` : title
}

export const isTabDirty = (tab, saved) => (tab.flowId ? isFlowDirty(tab.flowDraft, saved) : isRequestDirty(tab.request, saved))

export const savedForTab = (tab, requestsById, flowsById) => (tab.flowId ? flowsById.get(tab.flowId) : requestsById.get(tab.request.id))
