import { Fragment } from "react"
import { Check, Copy } from "lucide-react"
import { DOCS_TEXT } from "../../lib/docsText"
import { cn } from "../../lib/utils"

export function StaticCode({ lines, className }) {
  return (
    <div data-code-block className={cn("landing-frame relative min-w-0 bg-background", className)}>
      <pre className="whitespace-pre-wrap break-words py-3.5 pl-4 pr-12 font-mono text-xs leading-relaxed text-foreground sm:text-[0.8125rem]">
        <code>
          {lines.map((line, index) => (
            <Fragment key={index}>
              {index > 0 ? "\n" : null}
              <span className="before:select-none before:text-muted-foreground before:content-['$_']">{line}</span>
            </Fragment>
          ))}
        </code>
      </pre>
      <button type="button" data-copy-code className="code-copy absolute right-2 top-2" aria-label={DOCS_TEXT.code.copy} title={DOCS_TEXT.code.copy}>
        <Copy className="code-copy-idle h-3.5 w-3.5" aria-hidden="true" />
        <Check className="code-copy-done h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
