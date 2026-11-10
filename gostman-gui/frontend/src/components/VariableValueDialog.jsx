import { useState } from "react"
import { createPortal } from "react-dom"
import { CodeEditor } from "./CodeEditor"
import { FormatButton, FormatProblem } from "./FormatControls"
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { SegmentedControl } from "./ui/segmented"
import { useEditorFormatting } from "../hooks/useEditorFormatting"
import { isFormattedType } from "../lib/body"
import { toolWindow } from "../lib/dialogWindows"
import { ENVIRONMENT_TEXT as TEXT } from "../lib/environmentText"
import { documentTypeOf, documentTypeOptions } from "../lib/valueDocument"

const VALUE_WINDOW = toolWindow("variable-value")

export function VariableValueDialog({ name, value, onChange, onClose }) {
  const [type, setType] = useState(() => documentTypeOf(value))
  const formatting = useEditorFormatting(value, type)
  const title = TEXT.editorTitle(name)

  return createPortal(
    <Dialog label={title} size="lg" floating={VALUE_WINDOW} closesFromEditor onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{title}</DialogTitle>
        <SegmentedControl label={TEXT.documentType} options={documentTypeOptions()} value={type} onChange={setType} />
        {isFormattedType(type) && <FormatButton language={type} describe={TEXT.formatTitle} disabled={value.trim() === ""} onClick={formatting.format} className="ms-auto" />}
      </DialogHeader>
      {formatting.shownProblem && <FormatProblem language={type} error={formatting.shownProblem} onReveal={formatting.reveal} />}
      <div dir="ltr" className="min-h-0 flex-1">
        <CodeEditor
          ref={formatting.editorRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFormat={formatting.onFormat}
          language={type}
          variables
          height="100%"
          label={TEXT.value}
        />
      </div>
    </Dialog>,
    document.body
  )
}
