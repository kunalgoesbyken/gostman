import { Checkbox } from "./ui/checkbox"
import { Field } from "./ui/field"
import { Input } from "./ui/input"
import { PanelBody } from "./ui/panel"
import { Textarea } from "./ui/textarea"
import { SSE_SETTINGS_TEXT } from "../lib/sse"

const DEFAULT_TIMEOUT_MS = 30000
const CHECKBOX_CLASS = "h-7 justify-start self-start"

const toWholeNumber = (text) => Math.max(0, Math.trunc(Number(text)) || 0)

export function SettingsPanel({ options, description, onChange, onDescriptionChange }) {
  const update = (patch) => onChange({ ...options, ...patch })

  return (
    <PanelBody className="h-full">
      <div className="flex max-w-xl flex-col gap-2">
        <Field label="Timeout (ms)">
          <Input
            type="number"
            min={0}
            step={1000}
            value={options.timeoutMs || ""}
            placeholder={`${DEFAULT_TIMEOUT_MS} (default)`}
            onChange={(event) => update({ timeoutMs: toWholeNumber(event.target.value) })}
            className="max-w-48 font-mono"
          />
        </Field>
        <Checkbox
          checked={!options.noFollowRedirects}
          onChange={(event) => update({ noFollowRedirects: !event.target.checked })}
          className={CHECKBOX_CLASS}
        >
          Follow redirects
        </Checkbox>
        <Checkbox
          checked={!options.insecureTLS}
          onChange={(event) => update({ insecureTLS: !event.target.checked })}
          className={CHECKBOX_CLASS}
        >
          Verify TLS certificates
        </Checkbox>
        <Checkbox
          checked={options.stream}
          onChange={(event) => update({ stream: event.target.checked })}
          className={CHECKBOX_CLASS}
        >
          {SSE_SETTINGS_TEXT.stream}
        </Checkbox>
        {options.stream && (
          <>
            <Checkbox
              checked={options.streamReconnect}
              onChange={(event) => update({ streamReconnect: event.target.checked })}
              className={CHECKBOX_CLASS}
            >
              {SSE_SETTINGS_TEXT.reconnect}
            </Checkbox>
            <Field label={SSE_SETTINGS_TEXT.maxEvents}>
              <Input
                type="number"
                min={0}
                value={options.streamMaxEvents || ""}
                placeholder={SSE_SETTINGS_TEXT.maxEventsPlaceholder}
                onChange={(event) => update({ streamMaxEvents: toWholeNumber(event.target.value) })}
                className="max-w-48 font-mono"
              />
            </Field>
            <Field label={SSE_SETTINGS_TEXT.maxSeconds}>
              <Input
                type="number"
                min={0}
                value={options.streamMaxSeconds || ""}
                placeholder={SSE_SETTINGS_TEXT.maxSecondsPlaceholder}
                onChange={(event) => update({ streamMaxSeconds: toWholeNumber(event.target.value) })}
                className="max-w-48 font-mono"
              />
            </Field>
          </>
        )}
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="What this request does, shown in generated documentation"
            rows={3}
            className="font-sans"
          />
        </Field>
      </div>
    </PanelBody>
  )
}
