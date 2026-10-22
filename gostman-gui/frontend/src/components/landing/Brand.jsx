import logo from "../../assets/logo.jpg"

export function Brand({ tagline }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src={logo} alt="Gostman Logo" className="h-8 w-8 rounded-md" />
      {tagline ? (
        <div>
          <span className="font-medium text-sm">Gostman</span>
          <p className="text-xs text-muted-foreground/70 mt-0.5">{tagline}</p>
        </div>
      ) : (
        <span className="font-medium text-sm">Gostman</span>
      )}
    </div>
  )
}
