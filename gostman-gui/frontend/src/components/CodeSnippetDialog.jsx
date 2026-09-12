import React, { useState, useEffect } from "react"
import { X, Copy, Check, Code2, Terminal } from "lucide-react"
import { Button } from "./ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"

const LANGUAGES = [
  { id: 'curl', label: 'cURL', icon: Terminal },
  { id: 'javascript', label: 'JavaScript', icon: Code2 },
  { id: 'python', label: 'Python', icon: Code2 },
  { id: 'go', label: 'Go', icon: Code2 },
]

export function CodeSnippetDialog({ snippets, onClose }) {
  const [copiedLang, setCopiedLang] = useState(null)

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleCopy = async (lang, code) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedLang(lang)
      setTimeout(() => setCopiedLang(null), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-gradient-to-b from-background to-muted/20 border border-border/50 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header with gradient */}
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-4 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20">
              <Code2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Export as Code</h2>
              <p className="text-xs text-muted-foreground">Copy code in your favorite language</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          <Tabs defaultValue="curl" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-5 bg-muted/50 p-1 rounded-xl">
              {LANGUAGES.map((lang) => {
                const Icon = lang.icon
                return (
                  <TabsTrigger key={lang.id} value={lang.id} className="gap-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Icon className="h-3.5 w-3.5" />
                    {lang.label}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {LANGUAGES.map((lang) => (
              <TabsContent key={lang.id} value={lang.id} className="mt-0 animate-in fade-in-50 duration-200">
                <div className="relative group">
                  {/* Code block with enhanced styling */}
                  <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-background rounded-xl" />
                  <pre className="relative overflow-x-auto rounded-xl p-5 text-sm leading-relaxed border border-white/5 shadow-xl">
                    <code className="font-mono text-foreground">{snippets[lang.id]}</code>
                  </pre>

                  {/* Floating copy button */}
                  <div className="absolute right-3 top-3">
                    <Button
                      size="sm"
                      onClick={() => handleCopy(lang.id, snippets[lang.id])}
                      className={`
                        gap-2 shadow-lg transition-all duration-200
                        ${copiedLang === lang.id
                          ? 'bg-success hover:bg-success text-white'
                          : 'bg-muted/80 hover:bg-muted text-foreground backdrop-blur-sm'
                        }
                      `}
                    >
                      {copiedLang === lang.id ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">Copy</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 bg-muted/30 border-t border-border/50">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 rounded bg-background border border-border/50 font-mono text-[10px]">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  )
}
