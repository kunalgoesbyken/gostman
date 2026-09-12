import React, { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "./button"

/**
 * AlertDialog - A modal for displaying alerts/messages
 * Non-blocking alternative to native alert()
 */
export function AlertDialog({
  isOpen,
  title = "Notice",
  message,
  confirmText = "OK",
  onConfirm,
  variant = "default" // 'default' | 'info' | 'warning' | 'success'
}) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onConfirm?.()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onConfirm])

  if (!isOpen) return null

  const variantStyles = {
    default: {
      iconBg: "bg-primary/10",
      iconColor: "text-primary"
    },
    info: {
      iconBg: "bg-info/10",
      iconColor: "text-info"
    },
    warning: {
      iconBg: "bg-warning/10",
      iconColor: "text-warning"
    },
    success: {
      iconBg: "bg-success/10",
      iconColor: "text-success"
    }
  }

  const styles = variantStyles[variant] || variantStyles.default

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-gradient-to-b from-background to-muted/20 border border-border/50 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 border-b border-border/50 px-6 py-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${styles.iconBg}`}>
            <AlertTriangle className={`h-5 w-5 ${styles.iconColor}`} />
          </div>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{message}</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border/50 px-6 py-3 bg-muted/20">
          <Button onClick={onConfirm}>{confirmText}</Button>
        </div>
      </div>
    </div>
  )
}
