import { memo, useState } from "react"
import { FolderPlus, Plus } from "lucide-react"
import { IconButton } from "./ui/button"
import { Toolbar } from "./ui/panel"
import { TabCount, Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { CollectionTree } from "./CollectionTree"
import { HistoryList } from "./HistoryList"
import { shortcutLabel } from "../lib/platform"

const VIEW_COLLECTIONS = "collections"
const VIEW_HISTORY = "history"
const VIEW_CLASS = "flex min-h-0 flex-1 flex-col"

export const Sidebar = memo(function Sidebar({ folders, requests, requestHistory, activeRequestId, actions }) {
  const [view, setView] = useState(VIEW_COLLECTIONS)

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border">
      <Tabs value={view} onValueChange={setView} className="flex min-h-0 flex-1 flex-col">
        <Toolbar className="pr-1.5">
          <TabsList label="Sidebar view" className="flex-1">
            <TabsTrigger value={VIEW_COLLECTIONS}>Collections</TabsTrigger>
            <TabsTrigger value={VIEW_HISTORY}>
              History
              {requestHistory.length > 0 && <TabCount>{requestHistory.length}</TabCount>}
            </TabsTrigger>
          </TabsList>
          <div className="flex shrink-0 items-center gap-1">
            <IconButton label="New folder" icon={FolderPlus} onClick={() => actions.createFolder()} />
            <IconButton label={`New request (${shortcutLabel("N")})`} icon={Plus} onClick={() => actions.newRequest()} />
          </div>
        </Toolbar>

        <TabsContent value={VIEW_COLLECTIONS} className={VIEW_CLASS}>
          <CollectionTree folders={folders} requests={requests} activeRequestId={activeRequestId} actions={actions} />
        </TabsContent>
        <TabsContent value={VIEW_HISTORY} className={VIEW_CLASS}>
          <HistoryList entries={requestHistory} actions={actions} />
        </TabsContent>
      </Tabs>
    </aside>
  )
})
