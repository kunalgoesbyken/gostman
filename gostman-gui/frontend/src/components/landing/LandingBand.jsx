import { cn } from "../../lib/utils"

export function LandingBand({ id, labelledBy, isTinted, className, children }) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("render-when-visible relative border-t border-border/50 px-6", isTinted ? "landing-gutter landing-gutter-tinted" : "landing-gutter")}>
      <div className={cn("mx-auto max-w-6xl border-border/60 py-24 md:border-x md:px-12", isTinted ? "landing-surface-tinted" : "landing-surface", className)}>{children}</div>
    </section>
  )
}
