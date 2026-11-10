import { useState } from "react"
import { CopyTextButton } from "./CopyTextButton"
import { toolWindow } from "../lib/dialogWindows"
import { Dialog, DialogBody, DialogHeader } from "./ui/dialog"
import { Download } from "lucide-react"
import { Button } from "./ui/button"
import { Select } from "./ui/select"
import { BODY_SNIPPET_ID, SNIPPET_LANGUAGES, rememberLanguage, rememberedLanguage } from "../lib/codeGenerator"
import { REQUEST_BAR_TEXT } from "../lib/requestBarText"

const CODE_WINDOW = toolWindow("code")
const BODY_FILE_NAME = "request-body.txt"
const BODY_FILE_TYPE = "text/plain"

const isCodeLanguage = (id) => SNIPPET_LANGUAGES.some((language) => language.id === id)

export function CodeSnippetDialog({ snippets, onSaveFile, onClose }) {
  const [languageId, setLanguageId] = useState(rememberedLanguage)

  const chooseLanguage = (id) => {
    setLanguageId(id)
    if (isCodeLanguage(id)) rememberLanguage(id)
  }

  return (
    <Dialog label={REQUEST_BAR_TEXT.codeHint} size="lg" floating={CODE_WINDOW} onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <Select aria-label={REQUEST_BAR_TEXT.codeLanguage} className="w-44" value={languageId} onChange={(event) => chooseLanguage(event.target.value)}>
          {SNIPPET_LANGUAGES.map((language) => (
            <option key={language.id} value={language.id}>{language.label}</option>
          ))}
          <option value={BODY_SNIPPET_ID}>{REQUEST_BAR_TEXT.codeBody}</option>
        </Select>
        <span className="flex-1" />
        {languageId === BODY_SNIPPET_ID && (
          <Button variant="outline" size="sm" disabled={!snippets[languageId]} onClick={() => onSaveFile(BODY_FILE_NAME, snippets[languageId], BODY_FILE_TYPE)}>
            <Download />
            {REQUEST_BAR_TEXT.codeSave}
          </Button>
        )}
        <CopyTextButton text={snippets[languageId]} />
      </DialogHeader>
      <DialogBody>
        <pre dir="ltr" className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">{snippets[languageId]}</pre>
      </DialogBody>
    </Dialog>
  )
}
