import { memo, useRef } from "react"
import { Code, Gauge, Plug, Save, Send, Unplug, X } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Select } from "./ui/select"
import { VariableInput } from "./VariableInput"
import { HTTP_METHODS } from "../lib/constants"
import { methodStyle } from "../lib/methodColors"
import { useFittingText } from "../hooks/useFittingText"
import { useShortcutLabel } from "../hooks/useShortcuts"
import { LOAD_TEST_TEXT } from "../lib/loadTestText"
import { GRAPHQL_METHOD } from "../lib/graphqlSchema"
import { SOCKET_METHOD, shownMethod } from "../lib/methodLabel"
import { REQUEST_BAR_TEXT as TEXT } from "../lib/requestBarText"
import { hintWithShortcut } from "../lib/shortcuts"
import { SOCKET_IDLE } from "../lib/socketSessions"

const CURL_PREFIX = "curl "

const isCurlCommand = (text) => text.trimStart().toLowerCase().startsWith(CURL_PREFIX)

const [DEFAULT_METHOD] = HTTP_METHODS

const asOption = (method) => ({ value: method, label: method })

function methodOptions(current, isSocket) {
  if (isSocket) return [{ value: current === GRAPHQL_METHOD ? DEFAULT_METHOD : current, label: SOCKET_METHOD }, asOption(GRAPHQL_METHOD)]
  return (HTTP_METHODS.includes(current) ? HTTP_METHODS : [...HTTP_METHODS, current]).map(asOption)
}

function SendButton({ loading, socketStatus, hint, onSend, onCancel, onDisconnect }) {
  if (loading) {
    return (
      <Button variant="destructive" onClick={onCancel} className="max-sm:flex-1">
        <X />
        {TEXT.cancel}
      </Button>
    )
  }
  if (socketStatus !== null && socketStatus !== SOCKET_IDLE) {
    return (
      <Button variant="outline" onClick={onDisconnect} className="max-sm:flex-1">
        <Unplug />
        {TEXT.disconnect}
      </Button>
    )
  }
  const label = socketStatus === null ? TEXT.send : TEXT.connect
  return (
    <Button onClick={onSend} title={hint(label)} className="max-sm:flex-1">
      {socketStatus === null ? <Send /> : <Plug />}
      {label}
    </Button>
  )
}

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
  onDisconnect,
  socketStatus,
  loading,
}) {
  const isSocket = socketStatus !== null
  const method = shownMethod(activeRequest, isSocket)
  const urlRef = useRef(null)
  const urlPlaceholder = useFittingText(urlRef, TEXT.methodPlaceholders[method] || TEXT.urlPlaceholders)
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
        placeholder={TEXT.untitled}
        value={activeRequest.name}
        title={activeRequest.name}
        onChange={(event) => onNameChange(event.target.value)}
        aria-label={TEXT.name}
        className="border-transparent text-sm font-medium hover:border-border focus:border-border"
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex w-full items-center gap-2 sm:contents">
          <Select
            value={activeRequest.method}
            onChange={(event) => onMethodChange(event.target.value)}
            aria-label={TEXT.method}
            controlSize="md"
            style={methodStyle(method)}
            className="w-28 font-mono font-semibold"
          >
            {methodOptions(activeRequest.method, isSocket).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>

          <div className="min-w-0 flex-1 sm:min-w-40">
            <VariableInput
              ref={urlRef}
              placeholder={urlPlaceholder}
              value={activeRequest.url}
              title={activeRequest.url}
              onChange={(event) => onUrlChange(event.target.value)}
              onPaste={handlePaste}
              onKeyDown={handleUrlKeyDown}
              aria-label={TEXT.url}
              data-pane-entry
              spellCheck={false}
              controlSize="md"
              className="font-mono"
            />
          </div>
        </div>

        <div className="flex w-full items-center gap-2 sm:contents">
          <SendButton
            loading={loading}
            socketStatus={socketStatus}
            hint={(label) => hintWithShortcut(label, sendShortcut)}
            onSend={onSend}
            onCancel={onCancel}
            onDisconnect={onDisconnect}
          />
          <ActionButton icon={Save} label={TEXT.save} hint={hintWithShortcut(TEXT.save, saveShortcut)} variant="secondary" onClick={onSave} />
          <ActionButton icon={Code} label={TEXT.code} hint={TEXT.codeHint} variant="outline" onClick={onGenerateCode} />
          {onLoadTest && <ActionButton icon={Gauge} label={LOAD_TEST_TEXT.barLabel} hint={LOAD_TEST_TEXT.barHint} variant="outline" onClick={onLoadTest} />}
        </div>
      </div>
    </div>
  )
})
