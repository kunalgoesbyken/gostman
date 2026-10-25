import { useState } from "react"
import { Dialog, DialogHeader } from "./ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { ImportTab } from "./ImportTab"
import { ExportTab } from "./ExportTab"
import { ShareTab } from "./ShareTab"
import { TRANSFER_TEXT } from "../lib/importText"

const TAB_CLASS = "flex min-h-0 flex-1 flex-col gap-3 p-4"

const TRANSFER_WINDOW = { id: "import-export", width: 768, height: 576, minWidth: 480, minHeight: 360 }

export function ImportExportDialog({
  initialTab,
  shareFolderId,
  shareLinkBase,
  requests,
  folders,
  environments,
  globals,
  collectionVariables,
  variables,
  variablesFor,
  settings,
  sharedOrder,
  onImport,
  onImportShared,
  openapi,
  importer,
  scan,
  onGoToRequest,
  onPickSpecFile,
  onSaveFile,
  onSaveBase64,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState(initialTab)

  return (
    <Dialog label={TRANSFER_TEXT.title} size="lg" floating={TRANSFER_WINDOW} onClose={onClose}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <DialogHeader onClose={onClose}>
          <TabsList label={TRANSFER_TEXT.tabsLabel}>
            <TabsTrigger value="import">{TRANSFER_TEXT.tabs.import}</TabsTrigger>
            <TabsTrigger value="export">{TRANSFER_TEXT.tabs.export}</TabsTrigger>
            <TabsTrigger value="share">{TRANSFER_TEXT.tabs.share}</TabsTrigger>
          </TabsList>
        </DialogHeader>

        <TabsContent value="import" className={TAB_CLASS}>
          <ImportTab openapi={openapi} importer={importer} onPickSpecFile={onPickSpecFile} onImport={onImport} onImportShared={onImportShared} onClose={onClose} />
        </TabsContent>
        <TabsContent value="export" className={`${TAB_CLASS} overflow-y-auto`}>
          <ExportTab
            requests={requests}
            folders={folders}
            environments={environments}
            globals={globals}
            collectionVariables={collectionVariables}
            variables={variables}
            variablesFor={variablesFor}
            settings={settings}
            sharedOrder={sharedOrder}
            importer={importer}
            scan={scan}
            onGoToRequest={onGoToRequest}
            onSaveFile={onSaveFile}
            onSaveBase64={onSaveBase64}
          />
        </TabsContent>
        <TabsContent value="share" className={TAB_CLASS}>
          <ShareTab
            requests={requests}
            folders={folders}
            environments={environments}
            collectionVariables={collectionVariables}
            settings={settings}
            sharedOrder={sharedOrder}
            initialFolderId={shareFolderId}
            linkBase={shareLinkBase}
            scan={scan}
            onGoToRequest={onGoToRequest}
            onSaveFile={onSaveFile}
          />
        </TabsContent>
      </Tabs>
    </Dialog>
  )
}
