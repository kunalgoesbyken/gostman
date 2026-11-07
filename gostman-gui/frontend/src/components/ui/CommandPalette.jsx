import { useEffect, useId, useMemo, useRef, useState } from "react"
import {
  ChevronsDownUp, ClipboardPaste, Clock, Compass, MonitorDown, Info, Hand, Folder, FolderOpen, Code, Copy, FileText, FolderPlus, Globe, History, Keyboard, PanelLeft, Pin, Plus, Save, Search, Send,
  Bot, Settings, Settings2, SlidersHorizontal, Newspaper, Trash2, Undo2, Workflow, X,
} from "lucide-react"
import { MethodTag } from "../MethodTag"
import { SectionLabel } from "./panel"
import { useFocusTrap } from "../../hooks/useFocusTrap"
import { fuzzyScore } from "../../lib/fuzzy"
import { PREFERENCES_TEXT } from "../../lib/preferencesText"
import { featureCommands } from "../../lib/featurePalette"
import { FEATURES_TEXT } from "../../lib/featuresText"
import { ABOUT_TEXT } from "../../lib/aboutText"
import { DATA_TEXT } from "../../lib/dataText"
import { INSTALL_TEXT } from "../../lib/installText"
import { useInstallable } from "../../lib/pwa"
import { WELCOME_TEXT } from "../../lib/welcomeText"
import { AI_TEXT } from "../../lib/aiText"
import { WORKSPACE_TEXT } from "../../lib/workspaceText"
import { TREE_TEXT } from "../../lib/treeText"
import { COMMAND_TEXT } from "../../lib/commandText"
import { DEPENDENCIES_TEXT } from "../../lib/dependenciesText"
import { SEARCH_TEXT } from "../../lib/searchText"
import { TRASH_TEXT } from "../../lib/trashText"
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
  aiCommand("ai-mock", AI_TEXT.commands.mock, "aiMock"),
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
  command("global-search", SEARCH_TEXT.command, "globalSearch", { icon: Search }),
  command("dependency-graph", DEPENDENCIES_TEXT.command, "dependencyGraph", { icon: Workflow }),
  command("new-folder", COMMAND_TEXT.commands.newFolder, "newFolder", { icon: FolderPlus }),
  { id: "collapse-folders", label: TREE_TEXT.collapseAll, description: TREE_TEXT.collapseAllDescription, icon: ChevronsDownUp, keywords: COMMAND_TEXT.commands.collapseFolders.keywords, action: "collapseFolders" },
  command("collection-settings", COMMAND_TEXT.commands.collectionSettings, "collectionSettings", { icon: Settings2 }),
  ...allCollectionsCommands(holdsCollections),
  { id: "preferences", label: PREFERENCES_TEXT.title, description: PREFERENCES_TEXT.commandDescription, icon: SlidersHorizontal, action: "preferences" },
  aiSettingsCommand(),
  { id: "recently-deleted", label: TRASH_TEXT.command, description: TRASH_TEXT.commandDescription, keywords: TRASH_TEXT.commandKeywords, icon: Undo2, action: "recentlyDeleted" },
  command("clear-history", COMMAND_TEXT.commands.clearHistory, "clearHistory", { icon: History }),
  { id: "welcome", label: WELCOME_TEXT.commandTitle, description: WELCOME_TEXT.commandDescription, icon: Hand, action: "showWelcome" },
  { id: "about", label: ABOUT_TEXT.commandTitle, description: ABOUT_TEXT.commandDescription, icon: Info, action: "about" },
]

const resetCommand = () => ({ id: "reset", label: DATA_TEXT.commandTitle, description: DATA_TEXT.commandDescription, icon: Trash2, keywords: DATA_TEXT.commandKeywords, action: "reset", destructive: true })

const exploreCommands = () => [
  { id: "explore", label: FEATURES_TEXT.commandTitle, description: FEATURES_TEXT.commandDescription, keywords: FEATURES_TEXT.commandKeywords, icon: Compass, action: "explore" },
  { id: "whats-new", label: FEATURES_TEXT.whatsNewCommandTitle, description: FEATURES_TEXT.whatsNewCommandDescription, keywords: FEATURES_TEXT.whatsNewKeywords, icon: Newspaper, action: "whatsNew" },
]

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

const withPlace = (item) => ({ ...item, place: `${item.path} ${item.method} ${item.url}` })

const requestItems = (requests, folders) => {
  const pathOf = folderPathOf(folders)
  return requests.map((request) => withPlace({
    kind: KIND_REQUEST,
    id: `request-${request.id}`,
    request,
    method: request.method,
    title: request.name || COMMAND_TEXT.untitled,
    path: pathOf(request.folderId),
    url: request.url,
  }))
}

const historyItems = (history) => history.map((entry) => withPlace({
  kind: KIND_HISTORY,
  id: `history-${entry.id}`,
  request: entry,
  method: entry.method,
  title: entry.url,
  path: "",
  url: "",
}))

const commandItems = (commands) => commands.map((command) => ({
  ...command,
  kind: KIND_COMMAND,
  details: `${command.description} ${command.keywords || ""}`.toLowerCase(),
}))

const KEYWORD_MATCH = 1

function commandScore(item, needle) {
  let total = 0
  for (const word of needle.split(/\s+/).filter(Boolean)) {
    const label = fuzzyScore(item.label, word)
    if (label !== null) total += label
    else if (item.details.includes(word)) total += KEYWORD_MATCH
    else return null
  }
  return total
}

const itemScore = (item, needle) => {
  if (item.kind === KIND_COMMAND) return commandScore(item, needle)
  const title = fuzzyScore(item.title, needle)
  if (title !== null) return title + NAME_MATCH_BONUS
  return fuzzyScore(item.place, needle)
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
      ? commands.filter((command) => !command.onlyWhenSearching)
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

function useScrollWhenSelected(isSelected) {
  const ref = useRef(null)
  useEffect(() => {
    if (isSelected) ref.current?.scrollIntoView({ block: "nearest" })
  }, [isSelected])
  return ref
}

function CommandRow({ id, command, isSelected, onSelect, onHover }) {
  const Icon = command.icon
  const tag = command.tag
  const shortcut = useShortcutLabel(command.shortcutId)
  const rowRef = useScrollWhenSelected(isSelected)
  return (
    <button
      id={id}
      type="button"
      role="option"
      tabIndex={-1}
      aria-selected={isSelected}
      title={command.label}
      ref={rowRef}
      onClick={() => onSelect(command)}
      onMouseMove={onHover}
      className={rowClass(isSelected, command.destructive && "text-destructive")}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{command.label}</span>
        <span className="block truncate text-2xs text-muted-foreground">{command.description}</span>
      </span>
      {tag && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">{tag}</span>}
      {command.isNew && <span className="shrink-0 rounded bg-success/10 px-1.5 py-0.5 text-2xs text-success">{FEATURES_TEXT.newBadge}</span>}
      {shortcut && <kbd>{shortcut}</kbd>}
    </button>
  )
}

function RequestRow({ id, item, isSelected, onSelect, onHover }) {
  const isHistory = item.kind === KIND_HISTORY
  const detail = isHistory ? COMMAND_TEXT.sentEarlier : [item.path, item.url].filter(Boolean).join("  ·  ")
  const Icon = isHistory ? Clock : FileText
  const rowRef = useScrollWhenSelected(isSelected)
  return (
    <button
      id={id}
      type="button"
      role="option"
      tabIndex={-1}
      aria-selected={isSelected}
      title={isHistory ? item.title : `${item.title}${item.path ? ` (${item.path})` : ""}`}
      ref={rowRef}
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

function OpenCommandPalette({ mode, environments, activeEnvironmentId, workspaces, isAiOn, holdsCollections, seenVersion, requests, folders, history, onClose, onCommand, onShowShortcuts }) {
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
      ...featureCommands(seenVersion),
      ...exploreCommands(),
      ...(isAiOn ? aiCommands() : []),
      ...appCommands(holdsCollections),
      ...workspaceCommands(workspaces),
      ...environmentCommands(environments, activeEnvironmentId),
      ...(canInstall ? [installCommand()] : []),
      resetCommand(),
    ]),
    [environments, activeEnvironmentId, workspaces, isAiOn, holdsCollections, canInstall, seenVersion]
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
