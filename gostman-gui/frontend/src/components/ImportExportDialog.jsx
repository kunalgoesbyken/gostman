import { useState } from "react"
import { Dialog, DialogHeader } from "./ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { ImportTab } from "./ImportTab"
import { ExportTab } from "./ExportTab"
import { ShareTab } from "./ShareTab"

const TAB_CLASS = "flex min-h-0 flex-1 flex-col gap-3 p-4"

export function ImportExportDialog({
  initialTab,
  shareFolderId,
  shareLinkBase,
  requests,
  folders,
  environments,
  variables,
  onImport,
  onImportShared,
  onSaveFile,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState(initialTab)

  return (
    <Dialog label="Import and export" size="lg" onClose={onClose}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <DialogHeader onClose={onClose}>
          <TabsList label="Import or export">
            <TabsTrigger value="import">Import</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="share">Share</TabsTrigger>
          </TabsList>
        </DialogHeader>

        <TabsContent value="import" className={TAB_CLASS}>
          <ImportTab onImport={onImport} onImportShared={onImportShared} onClose={onClose} />
        </TabsContent>
        <TabsContent value="export" className={TAB_CLASS}>
          <ExportTab
            requests={requests}
            folders={folders}
            environments={environments}
            variables={variables}
            onSaveFile={onSaveFile}
          />
        </TabsContent>
        <TabsContent value="share" className={TAB_CLASS}>
          <ShareTab
            requests={requests}
            folders={folders}
            environments={environments}
            initialFolderId={shareFolderId}
            linkBase={shareLinkBase}
            onSaveFile={onSaveFile}
          />
        </TabsContent>
      </Tabs>
    </Dialog>
  )
}
