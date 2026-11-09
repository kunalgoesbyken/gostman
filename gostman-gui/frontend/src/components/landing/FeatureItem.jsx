export function FeatureItem({ icon: Icon, title, text, children }) {
  return (
    <li className="flex min-w-0 flex-col border-t border-border/50 pt-6">
      <h3 className="flex items-center gap-2.5 font-medium tracking-tight">
        <Icon className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
      {children}
    </li>
  )
}
