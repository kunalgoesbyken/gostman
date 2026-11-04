import { createRef, forwardRef, useRef } from "react"
import { BrandIcon } from "../ui/brandIcon"
import { Logo } from "../ui/logo"
import { cn } from "../../lib/utils"
import { AnimatedBeam } from "./AnimatedBeam"
import { groupNumber } from "./FeatureGroup"
import { revealStep } from "./revealStep"

const VAULT_BRANDS = ["vault", "aws", "azure", "gcp", "onepassword", "bitwarden", "keepassxc"]

const STEPS = [
  { title: "Reference", text: "The YAML file holds only the variable's name, so Git never sees the value." },
  { title: "Resolve", text: "At send time the value comes from your keychain or vault, on your machine." },
  { title: "Redact", text: "Coding agents, run reports and share links see it masked." },
]

const Card = forwardRef(function Card({ title, value, className }, ref) {
  return (
    <div ref={ref} className={cn("relative z-10 justify-self-center rounded-md border border-border/70 bg-background px-3 py-2 font-mono text-xs", className)}>
      <span className="text-muted-foreground">{title}</span>
      <div className="mt-1 text-foreground">{value}</div>
    </div>
  )
})

const Circle = forwardRef(function Circle({ className, children }, ref) {
  return (
    <div ref={ref} className={cn("relative z-10 flex items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground", className)}>
      {children}
    </div>
  )
})

function Diagram() {
  const containerRef = useRef(null)
  const fileRef = useRef(null)
  const gostmanRef = useRef(null)
  const apiRef = useRef(null)
  const storeRefs = useRef(VAULT_BRANDS.map(() => createRef())).current

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="A request file holds {{token}}. Gostman reads the value from your keychain or vault at send time and sends it to the API."
      className="relative grid items-center gap-x-4 gap-y-12 px-4 py-12 [grid-template-areas:'file_api'_'machine_machine'] md:grid-cols-[1fr_auto_1fr] md:gap-x-16 md:px-10 md:[grid-template-areas:'file_machine_api']"
    >
      <Card ref={fileRef} title="request.yaml" value={`Bearer {{token}}`} className="[grid-area:file]" />
      <div className="flex flex-col items-center gap-10 justify-self-center rounded-lg border border-dashed border-primary/40 px-4 pb-4 pt-3 [grid-area:machine]">
        <span className="landing-eyebrow self-start text-3xs">Your machine</span>
        <Circle ref={gostmanRef} className="size-16 text-primary">
          <Logo className="h-8 w-8" />
        </Circle>
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-1.5 md:gap-2">
            {VAULT_BRANDS.map((brand, index) => (
              <Circle key={brand} ref={storeRefs[index]} className="size-8 md:size-9">
                <BrandIcon brand={brand} className="h-4 w-4" />
              </Circle>
            ))}
          </div>
          <span className="font-mono text-2xs text-muted-foreground">Keychain or vault</span>
        </div>
      </div>
      <Card ref={apiRef} title="API" value="Bearer eyJh…" className="[grid-area:api]" />
      <AnimatedBeam containerRef={containerRef} fromRef={fileRef} toRef={gostmanRef} className="text-muted-foreground" />
      {storeRefs.map((storeRef, index) => (
        <AnimatedBeam key={VAULT_BRANDS[index]} containerRef={containerRef} fromRef={storeRef} toRef={gostmanRef} delay={0.6} className="text-primary" />
      ))}
      <AnimatedBeam containerRef={containerRef} fromRef={gostmanRef} toRef={apiRef} delay={1.2} className="text-primary" />
    </div>
  )
}

export function SecretFlow() {
  return (
    <div className="landing-frame overflow-hidden">
      <Diagram />
      <ol className="grid border-t border-border/60 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} style={revealStep(index)} className="reveal-on-scroll border-border/60 p-6 max-md:border-t max-md:first:border-t-0 md:border-s md:first:border-s-0">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{groupNumber(index)}</span>
            <h3 className="mt-2 font-medium">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
