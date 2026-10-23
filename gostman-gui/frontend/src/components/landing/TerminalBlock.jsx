import { Check, Copy } from "./icons"
import { useClipboardCopy } from "../../hooks/useClipboardCopy"
import { cn } from "../../lib/utils"

const LINE_TONES = {
  command: "text-foreground",
  muted: "text-muted-foreground/70",
  pass: "text-success",
  fail: "text-destructive",
  key: "text-syntax-key",
}

function CopyControl({ text, label, className }) {
  const { copied, copy } = useClipboardCopy(text)
  const Icon = copied ? Check : Copy
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground",
        className
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", copied && "text-success")} />
    </button>
  )
}

function CommandLine({ line }) {
  return (
    <span className="-mx-2 my-1 flex items-center gap-2 rounded-md bg-muted/30 py-1 pl-2 pr-1 text-foreground">
      <span aria-hidden="true" className="select-none text-muted-foreground">$</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{line.copy}</span>
      <CopyControl text={line.copy} label="Copy command" />
    </span>
  )
}

function OutputLine({ line }) {
  return <span className={cn("block min-h-[1.25em] whitespace-pre-wrap", LINE_TONES[line.tone])}>{line.text}</span>
}

export function TerminalBlock({ title, lines, label, copyText }) {
  return (
    <figure aria-label={label} className="overflow-hidden rounded-lg border border-border/60 bg-background">
      <figcaption className="flex h-10 items-center justify-between border-b border-border/60 pl-4 pr-1.5 font-mono text-xs text-muted-foreground">
        <span className="truncate">{title}</span>
        {copyText && <CopyControl text={copyText} label="Copy file" />}
      </figcaption>
      <pre className="overflow-x-auto p-4 font-mono text-[0.8125rem] leading-relaxed text-muted-foreground">
        {lines.map((line, index) => (
          line.copy ? <CommandLine key={index} line={line} /> : <OutputLine key={index} line={line} />
        ))}
      </pre>
    </figure>
  )
}
