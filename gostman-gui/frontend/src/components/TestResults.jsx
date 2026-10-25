import { AlertTriangle, Check, Info, X } from "lucide-react"
import { Notice, SectionLabel } from "./ui/panel"
import { CONTRACT_TEXT, TESTS_TEXT } from "../lib/checksText"
import { CONTRACT_KIND } from "../lib/contract"
import { cn } from "../lib/utils"

const NO_NOTES = []

export const countPassed = (results) => results.filter((result) => result.passed).length

export const hasTestOutput = (tests) => Boolean(tests && (tests.results.length > 0 || tests.error || tests.notes?.length > 0))

const isContract = (result) => result.kind === CONTRACT_KIND

export function TestRow({ result }) {
  const Icon = result.passed ? Check : X
  return (
    <li className="flex items-start gap-2 py-1 text-xs">
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", result.passed ? "text-success" : "text-destructive")} />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-foreground">{result.resolvedName || result.name}</p>
        {result.message && <p className="whitespace-pre-line text-muted-foreground">{result.message}</p>}
      </div>
    </li>
  )
}

function ResultList({ label, results }) {
  if (results.length === 0) return null
  return (
    <ul aria-label={label}>
      {results.map((result, index) => <TestRow key={index} result={result} />)}
    </ul>
  )
}

export function TestResults({ tests }) {
  const contract = tests.results.filter(isContract)
  const notes = tests.notes ?? NO_NOTES
  return (
    <>
      {tests.error && <Notice tone="destructive" icon={AlertTriangle}>{tests.error}</Notice>}
      {notes.map((note) => <Notice key={note} tone="muted" icon={Info}>{note}</Notice>)}
      <div className="flex flex-col gap-3 p-3">
        <ResultList label={TESTS_TEXT.results} results={tests.results.filter((result) => !isContract(result))} />
        {contract.length > 0 && (
          <section className="flex flex-col gap-1">
            <SectionLabel>{CONTRACT_TEXT.heading}</SectionLabel>
            <ResultList label={CONTRACT_TEXT.heading} results={contract} />
          </section>
        )}
      </div>
    </>
  )
}
