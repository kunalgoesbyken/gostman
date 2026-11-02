import { memo, useEffect, useState } from "react"
import { Check, FolderPlus, ListChecks, Plus, RotateCcw, Settings2 } from "lucide-react"
import { IconButton } from "./ui/button"
import { ContextMenu } from "./ui/ContextMenu"
import { ResizablePane, Toolbar } from "./ui/panel"
import { OverflowTabsList, TabCount, Tabs, TabsContent } from "./ui/tabs"
import { CollectionTree } from "./CollectionTree"
import { GlobalSearch } from "./GlobalSearch"
import { HistoryList } from "./HistoryList"
import { OpenTabsList } from "./OpenTabsList"
import { FlowList } from "./flows/FlowList"
import { rootSettingsTitle } from "../lib/inheritance"
import { SIDEBAR_PANE, isNarrowViewport } from "../lib/layout"
import { SIDEBAR_TEXT, sidebarViewName } from "../lib/sidebarText"
import { DEFAULT_SIDEBAR_VIEWS, VIEW_COLLECTIONS, VIEW_FLOWS, VIEW_HISTORY, VIEW_SEARCH, VIEW_TABS, canHideView, visibleViews, withViewVisible } from "../lib/sidebarViews"
import { updatePreferences, usePreferences } from "../lib/preferences"
import { cn } from "../lib/utils"
import { useShortcutLabel } from "../hooks/useShortcuts"
import { EDGE_END } from "../hooks/usePaneResize"
import { hintWithShortcut } from "../lib/shortcuts"
import { useAppStore } from "../store/appStore"

const VIEW_CLASS = "flex min-h-0 flex-1 flex-col"

const Unchecked = ({ className }) => <span aria-hidden="true" className={className} />

function viewMenuItems(views) {
  const toggles = views.map((entry) => ({
    label: sidebarViewName(entry.id),
    icon: entry.visible ? Check : Unchecked,
    disabled: entry.visible && !canHideView(views, entry.id),
    keepOpen: true,
    onSelect: () => updatePreferences({ sidebarViews: withViewVisible(views, entry.id, !entry.visible) }),
  }))
  return [...toggles, { label: SIDEBAR_TEXT.resetViews, icon: RotateCcw, onSelect: () => updatePreferences({ sidebarViews: DEFAULT_SIDEBAR_VIEWS }) }]
}

const viewCount = (id, tabCount, historyCount) => {
  if (id === VIEW_TABS) return tabCount
  return id === VIEW_HISTORY ? historyCount : 0
}

function viewItems(shown, tabCount, historyCount) {
  return shown.map((id) => {
    const count = viewCount(id, tabCount, historyCount)
    const name = sidebarViewName(id)
    return { value: id, label: name, detail: count > 0 ? count : undefined, content: <>{name}{count > 0 && <TabCount>{count}</TabCount>}</> }
  })
}

export const Sidebar = memo(function Sidebar({ folders, requests, requestHistory, activeRequestId, actions, tabs, activeTabId, onTabSelect, onTabClose }) {
  const { sidebarViews: views, tabPlacement } = usePreferences()
  const listsTabs = tabPlacement === "sidebar"
  const shown = listsTabs ? [VIEW_TABS, ...visibleViews(views)] : visibleViews(views)
  const [chosen, setView] = useState(VIEW_COLLECTIONS)
  const viewRequest = useAppStore((s) => s.sidebarViewRequest)
  useEffect(() => {
    if (viewRequest) setView(viewRequest.view)
  }, [viewRequest])
  const view = shown.includes(chosen) ? chosen : shown[0]
  const [menuPosition, setMenuPosition] = useState(null)
  const newRequestShortcut = useShortcutLabel("newRequest")
  const closeSidebar = useAppStore((s) => s.closeSidebar)
  const searchNonce = useAppStore((s) => s.globalSearch.nonce)
  useEffect(() => {
    if (searchNonce === 0) return
    if (!visibleViews(views).includes(VIEW_SEARCH)) updatePreferences({ sidebarViews: withViewVisible(views, VIEW_SEARCH, true) })
    setView(VIEW_SEARCH)
  }, [searchNonce])
  const selectTab = (tabId) => {
    onTabSelect(tabId)
    if (isNarrowViewport()) closeSidebar()
  }
  const settingsLabel = useAppStore((s) => rootSettingsTitle(s.workspaceStatus.path))

  return (
    <ResizablePane
      as="aside"
      pane={SIDEBAR_PANE}
      edge={EDGE_END}
      label={SIDEBAR_TEXT.resize}
      onClose={closeSidebar}
      handleClassName="max-md:hidden"
      data-pane="sidebar"
      className="flex w-72 max-w-full shrink-0 flex-col border-e border-border max-md:absolute max-md:inset-y-0 max-md:start-0 max-md:z-30 max-md:bg-background max-md:shadow-lg md:relative md:w-[var(--sidebar-width)]"
    >
      <Tabs value={view} onValueChange={setView} className="flex min-h-0 flex-1 flex-col">
        <Toolbar className="ps-2 pe-1">
          <div
            className="flex min-w-0 flex-1"
            onContextMenu={(event) => {
              event.preventDefault()
              setMenuPosition({ x: event.clientX, y: event.clientY })
            }}
          >
            <OverflowTabsList label={SIDEBAR_TEXT.views} items={viewItems(shown, tabs.length, requestHistory.length)} moreLabel={SIDEBAR_TEXT.more} moreHint={SIDEBAR_TEXT.moreHint} />
          </div>
          <div className={cn("flex shrink-0 items-center gap-0", view === VIEW_FLOWS && "hidden")}>
            <IconButton label={SIDEBAR_TEXT.runRequests} icon={ListChecks} onClick={() => actions.openRunner()} />
            <IconButton label={settingsLabel} icon={Settings2} onClick={() => actions.openFolderSettings()} />
            <IconButton label={SIDEBAR_TEXT.newFolder} icon={FolderPlus} onClick={() => actions.createFolder()} />
            <IconButton label={hintWithShortcut(SIDEBAR_TEXT.newRequest, newRequestShortcut)} icon={Plus} onClick={() => actions.newRequest()} />
          </div>
        </Toolbar>

        <TabsContent value={VIEW_TABS} className={VIEW_CLASS}>
          <OpenTabsList tabs={tabs} activeTabId={activeTabId} requests={requests} actions={actions} onSelect={selectTab} onClose={onTabClose} />
        </TabsContent>
        <TabsContent value={VIEW_COLLECTIONS} className={VIEW_CLASS}>
          <CollectionTree folders={folders} requests={requests} activeRequestId={activeRequestId} actions={actions} />
        </TabsContent>
        <TabsContent value={VIEW_FLOWS} className={VIEW_CLASS}>
          <FlowList actions={actions.flows} onMonitor={actions.monitorFlow} />
        </TabsContent>
        <TabsContent value={VIEW_SEARCH} className={VIEW_CLASS}>
          <GlobalSearch requests={requests} history={requestHistory} tabs={tabs} actions={actions} />
        </TabsContent>
        <TabsContent value={VIEW_HISTORY} className={VIEW_CLASS}>
          <HistoryList entries={requestHistory} actions={actions} />
        </TabsContent>
      </Tabs>
      {menuPosition && <ContextMenu position={menuPosition} title={SIDEBAR_TEXT.viewsMenu} items={viewMenuItems(views)} onClose={() => setMenuPosition(null)} />}
    </ResizablePane>
  )
})
