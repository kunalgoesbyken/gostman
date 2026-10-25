import { useState } from "react"
import { Button } from "./button"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./dialog"
import { Input } from "./input"
import { DIALOG_TEXT } from "../../lib/dialogText"

function OpenPromptDialog({ title, message, placeholder, defaultValue, confirmText, onConfirm, onCancel }) {
  const [value, setValue] = useState(defaultValue)

  const submit = (event) => {
    event.preventDefault()
    onConfirm(value)
  }

  return (
    <Dialog label={title} onClose={onCancel}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="flex min-h-0 flex-col">
        <DialogBody>
          <label className="flex flex-col gap-2 text-xs text-muted-foreground">
            {message}
            <Input
              autoFocus
              controlSize="md"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onFocus={(event) => event.target.select()}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>{DIALOG_TEXT.cancel}</Button>
          <Button type="submit">{confirmText}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

export function PromptDialog({ isOpen, ...props }) {
  return isOpen ? <OpenPromptDialog {...props} /> : null
}
