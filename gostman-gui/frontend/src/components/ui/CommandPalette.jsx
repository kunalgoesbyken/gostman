import { useEffect, useId, useMemo, useRef, useState } from "react"
import {
  Bookmark, ChevronsDownUp, ClipboardPaste, Gauge, Clock, MonitorDown, Info, Hand, Folder, FolderOpen, Code, Cookie, Copy, Download, FileText, FolderPlus, Globe, History, Keyboard, ListChecks, PanelLeft, Pin, Plus, Radio, Save, Search, Send,
  Bot, Server, Settings, Settings2, Share2, ShieldAlert, ShieldCheck, SlidersHorizontal, Trash2, Undo2, Upload, X,
} from "lucide-react"
import { MethodTag } from "../MethodTag"
import { SectionLabel } from "./panel"
import { useFocusTrap } from "../../hooks/useFocusTrap"
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
import { COMMAND_TEXT } from "../../lib/commandText"
import { useShortcutLabel } from "../../hooks/useShortcuts"
import { cn } from "../../lib/utils"

const command = (id, text, action, extra = {}) => ({ id, label: text.label, description: text.description, keywords: text.keywords, action, ...extra })

const aiCommand = (id, text, action, extra = {}) => command(id, text, action, { icon: Bot, ...extra })

const aiSettingsCommand = () => aiCommand("ai-settings", AI_TEXT.commands.settings, "aiSettings", { icon: Settings })

const aiCommands = () => [
  aiCommand("ai-request", AI_TEXT.commands.request, "aiRequest", { shortcutId: "aiGenerate" }),
  aiCommand("ai-tests", AI_TEXT.commands.tests, "aiTests"),
  aiCommand("ai-script", AI_TEXT.commands.script, "aiScript"),
  aiCommand("ai-explain", AI_TEXT.commands.explain, "aiExplain", { shortcutId: "aiExplain" }),
  aiCommand("ai-docs", AI_TEXT.commands.docs, "aiDocs"),
  aiCommand("ai-search", AI_TEXT.commands.search, "aiSearch"),
  aiCommand("ai-schema", AI_TEXT.commands.schema, "aiSchema"),
]

const requestCommands = () => [
  command("send-request", COMMAND_TEXT.commands.sendRequest, "sendRequest", { icon: Send, shortcutId: "sendRequest" }),
  command("new-request", COMMAND_TEXT.commands.newRequest, "newRequest", { icon: Plus, shortcutId: "newRequest" }),
  command("save-request", COMMAND_TEXT.commands.saveRequest, "saveRequest", { icon: Save, shortcutId: "saveRequest" }),
  command("duplicate-request", COMMAND_TEXT.commands.duplicateRequest, "duplicateRequest", { icon: Copy }),
  command("copy-request", COMMAND_TEXT.commands.copyRequest, "copyRequest", { icon: Copy }),
  command("paste-request", COMMAND_TEXT.commands.pasteRequest, "pasteRequest", { icon: ClipboardPaste }),
  command("generate-code", COMMAND_TEXT.commands.generateCode, "generateCode", { icon: Code }),
]

const allCollectionsCommands = (holdsCollections) => (
  holdsCollections ? [command("all-collections-settings", COMMAND_TEXT.commands.allCollectionsSettings, "allCollectionsSettings", { icon: Settings2 })] : []
)

const appCommands = (holdsCollections) => [
  command("close-tab", COMMAND_TEXT.commands.closeTab, "closeTab", { icon: X, shortcutId: "closeTab" }),
  command("close-other-tabs", COMMAND_TEXT.commands.closeOtherTabs, "closeOtherTabs", { icon: X, shortcutId: "closeOtherTabs" }),
  command("close-saved-tabs", COMMAND_TEXT.commands.closeSavedTabs, "closeSavedTabs", { icon: X, shortcutId: "closeSavedTabs" }),
  command("keep-tab", COMMAND_TEXT.commands.keepTab, "keepTab", { icon: Pin, shortcutId: "keepTab" }),
  command("reopen-tab", COMMAND_TEXT.commands.reopenTab, "reopenTab", { icon: Undo2, shortcutId: "reopenTab" }),
  command("toggle-sidebar", COMMAND_TEXT.commands.toggleSidebar, "toggleSidebar", { icon: PanelLeft, shortcutId: "toggleSidebar" }),
  command("keyboard-shortcuts", COMMAND_TEXT.commands.shortcuts, "shortcuts", { icon: Keyboard, keywords: "?", shortcutId: "shortcutsHelp" }),
  command("new-folder", COMMAND_TEXT.commands.newFolder, "newFolder", { icon: FolderPlus }),
  { id: "collapse-folders", label: TREE_TEXT.collapseAll, description: TREE_TEXT.collapseAllDescription, icon: ChevronsDownUp, keywords: COMMAND_TEXT.commands.collapseFolders.keywords, action: "collapseFolders" },
  command("run-collection", COMMAND_TEXT.commands.runCollection, "runCollection", { icon: ListChecks }),
  command("collection-settings", COMMAND_TEXT.commands.collectionSettings, "collectionSettings", { icon: Settings2 }),
  ...allCollectionsCommands(holdsCollections),
  command("examples", COMMAND_TEXT.commands.examples, "examples", { icon: Bookmark }),
  command("mock-server", COMMAND_TEXT.commands.mockServer, "mockServer", { icon: Server }),
  command("capture", COMMAND_TEXT.commands.capture, "captureTraffic", { icon: Radio }),
  command("environments", COMMAND_TEXT.commands.environments, "environments", { icon: Globe }),
  command("cookies", COMMAND_TEXT.commands.cookies, "cookies", { icon: Cookie }),
  { id: "scan-secrets", label: SCAN_TEXT.title, description: SCAN_TEXT.commandDescription, icon: ShieldAlert, keywords: COMMAND_TEXT.commands.scanSecrets.keywords, action: "scanSecrets" },
  { id: "preferences", label: PREFERENCES_TEXT.title, description: PREFERENCES_TEXT.commandDescription, icon: SlidersHorizontal, action: "preferences" },
  command("network", COMMAND_TEXT.commands.network, "settings", { icon: Settings }),
  command("import", COMMAND_TEXT.commands.import, "import", { icon: Upload }),
  command("lint-spec", COMMAND_TEXT.commands.lintSpec, "lintSpec", { icon: ShieldCheck }),
  command("export", COMMAND_TEXT.commands.export, "export", { icon: Download }),
  command("share", COMMAND_TEXT.commands.share, "share", { icon: Share2 }),
  aiSettingsCommand(),
  command("clear-history", COMMAND_TEXT.commands.clearHistory, "clearHistory", { icon: History }),
  { id: "welcome", label: WELCOME_TEXT.commandTitle, description: WELCOME_TEXT.commandDescription, icon: Hand, action: "showWelcome" },
  { id: "about", label: ABOUT_TEXT.commandTitle, description: ABOUT_TEXT.commandDescription, icon: Info, action: "about" },
]

const resetCommand = () => ({ id: "reset", label: DATA_TEXT.commandTitle, description: DATA_TEXT.commandDescription, icon: Trash2, keywords: DATA_TEXT.commandKeywords, action: "reset", destructive: true })

const loadTestCommand = () => ({ id: "load-test", label: LOAD_TEST_TEXT.commandTitle, description: LOAD_TEST_TEXT.commandDescription, icon: Gauge, keywords: COMMAND_TEXT.commands.loadTest.keywords, action: "loadTest" })

const installCommand = () => ({ id: "install-app", label: INSTALL_TEXT.label, description: INSTALL_TEXT.description, icon: MonitorDown, action: "installApp" })

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
const NAME_MATCH_BONUS = 20

const KIND_COMMAND = "command"
const KIND_REQUEST = "request"
const KIND_HISTORY = "history"
const sectionTitles = () => ({ [KIND_COMMAND]: COMMAND_TEXT.sections.command, [KIND_REQUEST]: COMMAND_TEXT.sections.request, [KIND_HISTORY]: COMMAND_TEXT.sections.history })

const environmentCommands = (environments, activeEnvironmentId) => environments
  .filter((environment) => environment.id !== activeEnvironmentId)
  .map((environment) => ({
    id: `environment-${environment.id}`,
    label: COMMAND_TEXT.switchEnvironment(environment.name),
    description: COMMAND_TEXT.switchEnvironmentDescription,
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
    title: request.name || COMMAND_TEXT.untitled,
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
  "flex h-10 w-full items-center gap-3 rounded-md px-3 text-start",
  extra,
  isSelected && "bg-accent"
)

const scrollWhenSelected = (isSelected) => (element) => {
  if (isSelected) element?.scrollIntoView({ block: "nearest" })
}

function CommandRow({ id, command, isSelected, onSelect, onHover }) {
  const Icon = command.icon
  const shortcut = useShortcutLabel(command.shortcutId)
  return (
    <button
      id={id}
      type="button"
      role="option"
      tabIndex={-1}
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

function RequestRow({ id, item, isSelected, onSelect, onHover }) {
  const isHistory = item.kind === KIND_HISTORY
  const detail = isHistory ? COMMAND_TEXT.sentEarlier : [item.path, item.url].filter(Boolean).join("  ·  ")
  const Icon = isHistory ? Clock : FileText
  return (
    <button
      id={id}
      type="button"
      role="option"
      tabIndex={-1}
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
  return <SectionLabel className="block px-3 pb-1 pt-2">{sectionTitles()[kind]}</SectionLabel>
}

function OpenCommandPalette({ mode, environments, activeEnvironmentId, workspaces, hasLoadTest, isAiOn, holdsCollections, requests, folders, history, onClose, onCommand, onShowShortcuts }) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const dialogRef = useRef(null)
  const listId = useId()
  const optionId = (index) => `${listId}-${index}`
  const canInstall = useInstallable()
  useFocusTrap(dialogRef)

  const commands = useMemo(
    () => commandItems([
      ...requestCommands(),
      ...(hasLoadTest ? [loadTestCommand()] : []),
      ...(isAiOn ? aiCommands() : []),
      ...appCommands(holdsCollections),
      ...workspaceCommands(workspaces),
      ...environmentCommands(environments, activeEnvironmentId),
      ...(canInstall ? [installCommand()] : []),
      resetCommand(),
    ]),
    [environments, activeEnvironmentId, workspaces, hasLoadTest, isAiOn, holdsCollections, canInstall]
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
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={COMMAND_TEXT.title}
        data-surface="menu"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg focus:outline-none"
      >
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={shown.length > 0 ? optionId(selectedIndex) : undefined}
            value={query}
            onChange={updateQuery}
            placeholder={isRequestMode ? COMMAND_TEXT.requestsPlaceholder : COMMAND_TEXT.commandsPlaceholder}
            aria-label={isRequestMode ? COMMAND_TEXT.searchRequests : COMMAND_TEXT.searchCommands}
            spellCheck={false}
            className="h-7 min-w-0 flex-1 rounded-md bg-transparent px-1 text-xs text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="button"
            title={COMMAND_TEXT.shortcuts}
            aria-label={COMMAND_TEXT.shortcuts}
            onClick={onShowShortcuts}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border font-mono text-2xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            ?
          </button>
          <kbd>{COMMAND_TEXT.escapeKey}</kbd>
        </div>

        <div id={listId} role="listbox" tabIndex={-1} aria-label={COMMAND_TEXT.results} className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {shown.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">{COMMAND_TEXT.nothingMatches}</p>}
          {shown.map((item, index) => {
            const isSelected = index === selectedIndex
            const onHover = () => setSelectedIndex(index)
            const startsSection = showsSections && item.kind !== shown[index - 1]?.kind
            return (
              <div key={item.id} role="presentation">
                {startsSection && <SectionTitle kind={item.kind} />}
                {item.kind === KIND_COMMAND
                  ? <CommandRow id={optionId(index)} command={item} isSelected={isSelected} onSelect={select} onHover={onHover} />
                  : <RequestRow id={optionId(index)} item={item} isSelected={isSelected} onSelect={select} onHover={onHover} />}
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
