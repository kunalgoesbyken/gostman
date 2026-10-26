import { cn } from "../../lib/utils"
import { BrandIcon } from "../ui/brandIcon"
import { Logo } from "../ui/logo"
import { SectionLabel } from "./SectionLabel"
import { SplitHeading } from "./SplitHeading"

const TOOLS = [
  { brand: "postman", name: "Postman" },
  { brand: "claude", name: "Claude Code" },
  { brand: "github-actions", name: "GitHub Actions" },
  { brand: "openapi", name: "OpenAPI" },
  { brand: "vault", name: "HashiCorp Vault" },
  { brand: "cursor", name: "Cursor" },
  { brand: "insomnia", name: "Insomnia" },
  { brand: "docker", name: "Docker" },
  { brand: "bruno", name: "Bruno" },
  { brand: "openai", name: "OpenAI" },
  { brand: "github", name: "GitHub" },
  { brand: "onepassword", name: "1Password" },
  { brand: "gitlab", name: "GitLab" },
  { brand: "aws", name: "AWS Secrets Manager" },
  { brand: "linux", name: "Linux" },
  { brand: "macos", name: "macOS" },
  { brand: "windows", name: "Windows" },
  { brand: "azure", name: "Azure Key Vault" },
  { brand: "bitwarden", name: "Bitwarden" },
  { brand: "gcp", name: "Google Cloud Secret Manager" },
  { brand: "gemini", name: "Gemini" },
  { brand: "keepassxc", name: "KeePassXC" },
  { brand: "ollama", name: "Ollama" },
  { brand: "bitbucket", name: "Bitbucket" },
  { brand: "openrouter", name: "OpenRouter" },
]

const COLUMNS = 13
const ROWS = 4
const CENTER_COLUMN = Math.floor(COLUMNS / 2)
const CENTER_ROW = 1

const isLowered = (column) => (column - CENTER_COLUMN) % 2 === 0
const tileDistance = ({ column, row }) => Math.hypot((column - CENTER_COLUMN) * 1.2, row + (isLowered(column) ? 0.5 : 0) - CENTER_ROW - 0.5)

function layTiles() {
  const slots = Array.from({ length: COLUMNS * ROWS }, (_, index) => ({ column: index % COLUMNS, row: Math.floor(index / COLUMNS) }))
  const [center, ...nearest] = [...slots].sort((a, b) => tileDistance(a) - tileDistance(b))
  const toolOf = new Map(nearest.slice(0, TOOLS.length).map((slot, index) => [slot, TOOLS[index]]))
  const placed = slots.map((slot) => ({ ...slot, isCenter: slot === center, tool: toolOf.get(slot) }))
  return Array.from({ length: COLUMNS }, (_, column) => placed.filter((slot) => slot.column === column))
}

const TILE_COLUMNS = layTiles()

const TILE = "flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border"

function Tile({ slot }) {
  if (slot.isCenter) {
    return (
      <div className={cn(TILE, "border-border bg-muted")}>
        <Logo className="h-10 w-10" />
      </div>
    )
  }
  if (!slot.tool) return <div className={cn(TILE, "border-border/30 bg-card/40")} />
  return (
    <div title={slot.tool.name} className={cn(TILE, "border-border/50 bg-card text-muted-foreground transition-colors hover:text-foreground")}>
      <BrandIcon brand={slot.tool.brand} className="h-7 w-7" />
    </div>
  )
}

export function StackSection() {
  return (
    <section className="render-when-visible relative overflow-hidden px-6 py-24" aria-labelledby="stack-heading">
      <div className="mx-auto max-w-6xl text-center">
        <div className="flex justify-center">
          <SectionLabel number="005" label="Integrations" />
        </div>
        <SplitHeading id="stack-heading" text="Works with the tools you already use" className="text-3xl font-semibold tracking-tight md:text-5xl [text-wrap:balance]" />
        <p className="mx-auto mt-5 max-w-xl leading-relaxed text-muted-foreground">
          Import from other clients, read secrets from your vault, run checks in any CI and hand requests to your coding agent.
        </p>
      </div>
      <ul className="sr-only">
        {TOOLS.map((tool) => (
          <li key={tool.brand}>{tool.name}</li>
        ))}
      </ul>
      <div aria-hidden="true" className="stack-fade mt-14 flex justify-center gap-4">
        {TILE_COLUMNS.map((column, index) => (
          <div key={index} className={cn("flex shrink-0 flex-col gap-4", isLowered(index) && "translate-y-12")}>
            {column.map((slot) => (
              <Tile key={slot.row} slot={slot} />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
