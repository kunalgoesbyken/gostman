import { memo, useState } from "react"
import { FolderPlus, ListChecks, Plus, Settings2 } from "lucide-react"
import { IconButton } from "./ui/button"
import { Toolbar } from "./ui/panel"
import { TabCount, Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { CollectionTree } from "./CollectionTree"
import { HistoryList } from "./HistoryList"
import { rootSettingsTitle } from "../lib/inheritance"
import { SIDEBAR_TEXT } from "../lib/sidebarText"
import { cn } from "../lib/utils"
import { useShortcutLabel } from "../hooks/useShortcuts"
import { RESIZE_CLOSING, RESIZE_IDLE, useSidebarResize } from "../hooks/useSidebarResize"
import { hintWithShortcut } from "../lib/shortcuts"
import { useAppStore } from "../store/appStore"

const VIEW_COLLECTIONS = "collections"
const VIEW_HISTORY = "history"
const VIEW_CLASS = "flex min-h-0 flex-1 flex-col"

function SidebarResizer({ phase, separatorProps }) {
  return (
    <div
      {...separatorProps}
      aria-label={SIDEBAR_TEXT.resize}
      data-active={phase !== RESIZE_IDLE || undefined}
      className="group absolute inset-y-0 -right-1 z-10 flex w-2 cursor-col-resize touch-none justify-center outline-none max-md:hidden"
    >
      <span className="h-full w-0.5 transition-colors group-hover:bg-ring group-hover:delay-150 group-focus-visible:bg-ring group-data-[active]:bg-ring" />
    </div>
  )
}

export const Sidebar = memo(function Sidebar({ folders, requests, requestHistory, activeRequestId, actions }) {
  const [view, setView] = useState(VIEW_COLLECTIONS)
  const newRequestShortcut = useShortcutLabel("newRequest")
  const closeSidebar = useAppStore((s) => s.closeSidebar)
  const settingsLabel = useAppStore((s) => rootSettingsTitle(s.workspaceStatus.path))
  const { asideRef, style, phase, separatorProps } = useSidebarResize(closeSidebar)

  return (
    <aside
      ref={asideRef}
      data-pane="sidebar"
      style={style}
      className={cn(
        "flex w-72 max-w-full shrink-0 flex-col border-r border-border transition-opacity max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:bg-background max-md:shadow-lg md:relative md:w-[var(--sidebar-width)]",
        phase === RESIZE_CLOSING && "opacity-50"
      )}
    >
      <Tabs value={view} onValueChange={setView} className="flex min-h-0 flex-1 flex-col">
        <Toolbar className="pr-1.5">
          <TabsList label={SIDEBAR_TEXT.views} className="flex-1">
            <TabsTrigger value={VIEW_COLLECTIONS}>{SIDEBAR_TEXT.collections}</TabsTrigger>
            <TabsTrigger value={VIEW_HISTORY}>
              {SIDEBAR_TEXT.history}
              {requestHistory.length > 0 && <TabCount>{requestHistory.length}</TabCount>}
            </TabsTrigger>
          </TabsList>
          <div className="flex shrink-0 items-center gap-0">
            <IconButton label={SIDEBAR_TEXT.runRequests} icon={ListChecks} onClick={() => actions.openRunner()} />
            <IconButton label={settingsLabel} icon={Settings2} onClick={() => actions.openFolderSettings()} />
            <IconButton label={SIDEBAR_TEXT.newFolder} icon={FolderPlus} onClick={() => actions.createFolder()} />
            <IconButton label={hintWithShortcut(SIDEBAR_TEXT.newRequest, newRequestShortcut)} icon={Plus} onClick={() => actions.newRequest()} />
          </div>
        </Toolbar>

        <TabsContent value={VIEW_COLLECTIONS} className={VIEW_CLASS}>
          <CollectionTree folders={folders} requests={requests} activeRequestId={activeRequestId} actions={actions} />
        </TabsContent>
        <TabsContent value={VIEW_HISTORY} className={VIEW_CLASS}>
          <HistoryList entries={requestHistory} actions={actions} />
        </TabsContent>
      </Tabs>
      <SidebarResizer phase={phase} separatorProps={separatorProps} />
    </aside>
  )
})
