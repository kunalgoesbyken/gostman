import { cn } from "../../lib/utils"

const TONES = {
  pass: { dot: "bg-success", pill: "bg-success/10 text-success" },
  fail: { dot: "bg-destructive", pill: "bg-destructive/10 text-destructive" },
}

export function ResultDot({ tone, className }) {
  return <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONES[tone].dot, className)} />
}

export function StatusPill({ tone, children }) {
  return <span className={cn("shrink-0 rounded px-1.5 py-0.5 font-mono text-[0.6875rem] font-medium", TONES[tone].pill)}>{children}</span>
}
