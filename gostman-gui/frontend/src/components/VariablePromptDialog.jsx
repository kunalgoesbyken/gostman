import { useState } from "react"
import { Button } from "./ui/button"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { Input } from "./ui/input"
import { ENVIRONMENT_TEXT as TEXT } from "../lib/environmentText"
import { useAppStore } from "../store/appStore"

function OpenVariablePrompt({ names, defaults, onAnswer }) {
  const [values, setValues] = useState(defaults)

  const submit = (event) => {
    event.preventDefault()
    onAnswer(values)
  }

  return (
    <Dialog label={TEXT.promptTitle} onClose={() => onAnswer(null)}>
      <DialogHeader>
        <DialogTitle>{TEXT.promptTitle}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="flex min-h-0 flex-col">
        <DialogBody className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">{TEXT.promptMessage}</p>
          {names.map((name, index) => (
            <label key={name} className="flex flex-col gap-1 text-xs text-muted-foreground">
              {name}
              <Input
                autoFocus={index === 0}
                controlSize="md"
                value={values[name] ?? ""}
                onChange={(event) => setValues({ ...values, [name]: event.target.value })}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
              />
            </label>
          ))}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onAnswer(null)}>{TEXT.promptCancel}</Button>
          <Button type="submit">{TEXT.promptSend}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

export function VariablePromptDialog() {
  const prompt = useAppStore((s) => s.variablePrompt)
  const answerVariables = useAppStore((s) => s.answerVariables)
  return prompt.isOpen ? <OpenVariablePrompt names={prompt.names} defaults={prompt.defaults} onAnswer={answerVariables} /> : null
}
