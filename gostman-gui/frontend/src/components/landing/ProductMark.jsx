import { BrandIcon } from "../ui/brandIcon"
import { Logo } from "../ui/logo"
import { cn } from "../../lib/utils"

export function ProductMark({ product, className }) {
  return product.id === "gostman" ? <Logo className={cn("h-4 w-4 shrink-0", className)} /> : <BrandIcon brand={product.id} className={className} />
}
