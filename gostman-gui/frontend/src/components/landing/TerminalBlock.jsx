import { Check, Copy } from "./icons"
import { useClipboardCopy } from "../../hooks/useClipboardCopy"
import { cn } from "../../lib/utils"
import { MockFrame, lineStyle } from "./MockFrame"

const LINE_TONES = {
  command: "text-foreground",
  muted: "text-muted-foreground",
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

function CommandLine({ line, style }) {
  return (
    <span style={style} className="mock-line my-0.5 flex items-center gap-2 text-foreground">
      <span aria-hidden="true" className="select-none text-muted-foreground">$</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{line.copy}</span>
      <CopyControl text={line.copy} label="Copy command" />
    </span>
  )
}

function OutputLine({ line, style }) {
  return <span style={style} className={cn("mock-line block min-h-[1.25em] whitespace-pre-wrap break-words", LINE_TONES[line.tone])}>{line.text}</span>
}

export function TerminalBlock({ title, header, lines, label, copyText, isPlaying }) {
  return (
    <MockFrame title={title} header={header} label={label} isPlaying={isPlaying} action={copyText && <CopyControl text={copyText} label="Copy file" />}>
      <pre className="flex-1 overflow-x-auto p-2.5 font-mono sm:p-4 text-xs leading-relaxed text-muted-foreground sm:text-[0.8125rem]">
        {lines.map((line, index) => (
          line.copy ? <CommandLine key={index} line={line} style={lineStyle(index)} /> : <OutputLine key={index} line={line} style={lineStyle(index)} />
        ))}
      </pre>
    </MockFrame>
  )
}
