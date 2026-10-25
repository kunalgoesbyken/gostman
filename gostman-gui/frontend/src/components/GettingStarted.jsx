import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, ExternalLink, ListChecks } from "lucide-react"
import { Button } from "./ui/button"
import { openExternal } from "../lib/about"
import { WEB_APP_URL } from "../lib/constants"
import { rememberWelcomeDismissed } from "../lib/welcome"
import { onboardingProgress } from "../lib/onboarding"
import { ONBOARDING_TEXT as TEXT } from "../lib/onboardingText"
import { cn } from "../lib/utils"
import { docPath, docSlug } from "../docs/manifest"
import { useAppStore } from "../store/appStore"
import { usePopoverDismiss } from "../hooks/usePopoverDismiss"
import { wrapTab } from "../hooks/useFocusTrap"
import "./variables.css"

const TUTORIAL_URL = `${WEB_APP_URL}${docPath(docSlug("tutorial-first-collection.md"))}`
const VIEWPORT_MARGIN = 8
const POPOVER_WIDTH = 320
const VARIABLE_LOOKS = { defined: "gm-var-ok", missing: "gm-var-missing" }

export function useOnboardingProgress() {
  const requestHistory = useAppStore((s) => s.requestHistory)
  const requests = useAppStore((s) => s.requests)
  const collectionVariables = useAppStore((s) => s.collectionVariables)
  const environments = useAppStore((s) => s.environments)
  const globalEnvironments = useAppStore((s) => s.globalEnvironments)
  const onboardingSteps = useAppStore((s) => s.onboardingSteps)
  return useMemo(
    () => onboardingProgress({ requestHistory, requests, collectionVariables, environments, globalEnvironments, onboardingSteps }),
    [requestHistory, requests, collectionVariables, environments, globalEnvironments, onboardingSteps]
  )
}

export function useOnboardingCompletion() {
  const hydrated = useAppStore((s) => s.hydrated)
  const isDismissed = useAppStore((s) => s.welcomeDismissed)
  const showNotice = useAppStore((s) => s.showNotice)
  const isRunnerOpen = useAppStore((s) => s.runner.isOpen)
  const { isComplete } = useOnboardingProgress()
  const wasComplete = useRef(null)
  const isNoticeDue = useRef(false)

  useEffect(() => {
    if (!hydrated) {
      wasComplete.current = null
      return
    }
    if (wasComplete.current === false && isComplete && !isDismissed) isNoticeDue.current = true
    wasComplete.current = isComplete
    if (isComplete) rememberWelcomeDismissed()
    if (isNoticeDue.current && !isRunnerOpen) {
      isNoticeDue.current = false
      showNotice(TEXT.completeNotice)
    }
  }, [hydrated, isComplete, isDismissed, isRunnerOpen, showNotice])
}

function ProgressBar({ done, total }) {
  return (
    <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={TEXT.title} aria-valuetext={TEXT.progress(done, total)} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${(done / total) * 100}%` }} />
    </div>
  )
}

function StepMarker({ number, isDone, isNext }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-3xs font-semibold",
        isDone && "border-success bg-success text-success-foreground",
        isNext && "border-primary text-primary",
        !isDone && !isNext && "border-border text-muted-foreground"
      )}
    >
      {isDone ? <Check className="h-3 w-3" /> : number}
    </span>
  )
}

function VariableLegend({ entries }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {entries.map((entry) => (
        <li key={entry.name} className="flex items-center gap-1.5">
          <code className={cn("px-1 font-mono text-foreground", VARIABLE_LOOKS[entry.look])}>{entry.name}</code>
          {entry.label}
        </li>
      ))}
    </ul>
  )
}

function Step({ id, number, isDone, isNext, onBegin }) {
  const text = TEXT.steps[id]
  return (
    <li className={cn("flex gap-3 rounded-md px-2 py-2", isNext && "bg-accent")} aria-current={isNext ? "step" : undefined}>
      <StepMarker number={number} isDone={isDone} isNext={isNext} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-xs font-medium leading-5", isDone && "text-muted-foreground")}>
          {isDone && <span className="sr-only">{TEXT.done}: </span>}
          {text.title}
        </p>
        {isNext && (
          <>
            <p className="mt-0.5 text-xs text-muted-foreground">{text.hint}</p>
            {text.legend && <VariableLegend entries={text.legend} />}
            <Button size="sm" className="mt-2" onClick={() => onBegin(id)}>{text.action}</Button>
          </>
        )}
      </div>
    </li>
  )
}

function TutorialLink() {
  return (
    <a
      href={TUTORIAL_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => openExternal(event, TUTORIAL_URL)}
      className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
    >
      {TEXT.tutorial}
      <ExternalLink className="h-3 w-3" />
    </a>
  )
}

function Completed() {
  return (
    <div className="flex gap-3">
      <StepMarker isDone />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium leading-5">{TEXT.completeTitle}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{TEXT.completeHint}</p>
      </div>
    </div>
  )
}

export function GettingStartedChecklist({ progress, onBegin, onHide }) {
  const { steps, doneCount, nextId, isComplete } = progress
  return (
    <section aria-label={TEXT.title} className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h3 className="text-xs font-semibold">{TEXT.title}</h3>
        <span className="text-xs text-muted-foreground">{TEXT.progress(doneCount, steps.length)}</span>
        {onHide && (
          <Button variant="ghost" size="sm" className="ms-auto" title={TEXT.hideLabel} onClick={onHide}>
            {TEXT.hide}
          </Button>
        )}
      </div>
      <ProgressBar done={doneCount} total={steps.length} />
      {isComplete ? (
        <Completed />
      ) : (
        <ol className="-mx-2 flex flex-col gap-0.5">
          {steps.map((step, index) => (
            <Step key={step.id} id={step.id} number={index + 1} isDone={step.isDone} isNext={step.id === nextId} onBegin={onBegin} />
          ))}
        </ol>
      )}
      <TutorialLink />
    </section>
  )
}

function Popover({ anchor, buttonRef, onClose, children }) {
  const popoverRef = useRef(null)
  usePopoverDismiss(popoverRef, buttonRef, onClose)
  useEffect(() => {
    const popover = popoverRef.current
    const target = popover.querySelector("[aria-current=step] button") || popover.querySelector("button, a")
    target?.focus()
  }, [])
  const width = Math.min(POPOVER_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2)
  const left = Math.max(VIEWPORT_MARGIN, Math.min(anchor.right - width, window.innerWidth - width - VIEWPORT_MARGIN))
  const style = { top: anchor.bottom + VIEWPORT_MARGIN / 2, left, width }
  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={TEXT.title}
      data-surface="menu"
      onKeyDown={(event) => event.key === "Tab" && wrapTab(event, popoverRef.current)}
      style={style}
      className="fixed z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto rounded-md border border-border bg-background p-3 shadow-lg"
    >
      {children}
    </div>,
    document.body
  )
}

export function GettingStartedButton({ onBegin }) {
  const hydrated = useAppStore((s) => s.hydrated)
  const isDismissed = useAppStore((s) => s.welcomeDismissed)
  const hideWelcome = useAppStore((s) => s.hideWelcome)
  const progress = useOnboardingProgress()
  const [anchor, setAnchor] = useState(null)
  const buttonRef = useRef(null)
  const close = useCallback(() => setAnchor(null), [])

  if (!hydrated || isDismissed || progress.isComplete) return null

  const toggle = () => setAnchor(anchor ? null : buttonRef.current.getBoundingClientRect())
  const begin = (id) => {
    close()
    onBegin(id)
  }
  const nextTitle = TEXT.steps[progress.nextId].title

  return (
    <>
      <Button
        ref={buttonRef}
        variant="outline"
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchor)}
        title={`${TEXT.next}: ${nextTitle}`}
        onClick={toggle}
        className="min-w-0 shrink"
      >
        <ListChecks />
        <span className="hidden truncate xl:inline">{TEXT.next}: {nextTitle}</span>
        <span className="max-sm:sr-only xl:hidden">{TEXT.title}</span>
        <span className="text-muted-foreground">{progress.doneCount}/{progress.steps.length}</span>
      </Button>
      {anchor && (
        <Popover anchor={anchor} buttonRef={buttonRef} onClose={close}>
          <GettingStartedChecklist progress={progress} onBegin={begin} onHide={hideWelcome} />
        </Popover>
      )}
    </>
  )
}
