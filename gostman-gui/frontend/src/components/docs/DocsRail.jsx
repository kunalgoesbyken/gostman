import { useEffect, useMemo, useRef } from "react"
import { DOCS_TEXT } from "../../lib/docsText"
import { classes, keepVisible } from "../../docs/classes"
import { useActiveHeading } from "../../docs/useActiveHeading"

export function DocsRail({ toc }) {
  const ids = useMemo(() => toc.map((entry) => entry.id), [toc])
  const active = useActiveHeading(ids)
  const ref = useRef(null)

  useEffect(() => {
    keepVisible(ref.current, ref.current?.querySelector('[aria-current="true"]'))
  }, [active])

  if (!toc.length) return null

  return (
    <nav ref={ref} aria-label={DOCS_TEXT.onThisPage} className="max-h-full overflow-y-auto pb-10 pr-2">
      <p className="text-xs font-medium text-muted-foreground">{DOCS_TEXT.onThisPage}</p>
      <ul className="mt-3 border-l border-border text-[0.8125rem]">
        {toc.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              aria-current={entry.id === active ? "true" : undefined}
              className={classes(
                "-ml-px block border-l py-1 leading-snug transition-colors",
                entry.depth > 2 ? "pl-6" : "pl-3",
                entry.id === active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
