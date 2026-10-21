import { useState } from "react"
import { ChevronDown, ChevronRight, ChevronUp, Plus, Trash2, X } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Field } from "./ui/field"
import { Input } from "./ui/input"
import { SectionLabel } from "./ui/panel"
import { Select } from "./ui/select"
import { Textarea } from "./ui/textarea"
import { MethodTag } from "./MethodTag"
import { MockBehaviorFields, NumberInput } from "./MockBehaviorFields"
import { FIELD_BODY, FIELD_HEADER, FIELD_QUERY, OP_CONTAINS, OP_EQUALS, OP_EXISTS, emptyCondition, headersToText, textToHeaders, toCount, toStatus } from "../lib/mockServer"
import { MOCK_TEXT } from "../lib/mockText"

const RULE_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
const FIELDS = [FIELD_QUERY, FIELD_HEADER, FIELD_BODY]
const OPS = [OP_EQUALS, OP_CONTAINS, OP_EXISTS]

function ConditionRow({ condition, onChange, onRemove }) {
  const set = (changes) => onChange({ ...condition, ...changes })
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_6.5rem_minmax(0,1fr)_1.75rem] items-center gap-2">
      <Select value={condition.field} onChange={(event) => set({ field: event.target.value })} aria-label={MOCK_TEXT.conditionField}>
        {FIELDS.map((field) => <option key={field} value={field}>{MOCK_TEXT.fields[field]}</option>)}
      </Select>
      <Input
        value={condition.name}
        onChange={(event) => set({ name: event.target.value })}
        placeholder={condition.field === FIELD_BODY ? MOCK_TEXT.bodyWhole : MOCK_TEXT.conditionName}
        title={condition.field === FIELD_BODY ? MOCK_TEXT.bodyWhole : undefined}
        aria-label={MOCK_TEXT.conditionName}
        className="font-mono"
      />
      <Select value={condition.op} onChange={(event) => set({ op: event.target.value })} aria-label={MOCK_TEXT.conditionOp}>
        {OPS.map((op) => <option key={op} value={op}>{MOCK_TEXT.ops[op]}</option>)}
      </Select>
      <Input
        value={condition.value}
        disabled={condition.op === OP_EXISTS}
        onChange={(event) => set({ value: event.target.value })}
        placeholder={MOCK_TEXT.conditionValue}
        aria-label={MOCK_TEXT.conditionValue}
        className="font-mono"
      />
      <IconButton label={MOCK_TEXT.remove} icon={X} size="icon-xs" onClick={onRemove} />
    </div>
  )
}

function Conditions({ conditions, onChange }) {
  const replace = (index, next) => onChange(conditions.map((condition, at) => (at === index ? next : condition)))
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>{MOCK_TEXT.when}</SectionLabel>
      {conditions.map((condition, index) => (
        <ConditionRow
          key={index}
          condition={condition}
          onChange={(next) => replace(index, next)}
          onRemove={() => onChange(conditions.filter((_, at) => at !== index))}
        />
      ))}
      <Button variant="outline" size="sm" className="self-start" onClick={() => onChange([...conditions, emptyCondition()])}>
        <Plus />
        {MOCK_TEXT.addCondition}
      </Button>
    </div>
  )
}

function HeadersField({ headers, onCommit }) {
  const [text, setText] = useState(headersToText(headers))
  return (
    <Textarea
      rows={3}
      value={text}
      aria-label={MOCK_TEXT.headersLabel}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => onCommit(textToHeaders(text))}
    />
  )
}

function RuleForm({ rule, onChange }) {
  return (
    <div className="flex flex-col gap-3 px-3 pb-3 pt-1">
      <div className="grid grid-cols-[minmax(0,1fr)_8rem_minmax(0,1.5fr)] gap-2">
        <Input value={rule.name} onChange={(event) => onChange({ name: event.target.value })} placeholder={MOCK_TEXT.ruleName} aria-label={MOCK_TEXT.ruleName} />
        <Select value={rule.method} onChange={(event) => onChange({ method: event.target.value })} aria-label={MOCK_TEXT.methodLabel}>
          <option value="">{MOCK_TEXT.anyMethod}</option>
          {RULE_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
        </Select>
        <Input value={rule.path} onChange={(event) => onChange({ path: event.target.value })} placeholder={MOCK_TEXT.pathPlaceholder} aria-label={MOCK_TEXT.pathLabel} className="font-mono" />
      </div>
      <Conditions conditions={rule.conditions} onChange={(conditions) => onChange({ conditions })} />
      <SectionLabel>{MOCK_TEXT.respond}</SectionLabel>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label={MOCK_TEXT.status}>
          <NumberInput label={MOCK_TEXT.status} value={rule.status} convert={toStatus} placeholder={MOCK_TEXT.statusPlaceholder} onChange={(status) => onChange({ status })} />
        </Field>
        <Field label={MOCK_TEXT.nth}>
          <NumberInput label={MOCK_TEXT.nth} value={rule.nth} convert={toCount} placeholder={MOCK_TEXT.nthPlaceholder} onChange={(nth) => onChange({ nth })} />
        </Field>
      </div>
      <SectionLabel>{MOCK_TEXT.headersLabel}</SectionLabel>
      <HeadersField headers={rule.headers} onCommit={(headers) => onChange({ headers })} />
      <SectionLabel>{MOCK_TEXT.bodyLabel}</SectionLabel>
      <Textarea
        rows={5}
        value={rule.body}
        aria-label={MOCK_TEXT.bodyLabel}
        onChange={(event) => onChange({ body: event.target.value })}
      />
      <p className="text-xs text-muted-foreground">{MOCK_TEXT.bodyHint}</p>
      <SectionLabel>{MOCK_TEXT.behaviorTitle}</SectionLabel>
      <p className="text-xs text-muted-foreground">{MOCK_TEXT.inherit}</p>
      <MockBehaviorFields value={rule.behavior} onChange={(behavior) => onChange({ behavior })} />
    </div>
  )
}

export function MockRuleEditor({ rule, position, isLast, actions }) {
  const [isOpen, setIsOpen] = useState(false)
  const label = rule.name || MOCK_TEXT.ruleUnnamed
  const onChange = (changes) => actions.updateRule(rule.id, changes)
  return (
    <li className="border-b border-border">
      <div className="flex h-9 items-center gap-2 px-3">
        <Checkbox label={MOCK_TEXT.ruleSwitch(label)} checked={!rule.disabled} onChange={(event) => onChange({ disabled: !event.target.checked })} />
        <span className="w-4 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{position}</span>
        <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen(!isOpen)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs">
          {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          <span className="min-w-0 truncate text-foreground">{label}</span>
          {rule.method && <MethodTag method={rule.method} />}
          <span className="min-w-0 truncate font-mono text-muted-foreground">{rule.path}</span>
        </button>
        <IconButton label={MOCK_TEXT.moveUp} icon={ChevronUp} size="icon-xs" disabled={position === 1} onClick={() => actions.moveRule(rule.id, -1)} />
        <IconButton label={MOCK_TEXT.moveDown} icon={ChevronDown} size="icon-xs" disabled={isLast} onClick={() => actions.moveRule(rule.id, 1)} />
        <IconButton label={MOCK_TEXT.remove} icon={Trash2} size="icon-xs" onClick={() => actions.removeRule(rule.id)} />
      </div>
      {isOpen && <RuleForm rule={rule} onChange={onChange} />}
    </li>
  )
}
