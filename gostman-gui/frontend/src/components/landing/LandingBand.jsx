import { cn } from "../../lib/utils"

export function LandingBand({ id, labelledBy, isTinted, isEager, className, children }) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("relative border-t border-border/50 px-6", !isEager && "render-when-visible", isTinted ? "landing-gutter landing-gutter-tinted" : "landing-gutter")}>
      <div className={cn("mx-auto max-w-6xl border-border/60 py-16 sm:py-24 md:border-x md:px-12", isTinted ? "landing-surface-tinted" : "landing-surface", className)}>{children}</div>
    </section>
  )
}
