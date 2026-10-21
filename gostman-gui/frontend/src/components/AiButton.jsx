import { Sparkles } from "lucide-react"
import { Button } from "./ui/button"

export function AiButton({ label, onClick, ...props }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} title={label} aria-label={label} {...props}>
      <Sparkles />
      AI
    </Button>
  )
}
