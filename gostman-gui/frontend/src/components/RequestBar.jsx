import { memo } from "react"
import { Send, Save, Globe, Code, Radio, X } from "lucide-react"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Select } from "./ui/select"
import { Input } from "./ui/input"
import { cn } from "../lib/utils"
import { isWebSocketURL } from "../lib/socketUrl"
import { HTTP_METHODS, METHOD_COLORS } from "../lib/constants"

const CURL_COMMAND = /^\s*curl\s/i

export const RequestBar = memo(function RequestBar({
  activeRequest,
  onMethodChange,
  onUrlChange,
  onNameChange,
  onSend,
  onCancel,
  onSave,
  onGenerateCode,
  onPasteCurl,
  loading,
}) {
  const isWebSocket = isWebSocketURL(activeRequest.url)

  const handlePaste = (event) => {
    const pastedText = event.clipboardData.getData("text")
    if (!CURL_COMMAND.test(pastedText)) return
    event.preventDefault()
    onPasteCurl(pastedText)
  }

  return (
    <div className="border-b border-border/60 bg-muted/20">
      <div className="px-4 pt-2.5">
        <Input
          type="text"
          placeholder="Untitled request"
          value={activeRequest.name}
          onChange={(event) => onNameChange(event.target.value)}
          aria-label="Request name"
          className="h-auto border-none bg-transparent px-0 py-0 text-sm font-medium text-foreground/90 shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
        />
      </div>

      <div className="flex items-center gap-2 px-4 pb-3 pt-2">
        <div className="relative">
          <Select
            value={activeRequest.method}
            onChange={(event) => onMethodChange(event.target.value)}
            aria-label="HTTP method"
            className={`w-24 font-mono text-sm ${METHOD_COLORS[activeRequest.method] || ""}`}
          >
            {HTTP_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </Select>
        </div>

        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="https://api.example.com/endpoint (or paste curl command)"
            value={activeRequest.url}
            onChange={(event) => onUrlChange(event.target.value)}
            onPaste={handlePaste}
            aria-label="Request URL"
            className={cn(
              "pl-9 pr-24 font-mono text-sm",
              isWebSocket && "border-primary/50 focus-visible:border-primary"
            )}
          />
          {isWebSocket && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Badge className="gap-1 bg-primary/10 text-primary border-primary/20 text-xs">
                <Radio className="h-3 w-3" />
                WebSocket
              </Badge>
            </div>
          )}
        </div>

        {loading ? (
          <Button
            onClick={onCancel}
            variant="destructive"
            size="sm"
            aria-label="Cancel request"
            className="gap-2 font-medium"
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
        ) : (
          <Button
            onClick={onSend}
            size="sm"
            aria-label="Send request (Ctrl+Enter)"
            className="gap-2 font-medium"
          >
            <Send className="h-4 w-4" />
            Send
            <span className="ml-1 hidden font-mono text-[10px] text-primary-foreground/60 xl:inline">
              Ctrl+Enter
            </span>
          </Button>
        )}

        <Button
          onClick={onSave}
          variant="secondary"
          size="sm"
          className="gap-2"
          aria-label="Save request (Ctrl+S)"
        >
          <Save className="h-4 w-4" />
          Save
        </Button>

        <Button
          onClick={onGenerateCode}
          variant="outline"
          size="sm"
          className="gap-2"
          aria-label="Generate code snippet"
        >
          <Code className="h-4 w-4" />
          Code
        </Button>
      </div>
    </div>
  )
})
