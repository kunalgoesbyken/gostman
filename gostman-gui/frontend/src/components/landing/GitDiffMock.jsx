import { cn } from "../../lib/utils"
import { Check } from "./icons"
import { MockFrame, lineStyle } from "./MockFrame"

const CHANGES = [
  { kind: "same", text: "name: Current user" },
  { kind: "same", text: "method: GET" },
  { kind: "remove", text: "url: '{{base_url}}/me'" },
  { kind: "add", text: "url: '{{base_url}}/v2/me'" },
  { kind: "same", text: "assertions:" },
  { kind: "same", text: "  - expression: res.status" },
  { kind: "same", text: "    operator: eq" },
  { kind: "same", text: '    value: "200"' },
  { kind: "add", text: "  - expression: res.body.session" },
  { kind: "add", text: "    operator: isString" },
]

const COMMIT_MESSAGE = "Use /v2/me and check the session"

const KINDS = {
  add: { mark: "+", className: "bg-success/10 text-success", textClassName: "diff-type" },
  remove: { mark: "-", className: "bg-destructive/10 text-destructive", textClassName: "diff-strike" },
  same: { mark: "", className: "text-muted-foreground" },
}

const numbered = (changes) => {
  let number = 1
  let typed = 0
  return changes.map((change) => ({
    ...change,
    number: change.kind === "remove" ? "" : number++,
    typeStep: change.kind === "add" ? typed++ : 0,
  }))
}

const countOf = (kind) => CHANGES.filter((change) => change.kind === kind).length

const DIFF = numbered(CHANGES)

const lineMotion = (line, index) => ({ ...lineStyle(index), "--type-step": line.typeStep, "--type-chars": line.text.length })

function CommitBar() {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/60 py-2 pe-2 ps-4 font-mono text-xs">
      <span className="truncate text-muted-foreground">{COMMIT_MESSAGE}</span>
      <span className="grid shrink-0 [&>*]:[grid-area:1/1]">
        <span className="diff-pending rounded-md bg-primary px-2.5 py-1 text-primary-foreground">Commit and push</span>
        <span className="diff-done inline-flex items-center justify-end gap-1.5 px-2.5 py-1 text-success">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          Pushed
        </span>
      </span>
    </div>
  )
}

export function GitDiffMock() {
  return (
    <MockFrame
      title="account/current-user.yaml"
      label="A pull request diff of one request file: the URL changed and a check was added, then committed and pushed"
      className="diff-flow"
      action={
        <span className="diff-count pe-2.5 font-mono text-xs">
          <span className="text-success">+{countOf("add")}</span> <span className="text-destructive">-{countOf("remove")}</span>
        </span>
      }
    >
      <div className="flex-1 overflow-x-auto py-3 font-mono text-xs leading-relaxed sm:text-[0.8125rem]">
        {DIFF.map((line, index) => (
          <div key={index} style={lineMotion(line, index)} className={cn("mock-line grid grid-cols-[2.75rem_1.25rem_1fr] pe-4", KINDS[line.kind].className)}>
            <span className="select-none pe-3 text-end text-muted-foreground/50">{line.number}</span>
            <span className="select-none">{KINDS[line.kind].mark}</span>
            <span className={cn("justify-self-start whitespace-pre", KINDS[line.kind].textClassName)}>{line.text}</span>
          </div>
        ))}
      </div>
      <CommitBar />
    </MockFrame>
  )
}
