import { cn } from "../../lib/utils"
import { BrandIcon } from "../ui/brandIcon"

const SOURCES = [
  { name: "Postman", brand: "postman" },
  { name: "Insomnia", brand: "insomnia" },
  { name: "Bruno", brand: "bruno" },
  { name: "OpenAPI", brand: "openapi" },
  { name: "curl", brand: "curl" },
  { name: "Hoppscotch", brand: "hoppscotch" },
  { name: "HTTPie", brand: "httpie" },
  { name: "HAR" },
  { name: ".http" },
]

function Source({ source }) {
  return (
    <li className={cn("flex items-center gap-2 text-base font-semibold tracking-tight sm:text-lg text-muted-foreground/80", !source.brand && "font-mono font-medium")}>
      <BrandIcon brand={source.brand} className="h-5 w-5" />
      {source.name}
    </li>
  )
}

export function ImportSources({ className }) {
  return (
    <div className={cn("text-center", className)}>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Imports collections and specs from</p>
      <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-4 sm:gap-x-9">
        {SOURCES.map((source) => (
          <Source key={source.name} source={source} />
        ))}
      </ul>
    </div>
  )
}
