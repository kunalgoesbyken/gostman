import { memo, useState } from "react"
import { Check, FolderPlus, ListChecks, Plus, RotateCcw, Settings2 } from "lucide-react"
import { IconButton } from "./ui/button"
import { ContextMenu } from "./ui/ContextMenu"
import { ResizablePane, Toolbar } from "./ui/panel"
import { TabCount, Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { CollectionTree } from "./CollectionTree"
import { HistoryList } from "./HistoryList"
import { FlowList } from "./flows/FlowList"
import { rootSettingsTitle } from "../lib/inheritance"
import { SIDEBAR_PANE } from "../lib/layout"
import { SIDEBAR_TEXT, sidebarViewName } from "../lib/sidebarText"
import { DEFAULT_SIDEBAR_VIEWS, VIEW_COLLECTIONS, VIEW_FLOWS, VIEW_HISTORY, canHideView, visibleViews, withViewVisible } from "../lib/sidebarViews"
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

export const Sidebar = memo(function Sidebar({ folders, requests, requestHistory, activeRequestId, actions }) {
  const views = usePreferences().sidebarViews
  const shown = visibleViews(views)
  const [chosen, setView] = useState(VIEW_COLLECTIONS)
  const view = shown.includes(chosen) ? chosen : shown[0]
  const [menuPosition, setMenuPosition] = useState(null)
  const newRequestShortcut = useShortcutLabel("newRequest")
  const closeSidebar = useAppStore((s) => s.closeSidebar)
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
          <TabsList
            label={SIDEBAR_TEXT.views}
            className="flex-1 gap-2"
            onContextMenu={(event) => {
              event.preventDefault()
              setMenuPosition({ x: event.clientX, y: event.clientY })
            }}
          >
            {shown.map((id) => (
              <TabsTrigger key={id} value={id}>
                {sidebarViewName(id)}
                {id === VIEW_HISTORY && requestHistory.length > 0 && <TabCount>{requestHistory.length}</TabCount>}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className={cn("flex shrink-0 items-center gap-0", view === VIEW_FLOWS && "hidden")}>
            <IconButton label={SIDEBAR_TEXT.runRequests} icon={ListChecks} onClick={() => actions.openRunner()} />
            <IconButton label={settingsLabel} icon={Settings2} onClick={() => actions.openFolderSettings()} />
            <IconButton label={SIDEBAR_TEXT.newFolder} icon={FolderPlus} onClick={() => actions.createFolder()} />
            <IconButton label={hintWithShortcut(SIDEBAR_TEXT.newRequest, newRequestShortcut)} icon={Plus} onClick={() => actions.newRequest()} />
          </div>
        </Toolbar>

        <TabsContent value={VIEW_COLLECTIONS} className={VIEW_CLASS}>
          <CollectionTree folders={folders} requests={requests} activeRequestId={activeRequestId} actions={actions} />
        </TabsContent>
        <TabsContent value={VIEW_FLOWS} className={VIEW_CLASS}>
          <FlowList actions={actions.flows} />
        </TabsContent>
        <TabsContent value={VIEW_HISTORY} className={VIEW_CLASS}>
          <HistoryList entries={requestHistory} actions={actions} />
        </TabsContent>
      </Tabs>
      {menuPosition && <ContextMenu position={menuPosition} title={SIDEBAR_TEXT.viewsMenu} items={viewMenuItems(views)} onClose={() => setMenuPosition(null)} />}
    </ResizablePane>
  )
})
