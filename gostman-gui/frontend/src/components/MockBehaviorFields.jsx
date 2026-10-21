import { Field } from "./ui/field"
import { Input } from "./ui/input"
import { Select } from "./ui/select"
import { FAULT_EMPTY, FAULT_RESET, FAULT_STATUS, toDelayMs, toPercent, toStatus } from "../lib/mockServer"
import { MOCK_TEXT } from "../lib/mockText"

export function NumberInput({ label, value, convert, onChange, placeholder }) {
  return (
    <Input
      type="number"
      min={0}
      value={value || ""}
      placeholder={placeholder}
      aria-label={label}
      onChange={(event) => onChange(convert(event.target.value))}
      className="font-mono"
    />
  )
}

export function MockBehaviorFields({ value, onChange }) {
  const set = (changes) => onChange({ ...value, ...changes })
  const setFault = (changes) => set({ fault: { ...value.fault, ...changes } })
  const { fault } = value
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Field label={MOCK_TEXT.delay}>
        <NumberInput label={MOCK_TEXT.delay} value={value.delayMs} convert={toDelayMs} onChange={(delayMs) => set({ delayMs })} />
      </Field>
      <Field label={MOCK_TEXT.delayMax}>
        <NumberInput label={MOCK_TEXT.delayMax} value={value.delayMaxMs} convert={toDelayMs} onChange={(delayMaxMs) => set({ delayMaxMs })} />
      </Field>
      <Field label={MOCK_TEXT.slowBody}>
        <NumberInput label={MOCK_TEXT.slowBody} value={value.slowBodyMs} convert={toDelayMs} onChange={(slowBodyMs) => set({ slowBodyMs })} />
      </Field>
      <Field label={MOCK_TEXT.faultRate}>
        <NumberInput label={MOCK_TEXT.faultRate} value={fault.percent} convert={toPercent} onChange={(percent) => setFault({ percent })} />
      </Field>
      <Field label={MOCK_TEXT.faultKind}>
        <Select value={fault.kind} onChange={(event) => setFault({ kind: event.target.value })} aria-label={MOCK_TEXT.faultKind}>
          {[FAULT_STATUS, FAULT_RESET, FAULT_EMPTY].map((kind) => (
            <option key={kind} value={kind}>{MOCK_TEXT.faultKinds[kind]}</option>
          ))}
        </Select>
      </Field>
      {fault.kind === FAULT_STATUS && (
        <Field label={MOCK_TEXT.faultStatus}>
          <NumberInput label={MOCK_TEXT.faultStatus} value={fault.status} convert={toStatus} placeholder="500" onChange={(status) => setFault({ status })} />
        </Field>
      )}
    </div>
  )
}
