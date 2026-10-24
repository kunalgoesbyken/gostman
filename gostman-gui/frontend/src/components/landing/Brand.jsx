import { Logo } from "../ui/logo"

export function Brand({ tagline }) {
  return (
    <div className="flex items-center gap-2.5">
      <Logo className="h-8 w-8" />
      {tagline ? (
        <div>
          <span className="font-medium text-sm">Gostman</span>
          <p className="mt-0.5 text-xs text-muted-foreground">{tagline}</p>
        </div>
      ) : (
        <span className="font-medium text-sm">Gostman</span>
      )}
    </div>
  )
}
