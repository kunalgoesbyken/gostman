import { useState } from "react"
import { CopyTextButton } from "./CopyTextButton"
import { Dialog, DialogBody, DialogHeader } from "./ui/dialog"
import { Select } from "./ui/select"
import { SNIPPET_LANGUAGES } from "../lib/codeGenerator"

export function CodeSnippetDialog({ snippets, onClose }) {
  const [languageId, setLanguageId] = useState(SNIPPET_LANGUAGES[0].id)

  return (
    <Dialog label="Generate code" size="lg" onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <Select aria-label="Language" className="w-44" value={languageId} onChange={(event) => setLanguageId(event.target.value)}>
          {SNIPPET_LANGUAGES.map((language) => (
            <option key={language.id} value={language.id}>{language.label}</option>
          ))}
        </Select>
        <span className="flex-1" />
        <CopyTextButton text={snippets[languageId]} />
      </DialogHeader>
      <DialogBody>
        <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">{snippets[languageId]}</pre>
      </DialogBody>
    </Dialog>
  )
}
