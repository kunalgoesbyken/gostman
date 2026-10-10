import { Field } from "./ui/field"
import { Input } from "./ui/input"

const DEFAULT_TIMEOUT_MS = 30000
const CHECKBOX = "h-3.5 w-3.5 justify-self-start accent-primary"

const toTimeoutMs = (text) => Math.max(0, Math.trunc(Number(text)) || 0)

export function SettingsPanel({ options, onChange }) {
  const update = (patch) => onChange({ ...options, ...patch })

  return (
    <div className="h-full overflow-auto px-4 py-3 scrollbar-primary">
      <div className="flex max-w-xl flex-col gap-3">
        <Field label="Timeout (ms)">
          <Input
            type="number"
            min={0}
            step={1000}
            value={options.timeoutMs || ""}
            placeholder={`${DEFAULT_TIMEOUT_MS} (default)`}
            onChange={(event) => update({ timeoutMs: toTimeoutMs(event.target.value) })}
            className="w-48 font-mono text-xs"
          />
        </Field>
        <Field label="Follow redirects">
          <input
            type="checkbox"
            checked={!options.noFollowRedirects}
            onChange={(event) => update({ noFollowRedirects: !event.target.checked })}
            className={CHECKBOX}
          />
        </Field>
        <Field label="Verify TLS certificates">
          <input
            type="checkbox"
            checked={!options.insecureTLS}
            onChange={(event) => update({ insecureTLS: !event.target.checked })}
            className={CHECKBOX}
          />
        </Field>
      </div>
    </div>
  )
}
