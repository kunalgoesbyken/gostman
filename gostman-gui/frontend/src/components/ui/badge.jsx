import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/10 text-primary",
        secondary:
          "border-border bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive/10 text-destructive",
        outline: "text-foreground border-border",
        // HTTP method badges - simplified to 3 semantic colors
        get: "border-transparent bg-success/10 text-success border-success/20",
        post: "border-transparent bg-warning/10 text-warning border-warning/20",
        put: "border-transparent bg-warning/10 text-warning border-warning/20",
        delete: "border-transparent bg-destructive/10 text-destructive border-destructive/20",
        patch: "border-transparent bg-warning/10 text-warning border-warning/20",
        head: "border-transparent bg-success/10 text-success border-success/20",
        options: "border-transparent bg-success/10 text-success border-success/20",
        graphql: "border-transparent bg-primary/10 text-primary border-primary/20",
        // Status badges
        success: "border-transparent bg-success/10 text-success border-success/20",
        redirect: "border-transparent bg-primary/10 text-primary border-primary/20",
        clientError: "border-transparent bg-warning/10 text-warning border-warning/20",
        serverError: "border-transparent bg-destructive/10 text-destructive border-destructive/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
