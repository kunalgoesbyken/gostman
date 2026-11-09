import { BrandIcon } from "../ui/brandIcon"
import { cn } from "../../lib/utils"

export function LinkRow({ links, className }) {
  return (
    <p className={cn("flex flex-wrap gap-x-6 gap-y-2", className)}>
      {links.map((link) => (
        <a key={link.href} href={link.href} rel="noopener" className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline">
          <BrandIcon brand={link.brand} className="h-4 w-4" />
          {link.label}
        </a>
      ))}
    </p>
  )
}
