import { X } from "lucide-react"
import { IconButton } from "../ui/button"
import { Input } from "../ui/input"
import { Select } from "../ui/select"
import { SourceSelect, SourceValue } from "./ValueSource"
import { FLOW_EDITOR_TEXT as TEXT } from "../../lib/flowsText"
import { INPUT_HEADER, INPUT_TARGETS, editedSendRows, sendRows } from "../../lib/flows/inputs"
import { cn } from "../../lib/utils"

const BLANK_INPUT = { target: INPUT_HEADER, name: "", value: "" }

const isFilled = (input) => input.target !== INPUT_HEADER || input.name.trim() !== "" || Boolean(input.step || input.value || input.source)

function InputRow({ input, isDraft, index, requests, onChange, onRemove }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border p-2">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_1.75rem] items-center gap-2">
        <Select value={input.target} onChange={(event) => onChange({ ...input, target: event.target.value })} aria-label={TEXT.inputTarget}>
          {INPUT_TARGETS.map((target) => <option key={target} value={target}>{TEXT.inputTargets[target]}</option>)}
        </Select>
        <SourceSelect value={input} onChange={onChange} />
        <IconButton label={TEXT.removeRow} icon={X} onClick={onRemove} className={cn(isDraft && "invisible")} />
      </div>
      <Input
        value={input.name}
        placeholder={TEXT.inputPlaceholders[input.target] || TEXT.inputName}
        aria-label={TEXT.inputName}
        spellCheck={false}
        onChange={(event) => onChange({ ...input, name: event.target.value })}
        className="font-mono"
      />
      <SourceValue value={input} index={index} requests={requests} onChange={onChange} />
    </div>
  )
}

export function StepInputs({ variables, inputs, index, requests, onChange }) {
  const filled = sendRows({ variables, inputs })
  const rows = [...filled, BLANK_INPUT]
  const commit = (next) => onChange(editedSendRows(next.filter(isFilled)))
  return (
    <>
      <div className="flex flex-col gap-1.5">
        {rows.map((input, position) => (
          <InputRow
            key={position}
            input={input}
            isDraft={position === filled.length}
            index={index}
            requests={requests}
            onChange={(next) => commit(rows.map((row, at) => (at === position ? next : row)))}
            onRemove={() => commit(rows.filter((_, at) => at !== position))}
          />
        ))}
      </div>
      <p className="text-2xs text-muted-foreground">{TEXT.inputsHint}</p>
    </>
  )
}
