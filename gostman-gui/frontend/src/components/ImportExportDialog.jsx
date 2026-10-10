import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { Button } from "./ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { ImportTab } from "./ImportTab"
import { ExportTab } from "./ExportTab"

export function ImportExportDialog({
  initialTab,
  requests,
  folders,
  environments,
  variables,
  onImport,
  onSaveFile,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState(initialTab)

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Import and export"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl"
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
            <TabsList>
              <TabsTrigger value="import">Import</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
            </TabsList>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <TabsContent value="import" noMargin>
              <ImportTab onImport={onImport} onClose={onClose} />
            </TabsContent>
            <TabsContent value="export" noMargin>
              <ExportTab
                requests={requests}
                folders={folders}
                environments={environments}
                variables={variables}
                onSaveFile={onSaveFile}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
