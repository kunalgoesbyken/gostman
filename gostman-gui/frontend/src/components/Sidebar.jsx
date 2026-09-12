import React, { memo } from "react"
import { Plus, Trash2, FileJson, Search, Clock, RotateCcw, Zap, Folder, FolderOpen, ChevronRight, ChevronDown, FolderPlus } from "lucide-react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Input } from "./ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { cn } from "../lib/utils"
import { METHOD_VARIANTS } from "../lib/constants"

function formatRelativeTime(isoString) {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

const EmptyState = memo(({ icon: Icon, title, description, variant = "default" }) => {
  const colorVariants = {
    default: {
      bg: "bg-primary/10",
      gradient: "from-primary/20 to-primary/5",
      border: "border-primary/10",
      shadow: "shadow-primary/5",
      text: "text-primary",
      animate: false
    },
    blue: {
      bg: "bg-info/10",
      gradient: "from-info/20 to-info/5",
      border: "border-info/10",
      shadow: "shadow-info/5",
      text: "text-info",
      animate: true
    }
  }
  const colors = colorVariants[variant] || colorVariants.default

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 relative">
        <div className={`absolute inset-0 ${colors.bg} rounded-full blur-xl scale-150 ${colors.animate ? 'animate-pulse' : ''}`} />
        <div className={`relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${colors.gradient} border ${colors.border} shadow-lg ${colors.shadow}`}>
          <Icon className={`h-7 w-7 ${colors.text}`} />
        </div>
      </div>
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  )
})

export const Sidebar = memo(function Sidebar({
  requests = [],
  folders = [],
  requestHistory = [],
  activeRequest,
  onSelectRequest,
  onSelectHistoryItem,
  onDeleteHistoryItem,
  onClearHistory,
  onNewRequest,
  onDeleteRequest,
  onCreateFolder,
  onDeleteFolder,
  onToggleFolder,
  onNewRequestInFolder
}) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [historySearchQuery, setHistorySearchQuery] = React.useState("")

  // Check if history features are enabled
  const hasHistoryFeatures = onSelectHistoryItem && onDeleteHistoryItem && onClearHistory

  // Filter logic
  const filteredRequests = (requests || []).filter(req =>
    req.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    req.url?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredHistory = hasHistoryFeatures ? (requestHistory || []).filter(req =>
    req.url?.toLowerCase().includes(historySearchQuery.toLowerCase())
  ) : []

  // Group requests by folder
  const folderRequests = folders.map(folder => ({
    ...folder,
    requests: filteredRequests.filter(req => req.folderId === folder.id)
  }))

  const rootRequests = filteredRequests.filter(req => !req.folderId)

  return (
    <div className="flex h-full w-64 flex-col border-r border-border/60 bg-gradient-to-b from-background via-background to-muted/20">
      {/* Toolbar */}
      <div className="border-b border-border/60 px-4 py-2 flex items-center justify-between bg-muted/20">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Explorer</span>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={onCreateFolder}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="New Folder"
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onNewRequest}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="New request (Ctrl+N)"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="collections" className="flex flex-1 flex-col">
        <TabsList className={`grid ${hasHistoryFeatures ? 'grid-cols-2' : 'grid-cols-1'} rounded-none border-b border-border/60 bg-transparent p-0`}>
          <TabsTrigger value="collections" className="gap-1.5 text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5">
            <FileJson className="h-3.5 w-3.5" />
            Collections
          </TabsTrigger>
          {hasHistoryFeatures && (
            <TabsTrigger value="history" className="gap-1.5 text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-primary/5">
              <Clock className="h-3.5 w-3.5" />
              History
              {requestHistory?.length > 0 && (
                <Badge variant="secondary" className="ml-auto h-4.5 px-1.5 text-[10px] font-medium bg-primary/10 text-primary border-primary/20">
                  {requestHistory.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Collections Tab */}
        <TabsContent value="collections" className="flex flex-1 flex-col overflow-hidden p-0 m-0">
          <div className="border-b border-border/60 px-3 py-2.5 bg-muted/20">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-sm bg-background border-border/50 focus-visible:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {filteredRequests.length === 0 && folders.length === 0 ? (
              <EmptyState
                icon={searchQuery ? Search : FileJson}
                title={searchQuery ? "No results" : "No requests yet"}
                description={searchQuery ? "Try different terms" : "Press Ctrl+N to start"}
                variant="default"
              />
            ) : (
              <div className="p-2 space-y-0.5">
                {/* Render Folders */}
                {folderRequests.map(folder => (
                  <div key={folder.id} className="mb-1">
                    <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-accent/40 cursor-pointer group"
                      onClick={() => onToggleFolder(folder.id)}>
                      {folder.isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      {folder.isOpen ? <FolderOpen className="h-4 w-4 text-warning" /> : <Folder className="h-4 w-4 text-warning/70" />}
                      <span className="flex-1 text-sm font-medium truncate">{folder.name}</span>

                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => {
                          e.stopPropagation()
                          onNewRequestInFolder(folder.id)
                        }} title="Add request to folder">
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={(e) => {
                          e.stopPropagation()
                          onDeleteFolder(folder.id)
                        }} title="Delete folder">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Folder Contents */}
                    {folder.isOpen && (
                      <div className="ml-4 pl-2 border-l border-border/40 mt-1 space-y-0.5">
                        {folder.requests.length === 0 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground italic">No requests</div>
                        )}
                        {folder.requests.map(req => (
                          <RequestItem
                            key={req.id}
                            req={req}
                            activeRequest={activeRequest}
                            onSelectRequest={onSelectRequest}
                            onDeleteRequest={onDeleteRequest}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Render Root Requests */}
                {rootRequests.map(req => (
                  <RequestItem
                    key={req.id}
                    req={req}
                    activeRequest={activeRequest}
                    onSelectRequest={onSelectRequest}
                    onDeleteRequest={onDeleteRequest}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
        {hasHistoryFeatures && (
          <TabsContent value="history" className="flex flex-1 flex-col overflow-hidden p-0 m-0">
            <div className="border-b border-border/60 px-3 py-2.5 bg-muted/20">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search history..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="h-8 pl-8 text-sm bg-background border-border/50 focus-visible:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {filteredHistory.length === 0 ? (
                <EmptyState
                  icon={historySearchQuery ? Search : Zap}
                  title={historySearchQuery ? "No history found" : "No request history"}
                  description={historySearchQuery ? "Try different search terms" : "Sent requests appear here automatically"}
                  variant="blue"
                />
              ) : (
                <div className="p-2 space-y-0.5">
                  {filteredHistory.map((req, idx) => (
                    <div
                      key={req.id}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all duration-200",
                        "hover:bg-accent/60 cursor-pointer"
                      )}
                      onClick={() => onSelectHistoryItem(req)}
                    >
                      <Badge
                        variant={METHOD_VARIANTS[req.method] || "default"}
                        className="shrink-0 font-mono text-[10px] px-1.5 py-0.5"
                      >
                        {req.method}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {req.url}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
                          <span className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {formatRelativeTime(req.timestamp)}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn(
                          "h-6 w-6 shrink-0 opacity-0 transition-all duration-200",
                          "group-hover:opacity-100",
                          "hover:bg-destructive/20 hover:text-destructive"
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteHistoryItem(req.id)
                        }}
                        title="Delete from history"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Clear History */}
            {requestHistory?.length > 0 && (
              <div className="border-t border-border/60 px-3 py-2 bg-muted/20">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearHistory}
                  className="w-full gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  Clear all history
                </Button>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
})

const RequestItem = memo(function RequestItem({ req, activeRequest, onSelectRequest, onDeleteRequest }) {
  return (
    <div
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all duration-200",
        "hover:bg-accent/60 cursor-pointer",
        activeRequest.id === req.id && "bg-accent shadow-sm transition-shadow"
      )}
      onClick={() => onSelectRequest(req)}
    >
      <Badge
        variant={METHOD_VARIANTS[req.method] || "default"}
        className="shrink-0 font-mono text-[10px] px-1.5 py-0.5"
      >
        {req.method}
      </Badge>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">
          {req.name || "Untitled Request"}
        </div>
        {req.url && (
          <div className="truncate text-xs text-muted-foreground/80">
            {req.url}
          </div>
        )}
      </div>
      <Button
        size="icon"
        variant="ghost"
        className={cn(
          "h-6 w-6 shrink-0 opacity-0 transition-all duration-200",
          "group-hover:opacity-100",
          "hover:bg-destructive/20 hover:text-destructive"
        )}
        onClick={(e) => {
          e.stopPropagation()
          onDeleteRequest(req.id)
        }}
        title="Delete request"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
      {activeRequest.id === req.id && (
        <div className="absolute left-0 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-full bg-primary shadow-lg shadow-primary/50" />
      )}
    </div>
  )
})
