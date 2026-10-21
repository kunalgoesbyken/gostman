import { useRef } from "react"
import { gsap, useReveal } from "../../lib/landingMotion"

const OFFSETS = {
  up: { y: 40 },
  down: { y: -40 },
  left: { x: 40 },
  right: { x: -40 },
}

export const AnimatedSection = ({ children, className = "", delay = 0, direction = "up" }) => {
  const ref = useRef(null)

  useReveal(ref, (element) => {
    gsap.from(element, {
      opacity: 0,
      ...OFFSETS[direction],
      duration: 0.6,
      delay,
      ease: "power2.out",
      scrollTrigger: { trigger: element, start: "top 85%", once: true },
    })
  })

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
