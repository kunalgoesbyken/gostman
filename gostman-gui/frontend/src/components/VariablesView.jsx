import { useId, useMemo } from "react"
import { SlidersHorizontal } from "lucide-react"
import { VariableValueField } from "./VariableValueField"
import { Button } from "./ui/button"
import { EmptyState } from "./ui/emptyState"
import { PanelBody } from "./ui/panel"
import { PROBLEM_REQUIRED, isShownInForm, problemOf, problemText, usesCheckbox, variableName } from "../lib/requestVariables"
import { parseRows, serializeRows } from "../lib/rows"
import { VARIABLES_VIEW_TEXT as TEXT } from "../lib/variablesPanelText"

const textOf = (value) => (typeof value === "string" ? value.trim() : "")

function FormField({ row, isRevealed, onChange }) {
  const id = useId()
  const helpId = `${id}-help`
  const problemId = `${id}-problem`
  const name = variableName(row)
  const help = textOf(row.help)
  const problem = problemOf(row)
  const showsProblem = problem !== "" && (problem !== PROBLEM_REQUIRED || isRevealed)
  const isBoolean = usesCheckbox(row)
  const describedBy = [help && helpId, showsProblem && problemId].filter(Boolean).join(" ") || undefined

  return (
    <div className="flex flex-col gap-1">
      {!isBoolean && (
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-foreground">{name}</span>
          {row.required === true && <span className="text-2xs text-muted-foreground">{TEXT.required}</span>}
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
      {showsProblem && <p id={problemId} role="alert" className="text-2xs text-destructive">{problemText(row, problem)}</p>}
    </div>
  )
}

export const focusFirstProblem = () => document.querySelector('[aria-invalid="true"]')?.focus()

export function VariablesView({ request, isRevealed, onUpdateRequest, onOpenEditor }) {
  const rows = useMemo(() => parseRows(request.vars), [request.vars])
  const shown = rows.map((row, index) => ({ row, index })).filter(({ row }) => isShownInForm(row))

  const change = (index, patch) => onUpdateRequest({ vars: serializeRows(rows.map((row, at) => (at === index ? { ...row, ...patch } : row))) })

  if (shown.length === 0) {
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
    <PanelBody>
      <form aria-label={TEXT.formLabel} onSubmit={(event) => event.preventDefault()} className="flex max-w-xl flex-col gap-4">
        {shown.map(({ row, index }) => (
          <FormField key={index} row={row} isRevealed={isRevealed} onChange={(patch) => change(index, patch)} />
        ))}
      </form>
    </PanelBody>
  )
}
