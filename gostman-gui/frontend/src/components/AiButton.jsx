import { Button } from "./ui/button"

export function AiButton({ label, children, ...props }) {
  return (
    <Button variant="outline" size="sm" title={label} {...props}>
      {children}
    </Button>
  )
}
