import React, { useState, useEffect, useRef } from "react"
import { Edit3 } from "lucide-react"
import { Button } from "./button"
import { Input } from "./input"

/**
 * PromptDialog - A modal for getting text input
 * Non-blocking alternative to native prompt()
 */
export function PromptDialog({
  isOpen,
  title = "Input Required",
  message,
  placeholder = "",
  defaultValue = "",
  confirmText = "OK",
  cancelText = "Cancel",
  onConfirm,
  onCancel
}) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef(null)

  useEffect(() => {
    setValue(defaultValue)
  }, [defaultValue, isOpen])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isOpen])

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel?.()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onCancel])

  const handleSubmit = (e) => {
    e?.preventDefault()
    onConfirm?.(value)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-background border border-border rounded-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 border-b border-border/50 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Edit3 className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4">
            {message && <p className="text-sm text-muted-foreground mb-3">{message}</p>}
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              autoComplete="off"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border/50 px-6 py-3 bg-muted/20">
            <Button type="button" variant="outline" onClick={onCancel}>
              {cancelText}
            </Button>
            <Button type="submit">{confirmText}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
