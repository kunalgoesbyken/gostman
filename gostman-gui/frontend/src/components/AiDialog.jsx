import { useState } from "react"
import { ShieldCheck } from "lucide-react"
import { BrandIcon } from "./ui/brandIcon"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { Notice, SectionLabel } from "./ui/panel"
import { SegmentedControl } from "./ui/segmented"
import { Textarea } from "./ui/textarea"
import { SkeletonLines } from "./ui/skeleton"
import { AI_TEXT } from "../lib/aiText"
import { formatSize } from "../lib/dataUtils"
import { hostOf, providerById } from "../lib/ai/providers"
import {
  STAGE_ERROR, STAGE_INPUT, STAGE_PREVIEW, STAGE_PROPOSAL, STAGE_RUNNING, useAiStore,
} from "../lib/ai/session"
import { SCRIPT_POST, SCRIPT_PRE, taskById } from "../lib/ai/tasks"
import { cn } from "../lib/utils"

const SCRIPT_KINDS = [
  { value: SCRIPT_PRE, label: AI_TEXT.preRequest },
  { value: SCRIPT_POST, label: AI_TEXT.postResponse },
]

const PRE_CLASS = "overflow-auto whitespace-pre-wrap rounded border border-border bg-muted/40 p-2 font-mono text-xs"

function Note({ text }) {
  return text ? <p className="text-xs text-muted-foreground">{text}</p> : null
}

function InputStage({ task, dialog, actions }) {
  const { input } = dialog
  return (
    <div className="flex flex-col gap-3">
      <Note text={dialog.note} />
      {task.needsScriptKind && (
        <SegmentedControl label={AI_TEXT.scriptLabel} options={SCRIPT_KINDS} value={input.scriptKind} onChange={(scriptKind) => actions.setInput({ scriptKind })} />
      )}
      {task.needsText && (
        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          {task.text.inputLabel}
          <Textarea
            autoFocus
            rows={task.longText ? 10 : 4}
            value={input.text}
            placeholder={task.text.placeholder}
            onChange={(event) => actions.setInput({ text: event.target.value })}
          />
        </label>
      )}
      {task.offersValues && (
        <Checkbox checked={input.includeValues} onChange={(event) => actions.setInput({ includeValues: event.target.checked })} className="h-auto items-start justify-start">
          {task.valuesByDefault ? AI_TEXT.includeBodyValues : AI_TEXT.includeValues}
        </Checkbox>
      )}
    </div>
  )
}

function PreviewStage({ dialog, host, skipNextTime, onSkipChange }) {
  const { scrubbed, tokens, includeValues } = dialog.preview
  const bytes = new TextEncoder().encode(scrubbed.system + scrubbed.user).length
  return (
    <div className="flex flex-col gap-3">
      <Notice tone="muted" icon={ShieldCheck} edge="border">
        {AI_TEXT.previewNote(host, formatSize(bytes), tokens)}
        {includeValues !== null && ` ${includeValues ? AI_TEXT.valuesIncluded : AI_TEXT.structureOnly}`}
      </Notice>
      <SectionLabel>{AI_TEXT.instructions}</SectionLabel>
      <pre className={cn("max-h-32", PRE_CLASS)}>{scrubbed.system}</pre>
      <SectionLabel>{AI_TEXT.content}</SectionLabel>
      <pre className={cn("max-h-64", PRE_CLASS)}>{scrubbed.user}</pre>
      {scrubbed.schema && (
        <>
          <SectionLabel>{AI_TEXT.replyFormat}</SectionLabel>
          <pre className={cn("max-h-32", PRE_CLASS)}>{JSON.stringify(scrubbed.schema, null, 2)}</pre>
        </>
      )}
      <Checkbox checked={skipNextTime} onChange={(event) => onSkipChange(event.target.checked)} className="h-auto items-start justify-start">
        {AI_TEXT.skipPreview}
      </Checkbox>
    </div>
  )
}

function RunningStage({ dialog }) {
  return (
    <div role="status" className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{dialog.waiting || AI_TEXT.waitingFor(providerById(dialog.provider).label)}</p>
      <SkeletonLines className="p-0" />
    </div>
  )
}

function DiffPane({ label, text, compareTo }) {
  const known = new Set(compareTo.split("\n"))
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <SectionLabel>{label}</SectionLabel>
      <pre className={cn("max-h-64 min-h-12", PRE_CLASS)}>
        {text === "" ? <span className="text-muted-foreground">{AI_TEXT.empty}</span> : text.split("\n").map((line, index) => (
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
        <DiffPane label={AI_TEXT.current} text={section.before} compareTo="" />
        <DiffPane label={AI_TEXT.proposed} text={section.after} compareTo={section.before} />
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
      <Note text={proposal.note || (proposal.apply ? AI_TEXT.reviewNote : "")} />
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
        <Button variant="outline" onClick={actions.cancel}>{AI_TEXT.cancel}</Button>
        <Button disabled={missing} onClick={actions.submit}>{AI_TEXT.preview}</Button>
      </>
    )
  }
  if (dialog.stage === STAGE_PREVIEW) {
    return (
      <>
        <Button variant="outline" onClick={actions.backToInput}>{AI_TEXT.back}</Button>
        <Button onClick={() => actions.confirmPreview(skipNextTime)}>{AI_TEXT.sendToAi}</Button>
      </>
    )
  }
  if (dialog.stage === STAGE_RUNNING) return <Button variant="outline" onClick={actions.cancel}>{AI_TEXT.cancel}</Button>
  if (dialog.stage === STAGE_ERROR) {
    return (
      <>
        <Button variant="outline" onClick={actions.cancel}>{AI_TEXT.close}</Button>
        <Button onClick={actions.backToInput}>{AI_TEXT.tryAgain}</Button>
      </>
    )
  }
  const { proposal } = dialog
  return (
    <>
      <Button variant="outline" onClick={actions.cancel}>{proposal.apply ? AI_TEXT.discard : AI_TEXT.close}</Button>
      {proposal.next && <Button variant="outline" onClick={actions.continueProposal}>{AI_TEXT.continueBatch}</Button>}
      {proposal.apply && <Button onClick={actions.accept}>{proposal.applyLabel}</Button>}
    </>
  )
}

function Stage({ dialog, task, actions, host, skipNextTime, onSkipChange }) {
  if (dialog.stage === STAGE_INPUT) return <InputStage task={task} dialog={dialog} actions={actions} />
  if (dialog.stage === STAGE_PREVIEW) return <PreviewStage dialog={dialog} host={host} skipNextTime={skipNextTime} onSkipChange={onSkipChange} />
  if (dialog.stage === STAGE_RUNNING) return <RunningStage dialog={dialog} />
  if (dialog.stage === STAGE_ERROR) return <p role="alert" className="text-sm text-destructive [overflow-wrap:anywhere]">{dialog.error}</p>
  if (dialog.stage === STAGE_PROPOSAL) return <ProposalStage proposal={dialog.proposal} actions={actions} />
  return null
}

export function AiDialog({ actions }) {
  const dialog = useAiStore((s) => s.dialog)
  const settings = useAiStore((s) => s.settings)
  const [skipNextTime, setSkipNextTime] = useState(false)
  const task = taskById(dialog.taskId)
  const provider = providerById(settings.provider)

  return (
    <Dialog label={task.text.label} size="lg" onClose={actions.cancel}>
      <DialogHeader onClose={actions.cancel}>
        <DialogTitle>{task.text.label}</DialogTitle>
        <span className="ml-auto mr-2 flex shrink-0 items-center gap-1 text-xs max-sm:hidden text-muted-foreground">
          <BrandIcon brand={settings.provider} />
          {AI_TEXT.providerLabel(provider.label)}
        </span>
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
