import english from '../../../../locales/en/sidebar.json'
import { messages } from './i18n/core'
import { FLOW_TEXT } from './flowsText'
import { SPEC_LIST_TEXT } from './specEditorText'
import { SEARCH_TEXT } from './searchText'
import { VIEW_COLLECTIONS, VIEW_FLOWS, VIEW_HISTORY, VIEW_SEARCH, VIEW_SPECS, VIEW_TABS } from './sidebarViews.js'

const text = messages('sidebar', english)

export const SIDEBAR_TEXT = text.sidebar
export const HISTORY_TEXT = text.history

const VIEW_NAMES = {
  [VIEW_COLLECTIONS]: () => SIDEBAR_TEXT.collections,
  [VIEW_FLOWS]: () => FLOW_TEXT.sidebarTab,
  [VIEW_SPECS]: () => SPEC_LIST_TEXT.sidebarTab,
  [VIEW_HISTORY]: () => SIDEBAR_TEXT.history,
  [VIEW_TABS]: () => SIDEBAR_TEXT.openTabs,
  [VIEW_SEARCH]: () => SEARCH_TEXT.sidebarTab,
}

export const sidebarViewName = (id) => VIEW_NAMES[id]()
