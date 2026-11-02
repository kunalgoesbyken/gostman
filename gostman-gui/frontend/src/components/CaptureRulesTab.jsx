import { useRef, useState } from "react"
import { ChevronDown, ChevronRight, ChevronUp, Download, Plus, Trash2, Upload, X } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Field } from "./ui/field"
import { Input } from "./ui/input"
import { Notice, SectionLabel } from "./ui/panel"
import { Select } from "./ui/select"
import { Textarea } from "./ui/textarea"
import { MethodTag } from "./MethodTag"
import { NumberInput } from "./MockBehaviorFields"
import {
  BREAK_BOTH, BREAK_NONE, BREAK_REQUEST, BREAK_RESPONSE,
  BODY_MODE_JSON, BODY_MODE_REGEX, BODY_MODE_TEXT,
  bodyEditForMode, bodyModeOf, emptyAnswer, emptyBodyEdit, namesToText, textToNames,
} from "../lib/captureRules"
import { CAPTURE_RULES_TEXT as TEXT } from "../lib/captureText"
import {
  FAULT_EMPTY, FAULT_RESET, FAULT_STATUS, FIELD_HEADER, FIELD_QUERY, OP_CONTAINS, OP_EQUALS, OP_EXISTS,
  emptyCondition, headersToText, textToHeaders, toDelayMs, toPercent, toStatus,
} from "../lib/mockServer"

const CONDITION_FIELDS = [FIELD_QUERY, FIELD_HEADER]
const OPS = [OP_EQUALS, OP_CONTAINS, OP_EXISTS]
const BODY_MODES = [BODY_MODE_TEXT, BODY_MODE_REGEX, BODY_MODE_JSON]
const HOLD_KINDS = [BREAK_NONE, BREAK_REQUEST, BREAK_RESPONSE, BREAK_BOTH]
const FASTEST_KBPS = 1_000_000

const toKbps = (text) => Math.min(FASTEST_KBPS, Math.max(0, Math.trunc(Number(text)) || 0))

function TextBlock({ label, rows = 3, value, toText, fromText, onCommit }) {
  const [text, setText] = useState(toText(value))
  return (
    <Textarea
      rows={rows}
      value={text}
      aria-label={label}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => onCommit(fromText(text))}
      className="font-mono"
    />
  )
}

function ConditionRow({ condition, onChange, onRemove }) {
  const set = (changes) => onChange({ ...condition, ...changes })
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_6.5rem_minmax(0,1fr)_1.75rem] items-center gap-2">
      <Select value={condition.field} onChange={(event) => set({ field: event.target.value })} aria-label={TEXT.conditionField}>
        {CONDITION_FIELDS.map((field) => <option key={field} value={field}>{TEXT.fields[field]}</option>)}
      </Select>
      <Input value={condition.name} onChange={(event) => set({ name: event.target.value })} aria-label={TEXT.conditionName} placeholder={TEXT.conditionName} className="font-mono" />
      <Select value={condition.op} onChange={(event) => set({ op: event.target.value })} aria-label={TEXT.conditionOp}>
        {OPS.map((op) => <option key={op} value={op}>{TEXT.ops[op]}</option>)}
      </Select>
      <Input value={condition.value} disabled={condition.op === OP_EXISTS} onChange={(event) => set({ value: event.target.value })} aria-label={TEXT.conditionValue} placeholder={TEXT.conditionValue} className="font-mono" />
      <IconButton label={TEXT.remove} icon={X} size="icon-xs" onClick={onRemove} />
    </div>
  )
}

function MatchFields({ match, onChange }) {
  const set = (changes) => onChange({ ...match, ...changes })
  const conditions = match.conditions
  const replace = (index, next) => set({ conditions: conditions.map((one, at) => (at === index ? next : one)) })
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>{TEXT.when}</SectionLabel>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input value={match.method} onChange={(event) => set({ method: event.target.value })} placeholder={TEXT.methods} aria-label={TEXT.methods} className="font-mono" />
        <Input value={match.host} onChange={(event) => set({ host: event.target.value })} placeholder={TEXT.host} aria-label={TEXT.host} className="font-mono" />
        <Input value={match.path} onChange={(event) => set({ path: event.target.value })} placeholder={TEXT.path} aria-label={TEXT.path} className="font-mono" />
        <Input value={match.pathRegex} onChange={(event) => set({ pathRegex: event.target.value })} placeholder={TEXT.pathRegex} aria-label={TEXT.pathRegex} className="font-mono" />
      </div>
      {conditions.map((condition, index) => (
        <ConditionRow key={index} condition={condition} onChange={(next) => replace(index, next)} onRemove={() => set({ conditions: conditions.filter((_, at) => at !== index) })} />
      ))}
      <Button variant="outline" size="sm" className="self-start" onClick={() => set({ conditions: [...conditions, emptyCondition()] })}>
        <Plus />
        {TEXT.addCondition}
      </Button>
    </div>
  )
}

function BodyChangeRow({ change, onChange, onRemove }) {
  const mode = bodyModeOf(change)
  const set = (changes) => onChange({ ...change, ...changes })
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)_minmax(0,1fr)_1.75rem] items-center gap-2">
      <Select value={mode} onChange={(event) => onChange(bodyEditForMode(event.target.value, change))} aria-label={TEXT.bodyMode}>
        {BODY_MODES.map((one) => <option key={one} value={one}>{TEXT.bodyModes[one]}</option>)}
      </Select>
      {mode === BODY_MODE_JSON ? (
        <>
          <Input value={change.path} onChange={(event) => set({ path: event.target.value })} placeholder={TEXT.jsonPath} aria-label={TEXT.jsonPath} className="font-mono" />
          <Input value={change.value} onChange={(event) => set({ value: event.target.value })} placeholder={TEXT.jsonValue} aria-label={TEXT.jsonValue} className="font-mono" />
        </>
      ) : (
        <>
          <Input value={change.find} onChange={(event) => set({ find: event.target.value })} placeholder={TEXT.find} aria-label={TEXT.find} className="font-mono" />
          <Input value={change.replace} onChange={(event) => set({ replace: event.target.value })} placeholder={TEXT.replace} aria-label={TEXT.replace} className="font-mono" />
        </>
      )}
      <IconButton label={TEXT.removeBodyChange} icon={X} size="icon-xs" onClick={onRemove} />
    </div>
  )
}

function EditFields({ title, edit, onChange }) {
  const set = (changes) => onChange({ ...edit, ...changes })
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>{title}</SectionLabel>
      <TextBlock label={TEXT.setHeaders} value={edit.setHeaders} toText={headersToText} fromText={textToHeaders} onCommit={(setHeaders) => set({ setHeaders })} />
      <Input
        defaultValue={namesToText(edit.removeHeaders)}
        onBlur={(event) => set({ removeHeaders: textToNames(event.target.value) })}
        placeholder={TEXT.removeHeaders}
        aria-label={TEXT.removeHeaders}
        className="font-mono"
      />
      {edit.body.map((change, index) => (
        <BodyChangeRow
          key={index}
          change={change}
          onChange={(next) => set({ body: edit.body.map((one, at) => (at === index ? next : one)) })}
          onRemove={() => set({ body: edit.body.filter((_, at) => at !== index) })}
        />
      ))}
      <Button variant="outline" size="sm" className="self-start" onClick={() => set({ body: [...edit.body, emptyBodyEdit()] })}>
        <Plus />
        {TEXT.addBodyChange}
      </Button>
    </div>
  )
}

function AnswerSection({ rule, onChange }) {
  const answer = rule.answer
  const set = (changes) => onChange({ answer: { ...answer, ...changes } })
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>{TEXT.answer}</SectionLabel>
      <label className="flex items-center gap-2 text-xs text-foreground">
        <Checkbox label={TEXT.answerSwitch} checked={Boolean(answer)} onChange={(event) => onChange({ answer: event.target.checked ? emptyAnswer() : null })} />
        {TEXT.answerSwitch}
      </label>
      {answer && (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label={TEXT.answerStatus}>
              <NumberInput label={TEXT.answerStatus} value={answer.status} convert={toStatus} onChange={(status) => set({ status })} />
            </Field>
            <Field label={TEXT.answerContentType}>
              <Input value={answer.contentType} onChange={(event) => set({ contentType: event.target.value })} aria-label={TEXT.answerContentType} className="font-mono" />
            </Field>
          </div>
          <TextBlock label={TEXT.answerHeaders} value={answer.headers} toText={headersToText} fromText={textToHeaders} onCommit={(headers) => set({ headers })} />
          {answer.bodyEncoding === "base64" ? (
            <Notice>{TEXT.binaryAnswer}</Notice>
          ) : (
            <Textarea rows={5} value={answer.body} aria-label={TEXT.answerBody} onChange={(event) => set({ body: event.target.value })} className="font-mono" />
          )}
          <Input value={answer.file} onChange={(event) => set({ file: event.target.value })} placeholder={TEXT.answerFile} aria-label={TEXT.answerFile} className="font-mono" />
          <p className="text-xs text-muted-foreground">{TEXT.answerFileHint}</p>
        </>
      )}
    </div>
  )
}

function TimingSection({ rule, onChange }) {
  const throttle = rule.throttle
  const fault = rule.fault
  const setThrottle = (changes) => onChange({ throttle: { ...throttle, ...changes } })
  const setFault = (changes) => onChange({ fault: { ...fault, ...changes } })
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>{TEXT.timing}</SectionLabel>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label={TEXT.delay}><NumberInput label={TEXT.delay} value={rule.delayMs} convert={toDelayMs} onChange={(delayMs) => onChange({ delayMs })} /></Field>
        <Field label={TEXT.delayMax}><NumberInput label={TEXT.delayMax} value={rule.delayMaxMs} convert={toDelayMs} onChange={(delayMaxMs) => onChange({ delayMaxMs })} /></Field>
        <Field label={TEXT.latency}><NumberInput label={TEXT.latency} value={throttle.latencyMs} convert={toDelayMs} onChange={(latencyMs) => setThrottle({ latencyMs })} /></Field>
        <Field label={TEXT.download}><NumberInput label={TEXT.download} value={throttle.downloadKBps} convert={toKbps} onChange={(downloadKBps) => setThrottle({ downloadKBps })} /></Field>
        <Field label={TEXT.upload}><NumberInput label={TEXT.upload} value={throttle.uploadKBps} convert={toKbps} onChange={(uploadKBps) => setThrottle({ uploadKBps })} /></Field>
      </div>
      <SectionLabel>{TEXT.failure}</SectionLabel>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label={TEXT.faultRate}><NumberInput label={TEXT.faultRate} value={fault.percent} convert={toPercent} onChange={(percent) => setFault({ percent })} /></Field>
        <Field label={TEXT.faultKind}>
          <Select value={fault.kind} onChange={(event) => setFault({ kind: event.target.value })} aria-label={TEXT.faultKind}>
            {[FAULT_STATUS, FAULT_RESET, FAULT_EMPTY].map((kind) => <option key={kind} value={kind}>{TEXT.faultKinds[kind]}</option>)}
          </Select>
        </Field>
        {fault.kind === FAULT_STATUS && (
          <Field label={TEXT.faultStatus}><NumberInput label={TEXT.faultStatus} value={fault.status} convert={toStatus} placeholder="500" onChange={(status) => setFault({ status })} /></Field>
        )}
      </div>
    </div>
  )
}

function RuleForm({ rule, onChange }) {
  return (
    <div className="flex flex-col gap-3 px-3 pb-3 pt-1">
      <Input value={rule.name} onChange={(event) => onChange({ name: event.target.value })} placeholder={TEXT.ruleName} aria-label={TEXT.ruleName} />
      <MatchFields match={rule.match} onChange={(match) => onChange({ match })} />
      <EditFields title={TEXT.requestEdits} edit={rule.request} onChange={(request) => onChange({ request })} />
      <EditFields title={TEXT.responseEdits} edit={rule.response} onChange={(response) => onChange({ response })} />
      <SectionLabel>{TEXT.mapRemote}</SectionLabel>
      <Input value={rule.mapRemote} onChange={(event) => onChange({ mapRemote: event.target.value })} placeholder={TEXT.mapRemotePlaceholder} aria-label={TEXT.mapRemote} className="font-mono" />
      <AnswerSection rule={rule} onChange={onChange} />
      <TimingSection rule={rule} onChange={onChange} />
      <Field label={TEXT.hold}>
        <Select value={rule.break} onChange={(event) => onChange({ break: event.target.value })} aria-label={TEXT.hold}>
          {HOLD_KINDS.map((kind) => <option key={kind} value={kind}>{TEXT.holdKinds[kind || "none"]}</option>)}
        </Select>
      </Field>
    </div>
  )
}

function RuleRow({ rule, position, isLast, isLocked, actions }) {
  const [isOpen, setIsOpen] = useState(false)
  const label = rule.name || TEXT.unnamed
  const onChange = (changes) => actions.updateRule(rule.id, changes)
  return (
    <li className="border-b border-border">
      <div className="flex h-9 items-center gap-2 px-3">
        <Checkbox label={TEXT.switch(label)} checked={!rule.disabled} disabled={isLocked} onChange={(event) => onChange({ disabled: !event.target.checked })} />
        <span className="w-4 shrink-0 text-end font-mono text-3xs text-muted-foreground">{position}</span>
        <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen(!isOpen)} className="flex min-w-0 flex-1 items-center gap-2 text-start text-xs">
          {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 rtl:-scale-x-100" />}
          <span className="min-w-0 truncate text-foreground">{label}</span>
          {rule.match.method && <MethodTag method={rule.match.method.split(",")[0].trim().toUpperCase()} />}
          <span className="min-w-0 truncate font-mono text-muted-foreground">{rule.match.path || rule.match.pathRegex}</span>
          {rule.mapRemote && <span className="min-w-0 truncate font-mono text-muted-foreground">{"-> "}{rule.mapRemote}</span>}
        </button>
        <IconButton label={TEXT.moveUp} icon={ChevronUp} size="icon-xs" disabled={isLocked || position === 1} onClick={() => actions.moveRule(rule.id, -1)} />
        <IconButton label={TEXT.moveDown} icon={ChevronDown} size="icon-xs" disabled={isLocked || isLast} onClick={() => actions.moveRule(rule.id, 1)} />
        <IconButton label={TEXT.remove} icon={Trash2} size="icon-xs" disabled={isLocked} onClick={() => actions.removeRule(rule.id)} />
      </div>
      {isOpen && (
        <fieldset disabled={isLocked} className="min-w-0">
          <RuleForm rule={rule} onChange={onChange} />
        </fieldset>
      )}
    </li>
  )
}

export function CaptureRulesTab({ config, onTrust, actions }) {
  const fileInput = useRef(null)
  const isLocked = config.restricted
  const { rules } = config
  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground max-sm:basis-full">{TEXT.hint}</p>
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          {TEXT.breakTimeout}
          <Input type="number" min={1} value={config.breakSeconds || ""} placeholder="60" disabled={isLocked} onChange={(event) => actions.setBreakSeconds(Math.max(0, Math.trunc(Number(event.target.value)) || 0))} className="w-16 font-mono" />
        </label>
        <input ref={fileInput} type="file" accept=".yaml,.yml,.json" className="hidden" onChange={(event) => {
          const [file] = event.target.files
          event.target.value = ""
          if (file) actions.importRules(file)
        }} />
        <Button variant="outline" size="sm" disabled={isLocked} onClick={() => fileInput.current.click()}>
          <Upload />
          {TEXT.import}
        </Button>
        <Button variant="outline" size="sm" disabled={rules.length === 0} onClick={actions.exportRules}>
          <Download />
          {TEXT.export}
        </Button>
        <Button variant="outline" size="sm" disabled={isLocked} onClick={actions.addRule}>
          <Plus />
          {TEXT.add}
        </Button>
      </div>
      {isLocked && <Notice tone="warning">{TEXT.restricted}</Notice>}
      {isLocked && onTrust && (
        <div className="flex shrink-0 border-b border-border px-3 py-2">
          <Button variant="outline" size="sm" onClick={onTrust}>{TEXT.trust}</Button>
        </div>
      )}
      {rules.length === 0 ? (
        <Notice>{TEXT.none}</Notice>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto" aria-label={TEXT.listLabel}>
          {rules.map((rule, index) => (
            <RuleRow key={rule.id} rule={rule} position={index + 1} isLast={index === rules.length - 1} isLocked={isLocked} actions={actions} />
          ))}
        </ul>
      )}
    </>
  )
}
