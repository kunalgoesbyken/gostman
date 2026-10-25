import { useState } from "react"
import { CopyTextButton } from "./CopyTextButton"
import { Dialog, DialogBody, DialogHeader } from "./ui/dialog"
import { Select } from "./ui/select"
import { SNIPPET_LANGUAGES, rememberLanguage, rememberedLanguage } from "../lib/codeGenerator"
import { REQUEST_BAR_TEXT } from "../lib/requestBarText"

export function CodeSnippetDialog({ snippets, onClose }) {
  const [languageId, setLanguageId] = useState(rememberedLanguage)

  const chooseLanguage = (id) => {
    setLanguageId(id)
    rememberLanguage(id)
  }

  return (
    <Dialog label={REQUEST_BAR_TEXT.codeHint} size="lg" onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <Select aria-label={REQUEST_BAR_TEXT.codeLanguage} className="w-44" value={languageId} onChange={(event) => chooseLanguage(event.target.value)}>
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
