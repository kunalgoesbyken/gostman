import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Plus, Save, FileText, FolderPlus, RotateCcw, Download, Upload, Command } from "lucide-react"
import { cn } from "../../lib/utils"
import { overlayFade, dialogPop, tapScale } from "../../lib/motion"

const COMMANDS = [
  { id: "new-request", label: "New Request", description: "Create a new request", icon: Plus, shortcut: "Ctrl+N", action: "newRequest" },
  { id: "save-request", label: "Save Request", description: "Save current request", icon: Save, shortcut: "Ctrl+S", action: "saveRequest" },
  { id: "new-folder", label: "New Folder", description: "Create a new folder", icon: FolderPlus, shortcut: "", action: "newFolder" },
  { id: "export", label: "Export Data", description: "Export your collections", icon: Download, shortcut: "", action: "export" },
  { id: "import", label: "Import Data", description: "Import from file", icon: Upload, shortcut: "", action: "import" },
  { id: "reset", label: "Reset App", description: "Clear all data and reload", icon: RotateCcw, shortcut: "", action: "reset", variant: "destructive" },
]

export function CommandPalette({ isOpen, onClose, onCommand }) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const filteredCommands = COMMANDS.filter((cmd) => {
    const search = query.toLowerCase()
    return cmd.label.toLowerCase().includes(search) || cmd.description.toLowerCase().includes(search)
  })

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % filteredCommands.length)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length)
      } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
        e.preventDefault()
        handleSelect(filteredCommands[selectedIndex])
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, selectedIndex, filteredCommands])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        e.preventDefault()
        handleClose()
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [isOpen])

  // Scroll selected into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const selectedElement = listRef.current.children[selectedIndex]
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" })
      }
    }
  }, [selectedIndex])

  const handleClose = () => {
    setQuery("")
    onClose()
  }

  const handleSelect = (cmd) => {
    onCommand(cmd.action)
    handleClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4">
      <motion.div
        {...overlayFade}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      <motion.div
        {...dialogPop}
        className="relative w-full max-w-xl bg-background border border-border/60 rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3.5">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-muted-foreground bg-muted border border-border/50 rounded">
            <span className="text-[10px]">ESC</span> to close
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[300px] overflow-y-auto scrollbar-thin p-2">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No commands found
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredCommands.map((cmd, i) => {
                const Icon = cmd.icon
                const isSelected = i === selectedIndex
                return (
                  <motion.button
                    key={cmd.id}
                    onClick={() => handleSelect(cmd)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : cmd.variant === "destructive"
                          ? "text-destructive hover:bg-destructive/10"
                          : "hover:bg-muted/50"
                    )}
                    {...tapScale}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{cmd.label}</div>
                      <div className={cn(
                        "text-xs truncate",
                        isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        {cmd.description}
                      </div>
                    </div>
                    {cmd.shortcut && (
                      <kbd className={cn(
                        "hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium rounded shrink-0",
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted border border-border/50 text-muted-foreground"
                      )}>
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </motion.button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-border/40 bg-muted/20 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-background border border-border/50 rounded text-[10px]">↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-background border border-border/50 rounded text-[10px]">↵</kbd> select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-background border border-border/50 rounded text-[10px]">Ctrl</kbd> + <kbd className="px-1 py-0.5 bg-background border border-border/50 rounded text-[10px]">K</kbd> to open
          </span>
        </div>
      </motion.div>
    </div>
  )
}
