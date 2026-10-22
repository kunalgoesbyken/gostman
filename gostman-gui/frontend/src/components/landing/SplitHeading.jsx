import { Fragment, useRef } from "react"
import { useReveal } from "../../lib/landingMotion"

export function SplitWords({ text, className }) {
  const words = text.split(" ")

  return (
    <span aria-hidden="true" className={className}>
      {words.map((word, index) => (
        <Fragment key={index}>
          <span className="split-word inline-block">{word}</span>
          {index < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </span>
  )
}

export function SplitHeading({ as: Tag = "h2", id, text, className }) {
  const ref = useRef(null)

  useReveal(ref, (gsap, element) => {
    gsap.from(element.querySelectorAll(".split-word"), {
      opacity: 0,
      y: 18,
      duration: 0.6,
      stagger: 0.05,
      ease: "power3.out",
      scrollTrigger: { trigger: element, start: "top 85%", once: true },
    })
  })

  return (
    <Tag ref={ref} id={id} aria-label={text} className={className}>
      <SplitWords text={text} />
    </Tag>
  )
}
