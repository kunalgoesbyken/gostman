import { Fragment } from "react"

export function RichText({ parts }) {
  return parts.map((part, index) => <Fragment key={index}>{part}</Fragment>)
}
