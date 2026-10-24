import { useEffect, useMemo, useRef, useState } from "react"
import {
  Bookmark, ChevronsDownUp, ClipboardPaste, Gauge, Clock, MonitorDown, Info, Hand, Folder, FolderOpen, Code, Cookie, Copy, Download, FileText, FolderPlus, Globe, History, Keyboard, ListChecks, PanelLeft, Pin, Plus, Radio, Save, Search, Send,
  Bot, Server, Settings, Share2, ShieldAlert, ShieldCheck, SlidersHorizontal, Trash2, Undo2, Upload, X,
} from "lucide-react"
import { MethodTag } from "../MethodTag"
import { fuzzyScore } from "../../lib/fuzzy"
import { PREFERENCES_TEXT } from "../../lib/preferencesText"
import { ABOUT_TEXT } from "../../lib/aboutText"
import { DATA_TEXT } from "../../lib/dataText"
import { INSTALL_TEXT } from "../../lib/installText"
import { SCAN_TEXT } from "../../lib/scanText"
import { useInstallable } from "../../lib/pwa"
import { LOAD_TEST_TEXT } from "../../lib/loadTestText"
import { WELCOME_TEXT } from "../../lib/welcomeText"
import { AI_TEXT } from "../../lib/aiText"
import { WORKSPACE_TEXT } from "../../lib/workspaceText"
import { TREE_TEXT } from "../../lib/treeText"
import { useShortcutLabel } from "../../hooks/useShortcuts"
import { cn } from "../../lib/utils"

const aiCommand = (id, text, action, extra = {}) => ({ id, label: text.label, description: text.description, keywords: text.keywords, icon: Bot, action, ...extra })

const AI_SETTINGS_COMMAND = aiCommand("ai-settings", AI_TEXT.commands.settings, "aiSettings", { icon: Settings })

const AI_COMMANDS = [
  aiCommand("ai-request", AI_TEXT.commands.request, "aiRequest", { shortcutId: "aiGenerate" }),
  aiCommand("ai-tests", AI_TEXT.commands.tests, "aiTests"),
  aiCommand("ai-script", AI_TEXT.commands.script, "aiScript"),
  aiCommand("ai-explain", AI_TEXT.commands.explain, "aiExplain", { shortcutId: "aiExplain" }),
  aiCommand("ai-docs", AI_TEXT.commands.docs, "aiDocs"),
  aiCommand("ai-search", AI_TEXT.commands.search, "aiSearch"),
  aiCommand("ai-schema", AI_TEXT.commands.schema, "aiSchema"),
]

const COMMANDS = [
  { id: "send-request", label: "Send request", description: "Send the request in the current tab", icon: Send, shortcutId: "sendRequest", action: "sendRequest" },
  { id: "new-request", label: "New request", description: "Open a new empty tab", icon: Plus, shortcutId: "newRequest", action: "newRequest" },
  { id: "save-request", label: "Save request", description: "Save the request in the current tab", icon: Save, shortcutId: "saveRequest", action: "saveRequest" },
  { id: "duplicate-request", label: "Duplicate request", description: "Save a copy of the current request", icon: Copy, action: "duplicateRequest" },
  { id: "copy-request", label: "Copy request", description: "Copy the saved request to paste it into a folder", icon: Copy, action: "copyRequest" },
  { id: "paste-request", label: "Paste request", description: "Paste the copied request or folder next to the current request", icon: ClipboardPaste, action: "pasteRequest" },
  { id: "generate-code", label: "Generate code", description: "Show the current request as code", icon: Code, action: "generateCode" },
  { id: "close-tab", label: "Close tab", description: "Close the current tab", icon: X, shortcutId: "closeTab", action: "closeTab" },
  { id: "close-other-tabs", label: "Close other tabs", description: "Keep only the current tab", icon: X, shortcutId: "closeOtherTabs", action: "closeOtherTabs" },
  { id: "close-saved-tabs", label: "Close saved tabs", description: "Close every tab without unsaved changes", icon: X, shortcutId: "closeSavedTabs", action: "closeSavedTabs" },
  { id: "keep-tab", label: "Keep preview tab open", description: "Turn the preview tab into a regular tab", icon: Pin, shortcutId: "keepTab", action: "keepTab" },
  { id: "reopen-tab", label: "Reopen closed tab", description: "Bring back the tab you closed last", icon: Undo2, shortcutId: "reopenTab", action: "reopenTab" },
  { id: "toggle-sidebar", label: "Toggle sidebar", description: "Show or hide collections and history", icon: PanelLeft, shortcutId: "toggleSidebar", action: "toggleSidebar" },
  { id: "keyboard-shortcuts", label: "Keyboard shortcuts", description: "See every shortcut", icon: Keyboard, keywords: "?", shortcutId: "shortcutsHelp", action: "shortcuts" },
  { id: "new-folder", label: "New folder", description: "Create a folder at the top level", icon: FolderPlus, action: "newFolder" },
  { id: "collapse-folders", label: TREE_TEXT.collapseAll, description: TREE_TEXT.collapseAllDescription, icon: ChevronsDownUp, keywords: "close fold tree", action: "collapseFolders" },
  { id: "run-collection", label: "Run requests", description: "Run every request in a folder with its tests", icon: ListChecks, action: "runCollection" },
  { id: "examples", label: "Request examples", description: "See the saved responses of the current request", icon: Bookmark, action: "examples" },
  { id: "mock-server", label: "Mock server", description: "Serve saved examples on a local port", icon: Server, action: "mockServer" },
  { id: "capture", label: "Capture traffic", description: "Forward an app's calls to its API and save them as requests", icon: Radio, action: "captureTraffic" },
  { id: "cookies", label: "Manage cookies", description: "See and delete stored cookies", icon: Cookie, action: "cookies" },
  { id: "scan-secrets", label: SCAN_TEXT.title, description: SCAN_TEXT.commandDescription, icon: ShieldAlert, keywords: "credentials tokens passwords leak", action: "scanSecrets" },
  { id: "preferences", label: PREFERENCES_TEXT.title, description: PREFERENCES_TEXT.commandDescription, icon: SlidersHorizontal, action: "preferences" },
  { id: "network", label: "Network settings", description: "Proxy and certificates", icon: Settings, action: "settings" },
  { id: "import", label: "Import data", description: "Import Postman, OpenAPI or Gostman files", icon: Upload, action: "import" },
  { id: "lint-spec", label: "Lint API spec", description: "Check the imported OpenAPI spec for problems", icon: ShieldCheck, keywords: "openapi swagger validate governance", action: "lintSpec" },
  { id: "export", label: "Export data", description: "Export collections and environments", icon: Download, action: "export" },
  { id: "share", label: "Share collection", description: "Create an encrypted link or file, no account needed", icon: Share2, action: "share" },
  AI_SETTINGS_COMMAND,
  { id: "clear-history", label: "Clear history", description: "Delete every history entry", icon: History, action: "clearHistory" },
  { id: "welcome", label: WELCOME_TEXT.commandTitle, description: WELCOME_TEXT.commandDescription, icon: Hand, action: "showWelcome" },
  { id: "about", label: ABOUT_TEXT.commandTitle, description: ABOUT_TEXT.commandDescription, icon: Info, action: "about" },
  { id: "reset", label: DATA_TEXT.commandTitle, description: DATA_TEXT.commandDescription, icon: Trash2, keywords: DATA_TEXT.commandKeywords, action: "reset", destructive: true },
]

const LOAD_TEST_COMMAND = { id: "load-test", label: LOAD_TEST_TEXT.commandTitle, description: LOAD_TEST_TEXT.commandDescription, icon: Gauge, keywords: "performance stress", action: "loadTest" }

const workspaceCommands = (workspaces) => {
  if (!workspaces) return []
  const switcher = [
    { id: "workspace-switcher", label: WORKSPACE_TEXT.switcherCommand, description: WORKSPACE_TEXT.switcherDescription, icon: FolderOpen, shortcutId: "workspaceSwitcher", action: "workspaceSwitcher" },
    { id: "workspace-open", label: WORKSPACE_TEXT.openFolder, description: WORKSPACE_TEXT.switcherDescription, icon: FolderOpen, action: "openFolder" },
  ]
  const others = workspaces
    .filter((workspace) => !workspace.current && !workspace.missing)
    .map((workspace) => ({
      id: `workspace-${workspace.path}`,
      label: WORKSPACE_TEXT.switchTo(workspace.name),
      description: WORKSPACE_TEXT.switchDescription,
      icon: Folder,
      action: "switchWorkspace",
      payload: workspace.path,
    }))
  return [...switcher, ...others]
}

const SELECTION_STEPS = { ArrowDown: 1, ArrowUp: -1 }
const MAX_REQUEST_RESULTS = 12
const MAX_HISTORY_RESULTS = 6
const MAX_RECENT_REQUESTS = 30
const PATH_SEPARATOR = " / "
const UNTITLED = "Untitled request"
const NAME_MATCH_BONUS = 20

const KIND_COMMAND = "command"
const KIND_REQUEST = "request"
const KIND_HISTORY = "history"
const SECTION_TITLES = { [KIND_COMMAND]: "Commands", [KIND_REQUEST]: "Requests", [KIND_HISTORY]: "History" }

const environmentCommands = (environments, activeEnvironmentId) => environments
  .filter((environment) => environment.id !== activeEnvironmentId)
  .map((environment) => ({
    id: `environment-${environment.id}`,
    label: `Switch environment: ${environment.name}`,
    description: "Use this environment's variables",
    icon: Globe,
    action: "switchEnvironment",
    payload: environment.id,
  }))

const folderPathOf = (folders) => {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  return (folderId) => {
    const names = []
    const seen = new Set()
    for (let folder = byId.get(folderId); folder && !seen.has(folder.id); folder = byId.get(folder.parentId)) {
      seen.add(folder.id)
      names.unshift(folder.name)
    }
    return names.join(PATH_SEPARATOR)
  }
}

const requestItems = (requests, folders) => {
  const pathOf = folderPathOf(folders)
  return requests.map((request) => ({
    kind: KIND_REQUEST,
    id: `request-${request.id}`,
    request,
    method: request.method,
    title: request.name || UNTITLED,
    path: pathOf(request.folderId),
    url: request.url,
  }))
}

const historyItems = (history) => history.map((entry) => ({
  kind: KIND_HISTORY,
  id: `history-${entry.id}`,
  request: entry,
  method: entry.method,
  title: entry.url,
  path: "",
  url: "",
}))

const commandItems = (commands) => commands.map((command) => ({ ...command, kind: KIND_COMMAND }))

const itemScore = (item, needle) => {
  if (item.kind === KIND_COMMAND) {
    const label = fuzzyScore(item.label, needle)
    if (label !== null) return label
    return `${item.description} ${item.keywords || ""}`.toLowerCase().includes(needle) ? 1 : null
  }
  const title = fuzzyScore(item.title, needle)
  if (title !== null) return title + NAME_MATCH_BONUS
  return fuzzyScore(`${item.path} ${item.method} ${item.url}`, needle)
}

const rank = (items, needle, limit) => items
  .map((item) => ({ item, score: itemScore(item, needle) }))
  .filter((entry) => entry.score !== null)
  .sort((first, second) => second.score - first.score)
  .slice(0, limit)
  .map((entry) => entry.item)

function paletteItems({ commands, requests, history, query, mode }) {
  const needle = query.trim().toLowerCase()
  const showCommands = mode !== "requests"
  if (!needle) {
    return showCommands
      ? commands
      : [...requests.slice(0, MAX_RECENT_REQUESTS), ...history.slice(0, MAX_HISTORY_RESULTS)]
  }
  return [
    ...(showCommands ? rank(commands, needle, commands.length) : []),
    ...rank(requests, needle, MAX_REQUEST_RESULTS),
    ...rank(history, needle, MAX_HISTORY_RESULTS),
  ]
}

const rowClass = (isSelected, extra) => cn(
  "flex h-10 w-full items-center gap-3 rounded-md px-3 text-left",
  extra,
  isSelected && "bg-accent"
)

const scrollWhenSelected = (isSelected) => (element) => {
  if (isSelected) element?.scrollIntoView({ block: "nearest" })
}

function CommandRow({ command, isSelected, onSelect, onHover }) {
  const Icon = command.icon
  const shortcut = useShortcutLabel(command.shortcutId)
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      title={command.label}
      ref={scrollWhenSelected(isSelected)}
      onClick={() => onSelect(command)}
      onMouseMove={onHover}
      className={rowClass(isSelected, command.destructive && "text-destructive")}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{command.label}</span>
        <span className="block truncate text-2xs text-muted-foreground">{command.description}</span>
      </span>
      {shortcut && <kbd>{shortcut}</kbd>}
    </button>
  )
}

function RequestRow({ item, isSelected, onSelect, onHover }) {
  const isHistory = item.kind === KIND_HISTORY
  const detail = isHistory ? "Sent earlier" : [item.path, item.url].filter(Boolean).join("  ·  ")
  const Icon = isHistory ? Clock : FileText
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      title={isHistory ? item.title : `${item.title}${item.path ? ` (${item.path})` : ""}`}
      ref={scrollWhenSelected(isSelected)}
      onClick={() => onSelect(item)}
      onMouseMove={onHover}
      className={rowClass(isSelected)}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <MethodTag method={item.method} className="w-12" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{item.title}</span>
        <span className="block truncate text-2xs text-muted-foreground">{detail}</span>
      </span>
    </button>
  )
}

function SectionTitle({ kind }) {
  return <p className="px-3 pb-1 pt-2 text-3xs font-semibold uppercase tracking-wide text-muted-foreground">{SECTION_TITLES[kind]}</p>
}

const INSTALL_COMMAND = { id: "install-app", label: INSTALL_TEXT.label, description: INSTALL_TEXT.description, icon: MonitorDown, action: "installApp" }

function OpenCommandPalette({ mode, environments, activeEnvironmentId, workspaces, hasLoadTest, isAiOn, requests, folders, history, onClose, onCommand, onShowShortcuts }) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const canInstall = useInstallable()

  const commands = useMemo(
    () => commandItems([...COMMANDS, ...(isAiOn ? AI_COMMANDS : []), ...(hasLoadTest ? [LOAD_TEST_COMMAND] : []), ...(canInstall ? [INSTALL_COMMAND] : []), ...workspaceCommands(workspaces), ...environmentCommands(environments, activeEnvironmentId)]),
    [environments, activeEnvironmentId, workspaces, hasLoadTest, isAiOn, canInstall]
  )
  const requestRows = useMemo(() => requestItems(requests, folders), [requests, folders])
  const historyRows = useMemo(() => historyItems(history), [history])
  const shown = useMemo(
    () => paletteItems({ commands, requests: requestRows, history: historyRows, query, mode }),
    [commands, requestRows, historyRows, query, mode]
  )

  useEffect(() => {
    inputRef.current.focus()
  }, [])

  const select = (item) => {
    onClose()
    if (item.kind === KIND_REQUEST) onCommand("openRequest", item.request)
    else if (item.kind === KIND_HISTORY) onCommand("openHistory", item.request)
    else onCommand(item.action, item.payload)
  }

  const updateQuery = (event) => {
    setQuery(event.target.value)
    setSelectedIndex(0)
  }

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      onClose()
      return
    }
    if (shown.length === 0) return
    if (event.key === "Enter") {
      event.preventDefault()
      select(shown[selectedIndex])
      return
    }
    const step = SELECTION_STEPS[event.key]
    if (!step) return
    event.preventDefault()
    setSelectedIndex((index) => (index + step + shown.length) % shown.length)
  }

  const isRequestMode = mode === "requests"
  const showsSections = isRequestMode || query.trim() !== ""

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pb-4 pt-[15vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        data-surface="menu"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg"
      >
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={updateQuery}
            placeholder={isRequestMode ? "Go to a request or history entry" : "Type a command or a request name"}
            aria-label={isRequestMode ? "Search requests" : "Search commands"}
            spellCheck={false}
            className="h-7 min-w-0 flex-1 rounded-md bg-transparent px-1 text-xs text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="button"
            title="Keyboard shortcuts"
            aria-label="Keyboard shortcuts"
            onClick={onShowShortcuts}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border font-mono text-2xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            ?
          </button>
          <kbd>Esc</kbd>
        </div>

        <div role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {shown.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Nothing found</p>}
          {shown.map((item, index) => {
            const isSelected = index === selectedIndex
            const onHover = () => setSelectedIndex(index)
            const startsSection = showsSections && item.kind !== shown[index - 1]?.kind
            return (
              <div key={item.id} role="presentation">
                {startsSection && <SectionTitle kind={item.kind} />}
                {item.kind === KIND_COMMAND
                  ? <CommandRow command={item} isSelected={isSelected} onSelect={select} onHover={onHover} />
                  : <RequestRow item={item} isSelected={isSelected} onSelect={select} onHover={onHover} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function CommandPalette({ isOpen, ...props }) {
  return isOpen ? <OpenCommandPalette {...props} /> : null
}
