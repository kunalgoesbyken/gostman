import { BrandStrip } from "../ui/brandIcon"
import { ChevronDown } from "./icons"
import { revealStep } from "./revealStep"

export function FaqList({ entries }) {
  return (
    <div className="divide-y divide-border/60 border-y border-border/60">
      {entries.map(({ question, answer, brands }, index) => (
        <details key={question} className="reveal-on-scroll group" style={revealStep(index)}>
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 font-medium [&::-webkit-details-marker]:hidden">
            {question}
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <p className="max-w-[65ch] pb-5 leading-relaxed text-muted-foreground">{answer}</p>
          <BrandStrip brands={brands} className="-mt-1 pb-5" />
        </details>
      ))}
    </div>
  )
}
