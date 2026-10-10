import { cva } from "class-variance-authority"
import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[11px] font-medium",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        outline: "border border-border text-foreground",
        success: "bg-success/10 text-success",
        redirect: "bg-info/10 text-info",
        clientError: "bg-warning/10 text-warning",
        serverError: "bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge }
