import { Fragment } from "react"

const wordStep = (index) => ({ "--word-step": index })

export function SplitWords({ text, className }) {
  const words = text.split(" ")

  return (
    <span aria-hidden="true" className={className}>
      {words.map((word, index) => (
        <Fragment key={index}>
          <span className="split-word inline-block" style={wordStep(index)}>
            {word}
          </span>
          {index < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </span>
  )
}

const HEADING_SIZES = {
  section: "text-3xl md:text-5xl",
  feature: "text-2xl md:text-3xl",
}

export function SplitHeading({ as: Tag = "h2", id, text, size = "section" }) {
  return (
    <Tag id={id} aria-label={text} className={`split-heading font-semibold tracking-tight [text-wrap:balance] ${HEADING_SIZES[size]}`}>
      <SplitWords text={text} />
    </Tag>
  )
}
