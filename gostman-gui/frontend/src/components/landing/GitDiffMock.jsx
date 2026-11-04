import { cn } from "../../lib/utils"
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

const KINDS = {
  add: { mark: "+", className: "bg-success/10 text-success" },
  remove: { mark: "-", className: "bg-destructive/10 text-destructive" },
  same: { mark: "", className: "text-muted-foreground" },
}

const numbered = (changes) => {
  let number = 1
  return changes.map((change) => ({ ...change, number: change.kind === "remove" ? "" : number++ }))
}

const countOf = (kind) => CHANGES.filter((change) => change.kind === kind).length

const DIFF = numbered(CHANGES)

export function GitDiffMock() {
  return (
    <MockFrame
      title="account/current-user.yaml"
      label="A pull request diff of one request file: the URL changed and a check was added"
      action={
        <span className="pe-2.5 font-mono text-xs">
          <span className="text-success">+{countOf("add")}</span> <span className="text-destructive">-{countOf("remove")}</span>
        </span>
      }
    >
      <div className="flex-1 overflow-x-auto py-3 font-mono text-xs leading-relaxed sm:text-[0.8125rem]">
        {DIFF.map((line, index) => (
          <div key={index} style={lineStyle(index)} className={cn("mock-line grid grid-cols-[2.75rem_1.25rem_1fr] pe-4", KINDS[line.kind].className)}>
            <span className="select-none pe-3 text-end text-muted-foreground/50">{line.number}</span>
            <span className="select-none">{KINDS[line.kind].mark}</span>
            <span className="whitespace-pre">{line.text}</span>
          </div>
        ))}
      </div>
    </MockFrame>
  )
}
