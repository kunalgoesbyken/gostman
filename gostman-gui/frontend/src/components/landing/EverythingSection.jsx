import { DownloadPanel } from "./DownloadPanel"
import { FeatureIndex } from "./FeatureIndex"
import { SectionLabel } from "./SectionLabel"
import { SplitHeading } from "./SplitHeading"

export function EverythingSection({ onGetStarted }) {
  return (
    <section id="download" className="render-when-visible relative px-6 py-24" aria-labelledby="included-heading">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 max-w-2xl">
          <SectionLabel number="002" label="Download" />
          <SplitHeading
            id="included-heading"
            text="Everything is in the download"
            className="text-3xl font-semibold tracking-tight md:text-5xl [text-wrap:balance]"
          />
          <p className="mt-5 leading-relaxed text-muted-foreground">
            Gostman is open source. Every feature below is included, with no licence key and no seat count.
          </p>
        </div>

        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
          <div className="lg:order-1">
            <FeatureIndex />
          </div>
          <div className="order-first lg:order-2">
            <div className="lg:sticky lg:top-28">
              <DownloadPanel onGetStarted={onGetStarted} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
