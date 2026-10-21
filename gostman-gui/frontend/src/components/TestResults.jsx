import { AlertTriangle, Check, X } from "lucide-react"
import { Notice } from "./ui/panel"
import { cn } from "../lib/utils"

export const countPassed = (results) => results.filter((result) => result.passed).length

export const hasTestOutput = (tests) => Boolean(tests && (tests.results.length > 0 || tests.error))

export function TestRow({ result }) {
  const Icon = result.passed ? Check : X
  return (
    <li className="flex items-start gap-2 py-1 text-xs">
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", result.passed ? "text-success" : "text-destructive")} />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-foreground">{result.name}</p>
        {result.message && <p className="text-muted-foreground">{result.message}</p>}
      </div>
    </li>
  )
}

export function TestResults({ tests }) {
  return (
    <>
      {tests.error && <Notice tone="destructive" icon={AlertTriangle}>{tests.error}</Notice>}
      <div className="flex flex-col gap-3 p-3">
        {tests.results.length > 0 && (
          <ul aria-label="Test results">
            {tests.results.map((result, index) => <TestRow key={index} result={result} />)}
          </ul>
        )}
      </div>
    </>
  )
}
