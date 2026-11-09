import { cn } from "../../lib/utils"

export function StaticCode({ title, lines, className }) {
  return (
    <figure className={cn("landing-frame min-w-0 overflow-hidden bg-background", className)}>
      {title ? (
        <figcaption className="flex h-9 items-center border-b border-border/60 px-4 font-mono text-xs text-muted-foreground">
          <span className="truncate">{title}</span>
        </figcaption>
      ) : null}
      <pre className="p-4 font-mono text-xs leading-relaxed text-foreground sm:text-[0.8125rem]">
        <code>
          {lines.map((line, index) => (
            <span key={index} className="block whitespace-pre-wrap break-words">
              <span aria-hidden="true" className="select-none text-muted-foreground">$ </span>
              {line}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  )
}
