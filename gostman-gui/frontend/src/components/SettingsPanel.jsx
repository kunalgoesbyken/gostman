import { Checkbox } from "./ui/checkbox"
import { Field } from "./ui/field"
import { Input } from "./ui/input"
import { PanelBody } from "./ui/panel"

const DEFAULT_TIMEOUT_MS = 30000
const CHECKBOX_CLASS = "h-7 justify-start self-start"

const toTimeoutMs = (text) => Math.max(0, Math.trunc(Number(text)) || 0)

export function SettingsPanel({ options, onChange }) {
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
            onChange={(event) => update({ timeoutMs: toTimeoutMs(event.target.value) })}
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
      </div>
    </PanelBody>
  )
}
