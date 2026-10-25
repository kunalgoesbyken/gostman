import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-offset-2",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-offset-2",
        outline: "border border-border bg-transparent hover:bg-accent aria-pressed:bg-secondary aria-pressed:text-secondary-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
        ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
      },
      size: {
        sm: "h-7 gap-1.5 px-2.5 text-xs [&_svg]:size-3.5",
        default: "h-8 gap-1.5 px-3 text-xs [&_svg]:size-3.5",
        lg: "h-12 gap-2 px-6 text-sm [&_svg]:size-4",
        "icon-xs": "h-6 w-6 rounded [&_svg]:size-3.5",
        "icon-sm": "h-7 w-7 [&_svg]:size-3.5",
        icon: "h-8 w-8 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, type = "button", ...props }, ref) => (
  <button type={type} className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
))
Button.displayName = "Button"

const IconButton = React.forwardRef(({ label, icon: Icon, size = "icon-sm", variant = "ghost", ...props }, ref) => (
  <Button ref={ref} size={size} variant={variant} aria-label={label} title={label} {...props}>
    <Icon />
  </Button>
))
IconButton.displayName = "IconButton"

export { Button, IconButton, buttonVariants }
