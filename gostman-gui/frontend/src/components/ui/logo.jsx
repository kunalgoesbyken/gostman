import mark from "../../assets/mark.png"

const markMask = `url(${mark}) center / contain no-repeat`

export function Logo({ className }) {
  return (
    <span
      aria-hidden="true"
      style={{ mask: markMask, WebkitMask: markMask }}
      className={`inline-block shrink-0 bg-brand ${className ?? ""}`}
    />
  )
}
