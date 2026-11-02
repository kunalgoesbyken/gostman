import { memo, useEffect, useRef, useState } from "react"
import { Code, Gauge, Plug, Save, Send, Unplug, X } from "lucide-react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Select } from "./ui/select"
import { VariableInput } from "./VariableInput"
import { methodStyle } from "../lib/methodColors"
import { useFittingText } from "../hooks/useFittingText"
import { useShortcutLabel } from "../hooks/useShortcuts"
import { LOAD_TEST_TEXT } from "../lib/loadTestText"
import { shownMethod } from "../lib/methodLabel"
import { PLAIN_METHODS, REQUEST_PROTOCOLS, hasMethodChoice, protocolIdOf, protocolUpdates } from "../lib/requestProtocols"
import { REQUEST_BAR_TEXT as TEXT } from "../lib/requestBarText"
import { hintWithShortcut } from "../lib/shortcuts"
import { SOCKET_IDLE } from "../lib/socketSessions"

const CURL_PREFIX = "curl "

const isCurlCommand = (text) => text.trimStart().toLowerCase().startsWith(CURL_PREFIX)

const asOption = (method) => ({ value: method, label: method })

const methodOptions = (current) => (PLAIN_METHODS.includes(current) ? PLAIN_METHODS : [...PLAIN_METHODS, current]).map(asOption)

function useDetectedProtocol(requestId, protocolId) {
  const previous = useRef({ requestId, protocolId })
  const [detected, setDetected] = useState("")
  const pickedRef = useRef(false)
  useEffect(() => {
    const before = previous.current
    previous.current = { requestId, protocolId }
    if (before.requestId !== requestId) setDetected("")
    else if (before.protocolId !== protocolId) setDetected(pickedRef.current ? "" : protocolId)
    pickedRef.current = false
  }, [requestId, protocolId])
  return [detected, () => { pickedRef.current = true }]
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
      {socketStatus === null ? <Send className="rtl:-scale-x-100" /> : <Plug />}
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
  onUpdateRequest,
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
  const protocolId = protocolIdOf(activeRequest, isSocket)
  const [detected, markPicked] = useDetectedProtocol(activeRequest.id, protocolId)
  const chooseProtocol = (id) => {
    markPicked()
    onUpdateRequest(protocolUpdates(id, activeRequest))
  }
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
      <div className="flex items-center gap-2">
        <Input
          placeholder={TEXT.untitled}
          value={activeRequest.name}
          title={activeRequest.name}
          onChange={(event) => onNameChange(event.target.value)}
          aria-label={TEXT.name}
          className="border-transparent text-sm font-medium hover:border-border focus:border-border"
        />
        {detected && <Badge role="status" className="shrink-0">{TEXT.detected(TEXT.protocols[detected])}</Badge>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex w-full items-center gap-2 sm:contents">
          <Select
            value={protocolId}
            onChange={(event) => chooseProtocol(event.target.value)}
            aria-label={TEXT.protocol}
            disabled={socketStatus !== null && socketStatus !== SOCKET_IDLE}
            controlSize="md"
            className="w-36 max-sm:w-32"
          >
            {REQUEST_PROTOCOLS.map((protocol) => (
              <option key={protocol.id} value={protocol.id}>{TEXT.protocols[protocol.id]}</option>
            ))}
          </Select>

          {hasMethodChoice(protocolId) && (
            <Select
              value={activeRequest.method}
              onChange={(event) => onMethodChange(event.target.value)}
              aria-label={TEXT.method}
              controlSize="md"
              dir="ltr"
              style={methodStyle(method)}
              className="w-28 font-mono font-semibold max-sm:w-24"
            >
              {methodOptions(activeRequest.method).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          )}

          <div className="min-w-0 flex-1 sm:min-w-40">
            <VariableInput
              ref={urlRef}
              placeholder={urlPlaceholder}
              value={activeRequest.url}
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
