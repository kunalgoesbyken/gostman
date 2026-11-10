import { Braces } from "lucide-react"
import { Button } from "./ui/button"
import { Notice } from "./ui/panel"
import { FORMATTED_TYPE_NAMES } from "../lib/body"
import { BODY_TEXT } from "../lib/bodyText"
import { chordLabel } from "../lib/chords"
import { isApplePlatform } from "../lib/platform"

const FORMAT_CHORD = { shift: true, alt: true, key: "f" }

const problemText = (type, error) => (error.column === undefined ? BODY_TEXT.cannotFormat(type, error) : BODY_TEXT.cannotFormatAt(type, error))

export function FormatButton({ language, describe = BODY_TEXT.formatTitle, disabled, onClick, className }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      title={describe(FORMATTED_TYPE_NAMES[language], chordLabel(FORMAT_CHORD, isApplePlatform()))}
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      <Braces />
      {BODY_TEXT.format}
    </Button>
  )
}

export function FormatProblem({ language, error, onReveal }) {
  return (
    <Notice tone="destructive">
      {problemText(FORMATTED_TYPE_NAMES[language], error)}
      {error.offset !== undefined && (
        <button type="button" onClick={() => onReveal(error.offset)} className="ms-2 underline">
          {BODY_TEXT.goToLine(error.line)}
        </button>
      )}
    </Notice>
  )
}
