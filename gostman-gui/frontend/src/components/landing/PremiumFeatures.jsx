import { Bot, GitBranch, Import, KeyRound, Lock, Network, Play, Server, Sparkles, Variable } from "lucide-react"
import { AI_AVAILABLE, AI_FEATURE, PREMIUM_FEATURES } from "./content"

const ICONS = { Bot, GitBranch, Import, KeyRound, Lock, Network, Play, Server, Sparkles, Variable }

function FeatureTile({ feature }) {
  const Icon = ICONS[feature.icon]
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-muted/30 text-foreground/80">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <h3 className="text-base font-medium">{feature.title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
    </li>
  )
}

export default function PremiumFeatures() {
  const features = AI_AVAILABLE ? [...PREMIUM_FEATURES, AI_FEATURE] : PREMIUM_FEATURES

  return (
    <section className="relative px-6 py-20" aria-labelledby="included-heading">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-xl">
          <h2 id="included-heading" className="text-3xl font-semibold tracking-tight md:text-4xl [text-wrap:balance]">
            Everything is in the download
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Gostman is open source. Every feature below is included, with no licence key and no seat count.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureTile key={feature.title} feature={feature} />
          ))}
        </ul>
      </div>
    </section>
  )
}
