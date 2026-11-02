import { HighlightedText } from "./HighlightedText"
import { LargeText } from "./LargeText"
import { LARGE_BODY_CHARS } from "../lib/largeText"

export function TextBody({ text, highlight }) {
  if (text.length > LARGE_BODY_CHARS) return <LargeText text={text} highlight={highlight} />
  return (
    <pre dir="ltr" className="whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed text-foreground">
      {highlight
        ? <HighlightedText text={text} matches={highlight.matches} length={highlight.length} activeIndex={highlight.index} />
        : text}
    </pre>
  )
}
