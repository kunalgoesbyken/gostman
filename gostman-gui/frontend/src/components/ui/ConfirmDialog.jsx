import React, { useEffect } from "react"
import { AlertCircle } from "lucide-react"
import { Button } from "./button"

/**
 * ConfirmDialog - A modal for confirming actions
 * Non-blocking alternative to native confirm()
 */
export function ConfirmDialog({
  isOpen,
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default", // 'default' | 'destructive'
  onConfirm,
  onCancel
}) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel?.()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const isDestructive = variant === 'destructive'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-background border border-border rounded-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              isDestructive ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
            }`}>
              <AlertCircle className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{message}</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border/50 px-6 py-3 bg-muted/20">
          <Button variant="outline" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button
            variant={isDestructive ? 'destructive' : 'default'}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
