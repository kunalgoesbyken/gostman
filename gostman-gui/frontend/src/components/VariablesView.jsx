import { useEffect, useId, useMemo, useRef } from "react"
import { RotateCcw, SlidersHorizontal } from "lucide-react"
import { VariableValueField } from "./VariableValueField"
import { Button } from "./ui/button"
import { EmptyState } from "./ui/emptyState"
import { PanelBody } from "./ui/panel"
import { PROBLEM_REQUIRED, usesCheckbox, variableName } from "../lib/requestVariables"
import { filledForm, hasNamedRows } from "../lib/variablesForm"
import { parseRows } from "../lib/rows"
import { VARIABLES_VIEW_TEXT as TEXT } from "../lib/variablesPanelText"
import { useShallow } from "zustand/react/shallow"
import { useAppStore } from "../store/appStore"
import { scopeState } from "../lib/variableScopes"

const SUBMIT_KEY = "Enter"
const INPUT_TAG = "INPUT"

const textOf = (value) => (typeof value === "string" ? value.trim() : "")

const hasModifier = (event) => event.shiftKey || event.altKey || event.ctrlKey || event.metaKey

const submitsForm = (event) => (
  event.key === SUBMIT_KEY && !hasModifier(event) && !event.defaultPrevented && !event.nativeEvent.isComposing && event.target.tagName === INPUT_TAG
)

function FormField({ row, problem, isRequired, isRevealed, onChange }) {
  const id = useId()
  const helpId = `${id}-help`
  const problemId = `${id}-problem`
  const name = variableName(row)
  const help = textOf(row.help)
  const showsProblem = Boolean(problem) && (problem.problem !== PROBLEM_REQUIRED || isRevealed)
  const isBoolean = usesCheckbox(row)
  const describedBy = [help && helpId, showsProblem && problemId].filter(Boolean).join(" ") || undefined

  return (
    <div className="flex flex-col gap-1">
      {!isBoolean && (
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-foreground">{name}</span>
          {isRequired && <span className="text-2xs text-muted-foreground">{TEXT.required}</span>}
        </div>
      )}
      <VariableValueField
        row={row}
        label={name}
        placeholder={textOf(row.placeholder)}
        multiline
        onChange={onChange}
        aria-describedby={describedBy}
        aria-invalid={showsProblem || undefined}
      />
      {help && <p id={helpId} className="text-2xs text-muted-foreground">{help}</p>}
      {showsProblem && <p id={problemId} role="alert" className="text-2xs text-destructive">{problem.message}</p>}
    </div>
  )
}

function NoFields({ rows, onOpenEditor, onOpenVars }) {
  if (!hasNamedRows(rows)) {
    return (
      <EmptyState
        icon={SlidersHorizontal}
        title={TEXT.emptyTitle}
        description={TEXT.emptyDescription}
        action={<Button size="sm" variant="outline" onClick={onOpenEditor}>{TEXT.openEditor}</Button>}
      />
    )
  }
  return (
    <EmptyState
      icon={SlidersHorizontal}
      title={TEXT.noFieldsTitle}
      description={TEXT.noFieldsDescription}
      action={<Button size="sm" variant="outline" onClick={onOpenVars}>{TEXT.openVars}</Button>}
    />
  )
}

export function VariablesView({ tab, onChange, onReset, onSend, onOpenEditor, onOpenVars }) {
  const formRef = useRef(null)
  const { request, formValues } = tab
  const attempt = tab.formAttempt || 0
  const state = useAppStore(useShallow(scopeState))
  const rows = useMemo(() => parseRows(request.vars), [request.vars])
  const { fields, problems, isChanged } = useMemo(() => filledForm(state, request, formValues), [state, request, formValues])

  useEffect(() => {
    if (attempt > 0) formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
  }, [attempt])

  if (fields.length === 0) return <NoFields rows={rows} onOpenEditor={onOpenEditor} onOpenVars={onOpenVars} />

  const send = (event) => {
    event.preventDefault()
    onSend()
  }
  const sendOnEnter = (event) => {
    if (!submitsForm(event)) return
    event.preventDefault()
    onSend()
  }

  return (
    <PanelBody>
      <form ref={formRef} aria-label={TEXT.formLabel} onSubmit={send} onKeyDown={sendOnEnter} className="flex max-w-xl flex-col gap-4">
        {fields.map(({ row, saved, index, isRequired }) => (
          <FormField key={index} row={row} problem={problems.find((problem) => problem.key === row.key)} isRequired={isRequired} isRevealed={attempt > 0} onChange={(patch) => onChange(saved, patch.value)} />
        ))}
        {isChanged && (
          <div>
            <Button type="button" size="sm" variant="ghost" title={TEXT.resetHint} onClick={onReset}>
              <RotateCcw />
              {TEXT.reset}
            </Button>
          </div>
        )}
      </form>
    </PanelBody>
  )
}
