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

export function SplitHeading({ as: Tag = "h2", id, text, className }) {
  return (
    <Tag id={id} aria-label={text} className={`split-heading ${className}`}>
      <SplitWords text={text} />
    </Tag>
  )
}
