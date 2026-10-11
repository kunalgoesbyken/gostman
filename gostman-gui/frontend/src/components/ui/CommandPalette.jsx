import { useEffect, useMemo, useRef, useState } from "react"
import {
  Bookmark, Code, Cookie, Copy, Download, FolderPlus, Globe, History, ListChecks, Plus, RotateCcw, Save, Search, Send, Server, Settings,
  Share2, Upload, X,
} from "lucide-react"
import { shortcutLabel } from "../../lib/platform"
import { cn } from "../../lib/utils"

const COMMANDS = [
  { id: "send-request", label: "Send request", description: "Send the request in the current tab", icon: Send, shortcut: "Enter", action: "sendRequest" },
  { id: "new-request", label: "New request", description: "Open a new empty tab", icon: Plus, shortcut: "N", action: "newRequest" },
  { id: "save-request", label: "Save request", description: "Save the request in the current tab", icon: Save, shortcut: "S", action: "saveRequest" },
  { id: "duplicate-request", label: "Duplicate request", description: "Save a copy of the current request", icon: Copy, action: "duplicateRequest" },
  { id: "generate-code", label: "Generate code", description: "Show the current request as code", icon: Code, action: "generateCode" },
  { id: "close-tab", label: "Close tab", description: "Close the current tab", icon: X, action: "closeTab" },
  { id: "new-folder", label: "New folder", description: "Create a folder at the top level", icon: FolderPlus, action: "newFolder" },
  { id: "run-collection", label: "Run requests", description: "Run every request in a folder with its tests", icon: ListChecks, action: "runCollection" },
  { id: "examples", label: "Request examples", description: "See the saved responses of the current request", icon: Bookmark, action: "examples" },
  { id: "mock-server", label: "Mock server", description: "Serve saved examples on a local port", icon: Server, action: "mockServer" },
  { id: "cookies", label: "Manage cookies", description: "See and delete stored cookies", icon: Cookie, action: "cookies" },
  { id: "network", label: "Network settings", description: "Proxy and certificates", icon: Settings, action: "settings" },
  { id: "import", label: "Import data", description: "Import Postman, OpenAPI or Gostman files", icon: Upload, action: "import" },
  { id: "export", label: "Export data", description: "Export collections and environments", icon: Download, action: "export" },
  { id: "share", label: "Share collection", description: "Create an encrypted link or file, no account needed", icon: Share2, action: "share" },
  { id: "clear-history", label: "Clear history", description: "Delete every history entry", icon: History, action: "clearHistory" },
  { id: "reset", label: "Reset app", description: "Delete all data and reload", icon: RotateCcw, action: "reset", destructive: true },
]

const SELECTION_STEPS = { ArrowDown: 1, ArrowUp: -1 }

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

const matches = (command, needle) => (
  command.label.toLowerCase().includes(needle) || command.description.toLowerCase().includes(needle)
)

function CommandRow({ command, isSelected, onSelect, onHover }) {
  const Icon = command.icon
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      title={command.label}
      ref={(element) => {
        if (isSelected) element?.scrollIntoView({ block: "nearest" })
      }}
      onClick={() => onSelect(command)}
      onMouseMove={onHover}
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-md px-3 text-left",
        command.destructive && "text-destructive",
        isSelected && "bg-accent"
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{command.label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{command.description}</span>
      </span>
      {command.shortcut && <kbd>{shortcutLabel(command.shortcut)}</kbd>}
    </button>
  )
}

function OpenCommandPalette({ environments, activeEnvironmentId, onClose, onCommand }) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)

  const commands = useMemo(
    () => [...COMMANDS, ...environmentCommands(environments, activeEnvironmentId)],
    [environments, activeEnvironmentId]
  )
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? commands.filter((command) => matches(command, needle)) : commands
  }, [commands, query])

  useEffect(() => {
    inputRef.current.focus()
  }, [])

  const select = (command) => {
    onClose()
    onCommand(command.action, command.payload)
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pb-4 pt-[15vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
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
            placeholder="Type a command"
            aria-label="Search commands"
            spellCheck={false}
            className="h-7 min-w-0 flex-1 rounded-md bg-transparent px-1 text-xs text-foreground placeholder:text-muted-foreground"
          />
          <kbd>Esc</kbd>
        </div>

        <div role="listbox" aria-label="Commands" className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {shown.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No commands found</p>}
          {shown.map((command, index) => (
            <CommandRow
              key={command.id}
              command={command}
              isSelected={index === selectedIndex}
              onSelect={select}
              onHover={() => setSelectedIndex(index)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function CommandPalette({ isOpen, ...props }) {
  return isOpen ? <OpenCommandPalette {...props} /> : null
}
