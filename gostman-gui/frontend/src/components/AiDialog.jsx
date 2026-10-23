import { useState } from "react"
import { ShieldCheck } from "lucide-react"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { Notice, SectionLabel } from "./ui/panel"
import { SegmentedControl } from "./ui/segmented"
import { Textarea } from "./ui/textarea"
import { SkeletonLines } from "./ui/skeleton"
import { formatSize } from "../lib/dataUtils"
import { hostOf, providerById } from "../lib/ai/providers"
import {
  STAGE_ERROR, STAGE_INPUT, STAGE_PREVIEW, STAGE_PROPOSAL, STAGE_RUNNING, useAiStore,
} from "../lib/ai/session"
import { SCRIPT_POST, SCRIPT_PRE, taskById } from "../lib/ai/tasks"
import { cn } from "../lib/utils"

const SCRIPT_KINDS = [
  { value: SCRIPT_PRE, label: "Pre-request" },
  { value: SCRIPT_POST, label: "Post-response" },
]

const REVIEW_NOTE = "AI-generated. Review before you accept. Nothing is sent, saved or run until you decide."
const VALUES_LABEL = "Include real response values (otherwise only the structure is sent)"
const SHAPE_LABEL = "Include the body values (up to 4 KB, secret-looking fields are masked)"

function InputStage({ task, input, actions }) {
  return (
    <div className="flex flex-col gap-3">
      {task.needsScriptKind && (
        <SegmentedControl label="Script" options={SCRIPT_KINDS} value={input.scriptKind} onChange={(scriptKind) => actions.setInput({ scriptKind })} />
      )}
      {task.needsText && (
        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          {task.inputLabel}
          <Textarea
            autoFocus
            rows={task.textLimit ? 10 : 4}
            value={input.text}
            placeholder={task.placeholder}
            onChange={(event) => actions.setInput({ text: event.target.value })}
          />
        </label>
      )}
      {task.offersValues && (
        <Checkbox checked={input.includeValues} onChange={(event) => actions.setInput({ includeValues: event.target.checked })} className="justify-start">
          {task.valuesByDefault ? SHAPE_LABEL : VALUES_LABEL}
        </Checkbox>
      )}
    </div>
  )
}

function PreviewStage({ dialog, host, skipNextTime, onSkipChange }) {
  const { scrubbed, tokens } = dialog.preview
  const bytes = new TextEncoder().encode(scrubbed.system + scrubbed.user).length
  return (
    <div className="flex flex-col gap-3">
      <Notice tone="muted" icon={ShieldCheck} edge="border">
        This is exactly what will be sent to {host}: about {formatSize(bytes)} ({tokens} tokens). Secrets are masked.
      </Notice>
      <SectionLabel>Instructions</SectionLabel>
      <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded border border-border bg-muted/40 p-2 font-mono text-xs">{scrubbed.system}</pre>
      <SectionLabel>Content</SectionLabel>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded border border-border bg-muted/40 p-2 font-mono text-xs">{scrubbed.user}</pre>
      <Checkbox checked={skipNextTime} onChange={(event) => onSkipChange(event.target.checked)} className="justify-start">
        Don't ask again for this action
      </Checkbox>
    </div>
  )
}

function RunningStage({ provider }) {
  return (
    <div role="status" className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Waiting for {provider.label}</p>
      <SkeletonLines className="p-0" />
    </div>
  )
}

function DiffPane({ label, text, compareTo }) {
  const known = new Set(compareTo.split("\n"))
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <SectionLabel>{label}</SectionLabel>
      <pre className="max-h-64 min-h-12 overflow-auto rounded border border-border bg-muted/40 p-2 font-mono text-xs">
        {text === "" ? <span className="text-muted-foreground">Empty</span> : text.split("\n").map((line, index) => (
          <div key={index} className={cn("whitespace-pre-wrap", !known.has(line) && "bg-success/15")}>{line || " "}</div>
        ))}
      </pre>
    </div>
  )
}

function Section({ section }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium">{section.label}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <DiffPane label="Current" text={section.before} compareTo="" />
        <DiffPane label="Proposed" text={section.after} compareTo={section.before} />
      </div>
    </div>
  )
}

function Block({ block }) {
  return (
    <div className="flex flex-col gap-1">
      <SectionLabel>{block.heading}</SectionLabel>
      {block.text && <p className="whitespace-pre-wrap text-sm">{block.text}</p>}
      {block.items && <ul className="list-disc pl-4 text-sm">{block.items.map((item) => <li key={item}>{item}</li>)}</ul>}
    </div>
  )
}

function Links({ links, onOpen }) {
  return (
    <ul className="flex flex-col gap-1">
      {links.map((link) => (
        <li key={link.label}>
          <button type="button" onClick={() => onOpen(link)} className="w-full rounded px-2 py-1.5 text-left hover:bg-accent">
            <span className="block truncate text-sm">{link.label}</span>
            <span className="block text-xs text-muted-foreground">{link.detail}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function ProposalStage({ proposal, actions }) {
  return (
    <div className="flex flex-col gap-4">
      {proposal.apply && <p className="text-xs text-muted-foreground">{REVIEW_NOTE}</p>}
      {proposal.sections?.map((section) => <Section key={section.label} section={section} />)}
      {proposal.blocks?.map((block) => <Block key={block.heading} block={block} />)}
      {proposal.links && <Links links={proposal.links} onOpen={actions.openLink} />}
    </div>
  )
}

function Footer({ dialog, task, actions, skipNextTime }) {
  if (dialog.stage === STAGE_INPUT) {
    const missing = task.needsText && !dialog.input.text.trim()
    return (
      <>
        <Button variant="outline" onClick={actions.cancel}>Cancel</Button>
        <Button disabled={missing} onClick={actions.submit}>Preview</Button>
      </>
    )
  }
  if (dialog.stage === STAGE_PREVIEW) {
    return (
      <>
        <Button variant="outline" onClick={actions.backToInput}>Back</Button>
        <Button onClick={() => actions.confirmPreview(skipNextTime)}>Send to AI</Button>
      </>
    )
  }
  if (dialog.stage === STAGE_RUNNING) return <Button variant="outline" onClick={actions.cancel}>Cancel</Button>
  if (dialog.stage === STAGE_ERROR) {
    return (
      <>
        <Button variant="outline" onClick={actions.cancel}>Close</Button>
        <Button onClick={actions.backToInput}>Try again</Button>
      </>
    )
  }
  return (
    <>
      <Button variant="outline" onClick={actions.cancel}>{dialog.proposal.apply ? "Discard" : "Close"}</Button>
      {dialog.proposal.apply && <Button onClick={actions.accept}>{dialog.proposal.applyLabel}</Button>}
    </>
  )
}

function Stage({ dialog, task, actions, host, skipNextTime, onSkipChange }) {
  if (dialog.stage === STAGE_INPUT) return <InputStage task={task} input={dialog.input} actions={actions} />
  if (dialog.stage === STAGE_PREVIEW) return <PreviewStage dialog={dialog} host={host} skipNextTime={skipNextTime} onSkipChange={onSkipChange} />
  if (dialog.stage === STAGE_RUNNING) return <RunningStage provider={providerById(dialog.provider)} />
  if (dialog.stage === STAGE_ERROR) return <p role="alert" className="text-sm text-destructive [overflow-wrap:anywhere]">{dialog.error}</p>
  if (dialog.stage === STAGE_PROPOSAL) return <ProposalStage proposal={dialog.proposal} actions={actions} />
  return null
}

export function AiDialog({ actions }) {
  const dialog = useAiStore((s) => s.dialog)
  const settings = useAiStore((s) => s.settings)
  const [skipNextTime, setSkipNextTime] = useState(false)
  const task = taskById(dialog.taskId)

  return (
    <Dialog label={task.label} size="lg" onClose={actions.cancel}>
      <DialogHeader onClose={actions.cancel}>
        <DialogTitle>{task.label}</DialogTitle>
        <span className="ml-auto mr-2 shrink-0 text-xs max-sm:hidden text-muted-foreground">AI: {providerById(settings.provider).label}</span>
      </DialogHeader>
      <DialogBody>
        <Stage
          dialog={dialog}
          task={task}
          actions={actions}
          host={hostOf(settings)}
          skipNextTime={skipNextTime}
          onSkipChange={setSkipNextTime}
        />
      </DialogBody>
      <DialogFooter>
        <Footer dialog={dialog} task={task} actions={actions} skipNextTime={skipNextTime} />
      </DialogFooter>
    </Dialog>
  )
}
