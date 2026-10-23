import logo from "../../assets/logo.webp"

export function Brand({ tagline }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src={logo} alt="Gostman Logo" className="h-8 w-8 rounded-md" />
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
