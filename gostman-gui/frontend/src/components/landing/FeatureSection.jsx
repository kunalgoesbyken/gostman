import { BrandStrip } from "../ui/brandIcon"
import captureShot from "../../assets/landing/capture.webp"
import docsShot from "../../assets/landing/docs.webp"
import { AgentSection } from "./AgentSection"
import { GitDiffMock } from "./GitDiffMock"
import { ImageZoom } from "./ImageZoom"
import { SplitHeading } from "./SplitHeading"

const GIT_FEATURE = {
  title: "Git and secret managers, free",
  description: "Requests are YAML files you review in pull requests. Secret values come from your keychain or vault, never the file.",
  brands: ["github", "gitlab", "vault", "aws", "azure", "gcp", "onepassword", "bitwarden", "keepassxc"],
}

const PAIRED_FEATURES = [
  {
    title: "Real traffic becomes requests",
    description: "Point your app at Gostman, watch each call arrive and save the ones you need.",
    image: captureShot,
    width: 1400,
    height: 1000,
    alt: "The capture dialog listing five forwarded calls with the response of one shown below",
  },
  {
    title: "No account, even on the web",
    description: "Open the web app without signing up, and share a folder as an encrypted link or one HTML docs page.",
    image: docsShot,
    width: 1860,
    height: 1162,
    alt: "A generated documentation page with a sidebar of requests and the details of one",
  },
]

const HEADING = "text-2xl font-semibold tracking-tight md:text-3xl [text-wrap:balance]"

function FeatureText({ feature }) {
  return (
    <>
      <SplitHeading text={feature.title} className={HEADING} />
      <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">{feature.description}</p>
      <BrandStrip brands={feature.brands} className="mt-5" />
    </>
  )
}

function CroppedShot({ feature }) {
  return (
    <ImageZoom src={feature.image} alt={feature.alt} className="reveal-on-scroll mt-8">
      <img
        src={feature.image}
        alt={feature.alt}
        width={feature.width}
        height={feature.height}
        loading="lazy"
        decoding="async"
        className="aspect-[16/10] h-auto w-full rounded-lg border border-border/60 object-cover object-left-top"
      />
    </ImageZoom>
  )
}

export function FeatureSection() {
  return (
    <section id="features" className="render-when-visible relative px-6 py-24">
      <div className="mx-auto max-w-6xl space-y-28">
        <AgentSection />
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="min-w-0 lg:order-2 lg:col-span-5">
            <FeatureText feature={GIT_FEATURE} />
          </div>
          <div className="reveal-on-scroll min-w-0 lg:order-1 lg:col-span-7">
            <GitDiffMock />
          </div>
        </div>
        <div className="grid gap-16 md:grid-cols-2 md:gap-10">
          {PAIRED_FEATURES.map((feature) => (
            <div key={feature.title} className="min-w-0">
              <FeatureText feature={feature} />
              <CroppedShot feature={feature} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
