import { cn } from "../../lib/utils"
import { BrandIcon } from "../ui/brandIcon"

const SOURCES = [
  { name: "Postman", brand: "postman" },
  { name: "Insomnia", brand: "insomnia" },
  { name: "Bruno", brand: "bruno" },
  { name: "OpenAPI", brand: "openapi" },
  { name: "curl" },
  { name: "HAR" },
  { name: ".http" },
]

function Source({ source }) {
  return (
    <li className={cn("flex items-center gap-2.5 text-xl font-semibold tracking-tight text-muted-foreground/80", !source.brand && "font-mono font-medium")}>
      <BrandIcon brand={source.brand} className="h-6 w-6" />
      {source.name}
    </li>
  )
}

export function ImportSources({ className }) {
  return (
    <div className={cn("text-center", className)}>
      <p className="text-sm text-muted-foreground">Imports collections and specs from</p>
      <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
        {SOURCES.map((source) => (
          <Source key={source.name} source={source} />
        ))}
      </ul>
    </div>
  )
}
