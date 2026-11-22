import { BrandIcon } from "../ui/brandIcon"
import { FAQ } from "./faq"
import { FaqList } from "./FaqList"
import { InlineLink } from "./InlineLink"
import { LandingBand } from "./LandingBand"
import { SplitHeading } from "./SplitHeading"
import { ISSUES_URL } from "../../lib/siteLinks"
import { revealStep } from "./revealStep"

export function FaqSection() {
  return (
    <LandingBand id="faq" labelledBy="faq-heading" className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
      <div>
        <SplitHeading id="faq-heading" text="Questions before you switch" />
        <p className="landing-lead reveal-on-scroll mt-5" style={revealStep(1)}>
          Something else?{" "}
          <InlineLink href={ISSUES_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5">
            <BrandIcon brand="github" className="h-4 w-4" />
            Ask on GitHub
          </InlineLink>
          .
        </p>
      </div>

      <FaqList entries={FAQ} />
    </LandingBand>
  )
}
