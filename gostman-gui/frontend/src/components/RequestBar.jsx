import React, { memo } from "react"
import { Send, Save, Globe, Code, Radio } from "lucide-react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Select } from "./ui/select"
import { Input } from "./ui/input"
import { cn } from "../lib/utils"
import { parseCurlCommand, isCurlCommand } from "../lib/curlParser"
import { isWebSocketURL } from "./WebSocketPanel"

import { HTTP_METHODS, METHOD_COLORS } from "../lib/constants"

export const RequestBar = memo(function RequestBar({ activeRequest, onMethodChange, onUrlChange, onNameChange, onHeadersChange, onBodyChange, onQueryParamsChange, onSend, onSave, onGenerateCode, loading }) {
  // Check if URL is a WebSocket URL
  const isWebSocket = activeRequest?.url && isWebSocketURL(activeRequest.url)

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        onSend()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        onSave()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onSend, onSave])

  const handlePaste = (e) => {
    const pastedText = e.clipboardData.getData('text')

    if (!isCurlCommand(pastedText)) return

    const parsed = parseCurlCommand(pastedText)
    if (!parsed) return

    // Prevent default paste only after successful parsing
    e.preventDefault()

    // Apply method if valid
    if (parsed.method && onMethodChange) {
      onMethodChange(parsed.method)
    }

    // Apply URL if valid
    if (parsed.url && onUrlChange) {
      onUrlChange(parsed.url)
    }

    // Apply headers if valid and not empty
    if (parsed.headers && parsed.headers !== '{}' && onHeadersChange) {
      onHeadersChange(parsed.headers)
    }

    // Apply body if valid
    if (parsed.body && onBodyChange) {
      onBodyChange(parsed.body)
    }

    // Apply query params if valid and not empty
    if (parsed.queryParams && parsed.queryParams !== '{}' && onQueryParamsChange) {
      onQueryParamsChange(parsed.queryParams)
    }
  }

  return (
    <div className="border-b border-border/60 bg-muted/20 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Method Selector */}
        <div className="relative">
          <Select
            value={activeRequest.method}
            onChange={(e) => onMethodChange(e.target.value)}
            className={`w-24 font-mono text-sm ${METHOD_COLORS[activeRequest.method] || ''}`}
          >
            {HTTP_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </Select>
        </div>

        {/* URL Input */}
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="https://api.example.com/endpoint (or paste curl command)"
            value={activeRequest.url}
            onChange={(e) => onUrlChange(e.target.value)}
            onPaste={handlePaste}
            className={cn(
              "pl-9 pr-24 font-mono text-sm",
              isWebSocket && "border-primary/50 focus-visible:border-primary"
            )}
          />
          {/* WebSocket indicator badge */}
          {isWebSocket && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Badge className="gap-1 bg-primary/10 text-primary border-primary/20 text-xs">
                <Radio className="h-3 w-3" />
                WebSocket
              </Badge>
            </div>
          )}
        </div>

        {/* Send Button */}
        <Button
          onClick={onSend}
          disabled={loading}
          size="sm"
          className={cn(
            "gap-2 font-medium",
            loading && "animate-pulse-glow"
          )}
          title="Send request (Ctrl+Enter)"
        >
          <Send className="h-4 w-4" />
          {loading ? "Sending..." : "Send"}
        </Button>

        {/* Save Button */}
        <Button
          onClick={onSave}
          variant="secondary"
          size="sm"
          className="gap-2"
          title="Save request (Ctrl+S)"
        >
          <Save className="h-4 w-4" />
          Save
        </Button>

        {/* Code Button - only show if handler is provided */}
        {onGenerateCode && (
          <Button
            onClick={onGenerateCode}
            variant="outline"
            size="sm"
            className="gap-2"
            title="Generate code snippet"
          >
            <Code className="h-4 w-4" />
            Code
          </Button>
        )}

        {/* Request Name Input */}
        <div className="relative w-40">
          <Input
            type="text"
            placeholder="Request name"
            value={activeRequest.name}
            onChange={(e) => onNameChange(e.target.value)}
            className="text-sm"
          />
        </div>
      </div>

      {/* Keyboard shortcuts bar */}
      <div className="flex items-center justify-between border-t border-border/60 px-4 py-1.5 text-xs text-muted-foreground/70">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd>Ctrl</kbd>+<kbd>Enter</kbd> Send
          </span>
          <span className="flex items-center gap-1">
            <kbd>Ctrl</kbd>+<kbd>S</kbd> Save
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd>Ctrl</kbd>+<kbd>N</kbd> New
          </span>
        </div>
      </div>
    </div>
  )
})
