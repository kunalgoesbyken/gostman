import { cn } from "../../lib/utils"

export const PRODUCT_CARD = "landing-frame flex min-w-0 flex-col bg-muted/20 p-6 transition-colors hover:border-border"

export function ProductCard({ icon: Icon, title, text, children, className }) {
  return (
    <li className={cn(PRODUCT_CARD, className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-background text-primary">
        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <h3 className="mt-5 font-medium tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
      {children}
    </li>
  )
}
