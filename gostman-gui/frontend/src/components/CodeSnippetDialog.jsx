import { useEffect, useState } from "react"
import { Check, Copy, X } from "lucide-react"
import { Button } from "./ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { SNIPPET_LANGUAGES } from "../lib/codeGenerator"

const COPIED_NOTICE_MS = 2000

export function CodeSnippetDialog({ snippets, onClose }) {
  const [languageId, setLanguageId] = useState(SNIPPET_LANGUAGES[0].id)
  const [copiedLanguageId, setCopiedLanguageId] = useState(null)

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  const copy = async () => {
    await navigator.clipboard.writeText(snippets[languageId])
    setCopiedLanguageId(languageId)
    setTimeout(() => setCopiedLanguageId(null), COPIED_NOTICE_MS)
  }

  const isCopied = copiedLanguageId === languageId

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Generate code"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl"
      >
        <Tabs value={languageId} onValueChange={setLanguageId} className="flex min-h-0 flex-col">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
            <TabsList>
              {SNIPPET_LANGUAGES.map((language) => (
                <TabsTrigger key={language.id} value={language.id}>{language.label}</TabsTrigger>
              ))}
            </TabsList>
            <Button size="sm" variant="outline" onClick={copy} className="ml-auto h-8 gap-1.5">
              {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {isCopied ? "Copied" : "Copy"}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {SNIPPET_LANGUAGES.map((language) => (
            <TabsContent key={language.id} value={language.id} noMargin className="min-h-0 flex-1 overflow-auto p-4 scrollbar-compact">
              <pre className="text-xs leading-relaxed">
                <code className="font-mono text-foreground">{snippets[language.id]}</code>
              </pre>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
