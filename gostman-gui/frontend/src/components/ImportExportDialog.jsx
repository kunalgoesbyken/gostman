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
  settings,
  onImport,
  onImportShared,
  openapi,
  importer,
  onPickSpecFile,
  onSaveFile,
  onSaveBase64,
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
          <ImportTab openapi={openapi} importer={importer} onPickSpecFile={onPickSpecFile} onImport={onImport} onImportShared={onImportShared} onClose={onClose} />
        </TabsContent>
        <TabsContent value="export" className={TAB_CLASS}>
          <ExportTab
            requests={requests}
            folders={folders}
            environments={environments}
            variables={variables}
            settings={settings}
            importer={importer}
            onSaveFile={onSaveFile}
            onSaveBase64={onSaveBase64}
          />
        </TabsContent>
        <TabsContent value="share" className={TAB_CLASS}>
          <ShareTab
            requests={requests}
            folders={folders}
            environments={environments}
            settings={settings}
            initialFolderId={shareFolderId}
            linkBase={shareLinkBase}
            onSaveFile={onSaveFile}
          />
        </TabsContent>
      </Tabs>
    </Dialog>
  )
}
