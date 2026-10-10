import { memo } from "react"
import { Code, Save, Send, X } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Select } from "./ui/select"
import { HTTP_METHODS, METHOD_COLORS } from "../lib/constants"
import { lookup } from "../lib/dataUtils"
import { shortcutLabel } from "../lib/platform"
import { isWebSocketURL } from "../lib/socketUrl"
import { cn } from "../lib/utils"

const CURL_PREFIX = "curl "

const isCurlCommand = (text) => text.trimStart().toLowerCase().startsWith(CURL_PREFIX)

const methodOptions = (current) => (HTTP_METHODS.includes(current) ? HTTP_METHODS : [...HTTP_METHODS, current])

function ActionButton({ icon: Icon, label, hint, ...props }) {
  return (
    <Button aria-label={label} title={hint} {...props}>
      <Icon />
      <span className="hidden lg:inline">{label}</span>
    </Button>
  )
}

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
  const sendLabel = isWebSocketURL(activeRequest.url) ? "Connect" : "Send"

  const handlePaste = (event) => {
    const pastedText = event.clipboardData.getData("text")
    if (!isCurlCommand(pastedText)) return
    event.preventDefault()
    onPasteCurl(pastedText)
  }

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border px-3 py-2">
      <Input
        placeholder="Untitled request"
        value={activeRequest.name}
        title={activeRequest.name}
        onChange={(event) => onNameChange(event.target.value)}
        aria-label="Request name"
        className="border-transparent text-sm font-medium hover:border-border focus:border-border"
      />

      <div className="flex items-center gap-2">
        <Select
          value={activeRequest.method}
          onChange={(event) => onMethodChange(event.target.value)}
          aria-label="HTTP method"
          controlSize="md"
          className={cn("w-28 font-mono font-semibold", lookup(METHOD_COLORS, activeRequest.method))}
        >
          {methodOptions(activeRequest.method).map((method) => (
            <option key={method} value={method}>{method}</option>
          ))}
        </Select>

        <div className="min-w-0 flex-1">
          <Input
            placeholder="Enter a URL or paste a curl command"
            value={activeRequest.url}
            title={activeRequest.url}
            onChange={(event) => onUrlChange(event.target.value)}
            onPaste={handlePaste}
            aria-label="Request URL"
            spellCheck={false}
            controlSize="md"
            className="font-mono"
          />
        </div>

        {loading ? (
          <Button variant="destructive" onClick={onCancel}>
            <X />
            Cancel
          </Button>
        ) : (
          <Button onClick={onSend} title={`${sendLabel} (${shortcutLabel("Enter")})`}>
            <Send />
            {sendLabel}
          </Button>
        )}
        <ActionButton icon={Save} label="Save" hint={`Save (${shortcutLabel("S")})`} variant="secondary" onClick={onSave} />
        <ActionButton icon={Code} label="Code" hint="Generate code" variant="outline" onClick={onGenerateCode} />
      </div>
    </div>
  )
})
