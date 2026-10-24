import { BrandIcon, BrandStrip } from "../ui/brandIcon"
import { FAQ } from "./faq"
import { ChevronDown } from "./icons"
import { SplitHeading } from "./SplitHeading"
import { ISSUES_URL } from "../../lib/siteLinks"

export function FaqSection() {
  return (
    <section id="faq" className="render-when-visible relative px-6 py-24" aria-labelledby="faq-heading">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
        <div>
          <SplitHeading
            id="faq-heading"
            text="Questions before you switch"
            className="text-3xl font-semibold tracking-tight md:text-4xl [text-wrap:balance]"
          />
          <p className="mt-5 leading-relaxed text-muted-foreground">
            Something else?{" "}
            <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-foreground underline underline-offset-4 hover:text-primary">
              <BrandIcon brand="github" className="h-4 w-4" />
              Ask on GitHub
            </a>
            .
          </p>
        </div>

        <div className="divide-y divide-border/60 border-y border-border/60">
          {FAQ.map(({ question, answer, brands }) => (
            <details key={question} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 font-medium [&::-webkit-details-marker]:hidden">
                {question}
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="max-w-[65ch] pb-5 leading-relaxed text-muted-foreground">{answer}</p>
              <BrandStrip brands={brands} className="-mt-1 pb-5" />
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
