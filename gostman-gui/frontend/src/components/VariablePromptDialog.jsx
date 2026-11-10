import { useState } from "react"
import { Button } from "./ui/button"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { Input } from "./ui/input"
import { ENVIRONMENT_TEXT as TEXT } from "../lib/environmentText"
import { useAppStore } from "../store/appStore"

function OpenVariablePrompt({ names, defaults, isForRun, problemsOf, onAnswer }) {
  const [values, setValues] = useState(defaults)
  const [isTried, setIsTried] = useState(false)
  const problems = problemsOf(values)

  const submit = (event) => {
    event.preventDefault()
    if (problems.length > 0) {
      setIsTried(true)
      return
    }
    onAnswer(values)
  }

  return (
    <Dialog label={TEXT.promptTitle} onClose={() => onAnswer(null)}>
      <DialogHeader>
        <DialogTitle>{TEXT.promptTitle}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="flex min-h-0 flex-col">
        <DialogBody className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">{isForRun ? TEXT.promptRunMessage : TEXT.promptMessage}</p>
          {names.map((name, index) => (
            <label key={name} className="flex flex-col gap-1 text-xs text-muted-foreground">
              <span><bdi dir="ltr">{name}</bdi></span>
              <Input
                autoFocus={index === 0}
                controlSize="md"
                value={values[name] ?? ""}
                onChange={(event) => setValues({ ...values, [name]: event.target.value })}
                autoComplete="off"
                spellCheck={false}
                dir="ltr"
                className="font-mono"
              />
            </label>
          ))}
          {isTried && problems.map(({ key, message }) => <p key={key} role="alert" className="text-2xs text-destructive">{message}</p>)}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onAnswer(null)}>{TEXT.promptCancel}</Button>
          <Button type="submit">{isForRun ? TEXT.promptContinue : TEXT.promptSend}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

export function VariablePromptDialog() {
  const prompt = useAppStore((s) => s.variablePrompt)
  const answerVariables = useAppStore((s) => s.answerVariables)
  return prompt.isOpen ? <OpenVariablePrompt names={prompt.names} defaults={prompt.defaults} isForRun={prompt.isForRun} problemsOf={prompt.problemsOf} onAnswer={answerVariables} /> : null
}
