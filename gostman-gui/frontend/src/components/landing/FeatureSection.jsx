import { BrandStrip } from "../ui/brandIcon"
import captureShot from "../../assets/landing/capture.webp"
import docsShot from "../../assets/landing/docs.webp"
import { FeatureOverview } from "./FeatureOverview"
import { GitDiffMock } from "./GitDiffMock"
import { ImageZoom } from "./ImageZoom"
import { LandingBand } from "./LandingBand"
import { SecretFlow } from "./SecretFlow"
import { SplitHeading } from "./SplitHeading"

const HEADING = "text-2xl font-semibold tracking-tight md:text-3xl [text-wrap:balance]"

const shot = (image, width, height, alt) => (
  <ImageZoom src={image} alt={alt}>
    <img src={image} alt={alt} width={width} height={height} loading="lazy" decoding="async" className="h-auto w-full rounded-lg border border-border/60" />
  </ImageZoom>
)

const GIT_FEATURE = {
  title: "Collections are files in your repo",
  description: "One YAML file per request, reviewed in pull requests. Diff, commit and push from the app, free.",
  brands: ["github", "gitlab"],
  visual: <GitDiffMock />,
}

const SECRET_FEATURE = {
  title: "Secrets never touch the file",
  description: "Mark a variable as secret and only its name is saved. The value stays in your keychain or vault.",
}

const SCREENSHOT_FEATURES = [
  {
    title: "Real traffic becomes requests",
    description: "Point your app at Gostman, watch each call arrive and save the ones you need.",
    visual: shot(captureShot, 1400, 1000, "The capture dialog listing five forwarded calls with the response of one shown below"),
  },
  {
    title: "No account, even on the web",
    description: "Open the web app without signing up, and share a folder as an encrypted link or one HTML docs page.",
    visual: shot(docsShot, 1860, 1162, "A generated documentation page with a sidebar of requests and the details of one"),
  },
]

function FeatureText({ feature }) {
  return (
    <>
      <SplitHeading text={feature.title} className={HEADING} />
      <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">{feature.description}</p>
      <BrandStrip brands={feature.brands} className="mt-5" />
    </>
  )
}

function FeatureRow({ feature, isTinted }) {
  return (
    <LandingBand isTinted={isTinted} className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
      <div className="min-w-0 lg:col-span-4">
        <FeatureText feature={feature} />
      </div>
      <div className="reveal-on-scroll min-w-0 lg:col-span-8">{feature.visual}</div>
    </LandingBand>
  )
}

export function FeatureSection() {
  return (
    <div id="features">
      <FeatureRow feature={GIT_FEATURE} />
      <LandingBand isTinted>
        <FeatureText feature={SECRET_FEATURE} />
        <div className="reveal-on-scroll mt-10">
          <SecretFlow />
        </div>
      </LandingBand>
      {SCREENSHOT_FEATURES.map((feature, index) => (
        <FeatureRow key={feature.title} feature={feature} isTinted={index % 2 === 1} />
      ))}
      <LandingBand>
        <FeatureOverview />
      </LandingBand>
    </div>
  )
}
