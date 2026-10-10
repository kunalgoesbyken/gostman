import { useState } from "react"
import { CopyTextButton } from "./CopyTextButton"
import { Dialog, DialogBody, DialogHeader } from "./ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs"
import { SNIPPET_LANGUAGES } from "../lib/codeGenerator"

export function CodeSnippetDialog({ snippets, onClose }) {
  const [languageId, setLanguageId] = useState(SNIPPET_LANGUAGES[0].id)

  return (
    <Dialog label="Generate code" size="lg" onClose={onClose}>
      <Tabs value={languageId} onValueChange={setLanguageId} className="flex min-h-0 flex-1 flex-col">
        <DialogHeader onClose={onClose}>
          <TabsList label="Language" className="flex-1">
            {SNIPPET_LANGUAGES.map((language) => (
              <TabsTrigger key={language.id} value={language.id}>{language.label}</TabsTrigger>
            ))}
          </TabsList>
          <CopyTextButton text={snippets[languageId]} />
        </DialogHeader>
        <DialogBody>
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">{snippets[languageId]}</pre>
        </DialogBody>
      </Tabs>
    </Dialog>
  )
}
