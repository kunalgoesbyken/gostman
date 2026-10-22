import { Check } from "./icons"

export function PointList({ points, className }) {
  return (
    <ul className={className}>
      {points.map((point) => (
        <li key={point} className="flex items-start gap-3 text-sm text-foreground/90">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success/80" aria-hidden="true" />
          <span>{point}</span>
        </li>
      ))}
    </ul>
  )
}
