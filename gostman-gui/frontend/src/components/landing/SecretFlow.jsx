import { BrandStrip } from "../ui/brandIcon"
import { groupNumber } from "./FeatureGroup"
import { ArrowRight } from "./icons"

const VAULT_BRANDS = ["vault", "aws", "azure", "gcp", "onepassword", "bitwarden", "keepassxc"]

const STEPS = [
  { title: "Reference", text: "The YAML file holds only the variable's name, so Git never sees the value." },
  { title: "Resolve", text: "At send time the value comes from your keychain or vault, on your machine." },
  { title: "Redact", text: "Coding agents, run reports and share links see it masked." },
]

const NODE = "rounded-md border border-border/70 bg-background px-3 py-2 font-mono text-xs"

function Link({ label }) {
  return (
    <div className="flex flex-col items-center gap-1 px-2 py-2 text-muted-foreground md:pt-0">
      <span className="font-mono text-[0.6875rem]">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 rotate-90 md:rotate-0" aria-hidden="true" />
    </div>
  )
}

function Diagram() {
  return (
    <div role="img" aria-label="A request file holds {{token}}. Gostman reads the value from your keychain or vault at send time and sends it to the API." className="flex flex-col items-center px-4 py-12 md:flex-row md:items-start md:justify-center">
      <div className={NODE}>
        <span className="text-muted-foreground">request.yaml</span>
        <div className="mt-1 text-foreground">Bearer {"{{token}}"}</div>
      </div>
      <Link label="name only" />
      <div className="flex flex-col items-center">
        <div className="rounded-md border border-dashed border-primary/40 p-3">
          <span className="block font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">Your machine</span>
          <div className={`${NODE} mt-2 text-foreground`}>Gostman</div>
          <div className="mx-auto h-5 w-px bg-border" />
          <div className={NODE}>
            <span className="text-muted-foreground">Keychain or vault</span>
            <BrandStrip brands={VAULT_BRANDS} className="mt-2 gap-2" />
          </div>
        </div>
      </div>
      <Link label="real value" />
      <div className={`${NODE} text-foreground`}>API</div>
    </div>
  )
}

export function SecretFlow() {
  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <Diagram />
      <ol className="grid border-t border-border/60 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="border-border/60 p-6 max-md:border-t max-md:first:border-t-0 md:border-s md:first:border-s-0">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{groupNumber(index)}</span>
            <h3 className="mt-2 font-medium">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
