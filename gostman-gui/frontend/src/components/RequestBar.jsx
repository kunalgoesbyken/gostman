import { memo } from "react"
import { Code, Gauge, Save, Send, X } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Select } from "./ui/select"
import { VariableInput } from "./VariableInput"
import { HTTP_METHODS } from "../lib/constants"
import { methodStyle } from "../lib/methodColors"
import { useShortcutLabel } from "../hooks/useShortcuts"
import { LOAD_TEST_TEXT } from "../lib/loadTestText"
import { hintWithShortcut } from "../lib/shortcuts"
import { isWebSocketURL } from "../lib/socketUrl"

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
  onLoadTest,
  onPasteCurl,
  loading,
}) {
  const sendLabel = isWebSocketURL(activeRequest.url) ? "Connect" : "Send"
  const sendShortcut = useShortcutLabel("sendRequest")
  const saveShortcut = useShortcutLabel("saveRequest")

  const handlePaste = (event) => {
    const pastedText = event.clipboardData.getData("text")
    if (!isCurlCommand(pastedText)) return
    event.preventDefault()
    onPasteCurl(pastedText)
  }

  const handleUrlKeyDown = (event) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
    event.preventDefault()
    if (!loading) onSend()
  }

  return (
    <div data-pane="address" className="flex shrink-0 flex-col gap-2 border-b border-border px-3 py-2">
      <Input
        placeholder="Untitled request"
        value={activeRequest.name}
        title={activeRequest.name}
        onChange={(event) => onNameChange(event.target.value)}
        aria-label="Request name"
        className="border-transparent text-sm font-medium hover:border-border focus:border-border"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={activeRequest.method}
          onChange={(event) => onMethodChange(event.target.value)}
          aria-label="HTTP method"
          controlSize="md"
          style={methodStyle(activeRequest.method)}
          className="w-28 font-mono font-semibold"
        >
          {methodOptions(activeRequest.method).map((method) => (
            <option key={method} value={method}>{method}</option>
          ))}
        </Select>

        <div className="min-w-40 flex-1">
          <VariableInput
            placeholder="Enter a URL or paste a curl command"
            value={activeRequest.url}
            title={activeRequest.url}
            onChange={(event) => onUrlChange(event.target.value)}
            onPaste={handlePaste}
            onKeyDown={handleUrlKeyDown}
            aria-label="Request URL"
            data-pane-entry
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
          <Button onClick={onSend} title={hintWithShortcut(sendLabel, sendShortcut)}>
            <Send />
            {sendLabel}
          </Button>
        )}
        <ActionButton icon={Save} label="Save" hint={hintWithShortcut("Save", saveShortcut)} variant="secondary" onClick={onSave} />
        <ActionButton icon={Code} label="Code" hint="Generate code" variant="outline" onClick={onGenerateCode} />
        {onLoadTest && <ActionButton icon={Gauge} label={LOAD_TEST_TEXT.barLabel} hint={LOAD_TEST_TEXT.barHint} variant="outline" onClick={onLoadTest} />}
      </div>
    </div>
  )
})
