import { forwardRef, useCallback, useId, useImperativeHandle, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CONTROL_BASE, CONTROL_SIZES } from "./ui/input"
import { placeBelow, useDismiss } from "./ui/select"
import { Textarea } from "./ui/textarea"
import { VariableCard } from "./VariableCard"
import { useVariableMap } from "../hooks/useVariableMap"
import { SECRET_TINT, applyCompletion, describeReference, findReferences, referenceAtCaret, referenceLook, suggestNames } from "../lib/variables"
import { cn } from "../lib/utils"
import "./variables.css"

const STEPS = { ArrowDown: 1, ArrowUp: -1 }
const NOTHING_ACTIVE = -1
const CARET_KEYS = new Set(["ArrowLeft", "ArrowRight", "Home", "End"])

const picksSuggestion = (event) => event.key === "Tab" || (event.key === "Enter" && !event.ctrlKey && !event.metaKey)

const asksForSuggestions = (event) => event.ctrlKey && event.code === "Space" && !event.altKey && !event.metaKey && !event.shiftKey

function Mirror({ text, variables, innerRef, className }) {
  const parts = useMemo(() => {
    const out = []
    let at = 0
    for (const ref of findReferences(text)) {
      if (ref.start > at) out.push(<span key={`t${at}`}>{text.slice(at, ref.start)}</span>)
      const look = referenceLook(ref.name, variables)
      out.push(
        <span key={`v${ref.start}`} data-var={ref.name} className={look.className} style={look.tint ? { [SECRET_TINT]: look.tint } : undefined} {...look.attributes}>
          {text.slice(ref.start, ref.end)}
        </span>,
      )
      at = ref.end
    }
    out.push(<span key="tail">{text.slice(at)}</span>)
    return out
  }, [text, variables])

  return (
    <div
      aria-hidden="true"
      dir="ltr"
      className={cn(className, "pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre !border-transparent !bg-transparent !text-transparent")}
    >
      <span ref={innerRef} className="inline-block">{parts}</span>
    </div>
  )
}

function Tooltip({ info, anchor }) {
  return (
    <div
      role="tooltip"
      style={{ position: "fixed", left: anchor.left, top: anchor.bottom + 4 }}
      className="pointer-events-none z-50 max-w-xs [overflow-wrap:anywhere] rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground shadow-lg"
    >
      <VariableCard info={info} />
    </div>
  )
}

const steppedIndex = (active, step, count) => (active === NOTHING_ACTIVE ? (step > 0 ? 0 : count - 1) : (active + step + count) % count)

function Suggestions({ id, names, detail, active, placement, listRef, onPick }) {
  return createPortal(
    <ul
      dir="ltr"
      ref={listRef}
      id={id}
      role="listbox"
      style={placement}
      className="fixed z-50 max-w-[min(32rem,calc(100vw-1rem))] overflow-auto rounded-md border border-border bg-card py-1 text-xs shadow-lg"
    >
      {names.map((name, index) => (
        <li
          key={name}
          id={`${id}-${index}`}
          role="option"
          aria-selected={index === active}
          onMouseDown={(event) => {
            event.preventDefault()
            onPick(name)
          }}
          className={cn("flex cursor-pointer items-center justify-between gap-3 px-2 py-1 font-mono", index === active && "bg-accent")}
        >
          <span className="text-foreground">{name}</span>
          <span className="truncate text-muted-foreground">{detail(name)}</span>
        </li>
      ))}
    </ul>,
    document.body,
  )
}

function useCompletion(fieldRef, { value, suggest, fileReads, onChange, onKeyDown, onBlur, onCaretMove }) {
  const variables = useVariableMap()
  const listRef = useRef(null)
  const listId = useId()
  const [open, setOpen] = useState(null)
  const [active, setActive] = useState(0)
  const close = useCallback(() => setOpen(null), [])
  useDismiss(open !== null, close, fieldRef, listRef)

  const names = open?.whole ? suggest(String(value)) : open ? suggestNames(variables, open.query, { fileReads, explicit: open.explicit }) : []
  const showing = open !== null && names.length > 0

  const refresh = (field, explicit = false) => {
    const caret = field.selectionStart ?? 0
    const reference = field.selectionEnd === caret ? referenceAtCaret(field.value, caret, explicit) : null
    const placement = placeBelow(field)
    if (reference) setOpen({ ...reference, caret, explicit, placement })
    else setOpen(suggest ? { whole: true, placement } : null)
    setActive(reference || field.value.trim() ? 0 : NOTHING_ACTIVE)
    if (onCaretMove) requestAnimationFrame(onCaretMove)
  }

  const pick = (name) => {
    const field = fieldRef.current
    const done = open.whole ? { text: name, caret: name.length } : applyCompletion(field.value, open, open.caret, name)
    close()
    onChange?.({ target: { value: done.text } })
    requestAnimationFrame(() => {
      field.setSelectionRange(done.caret, done.caret)
      onCaretMove?.()
    })
  }

  const handleKeyDown = (event) => {
    if (asksForSuggestions(event)) {
      event.preventDefault()
      refresh(event.currentTarget, true)
      return
    }
    if (!showing && suggest && event.key === "ArrowDown") {
      event.preventDefault()
      refresh(event.currentTarget)
      return
    }
    if (showing && STEPS[event.key]) {
      event.preventDefault()
      setActive(steppedIndex(active, STEPS[event.key], names.length))
      return
    }
    if (showing && names[active] && picksSuggestion(event)) {
      event.preventDefault()
      pick(names[active])
      return
    }
    if (showing && event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      close()
      return
    }
    onKeyDown?.(event)
  }

  const fieldProps = {
    ...(suggest && { role: "combobox", "aria-expanded": showing }),
    "aria-autocomplete": "list",
    "aria-controls": showing ? listId : undefined,
    "aria-activedescendant": showing && active !== NOTHING_ACTIVE ? `${listId}-${active}` : undefined,
    onChange: (event) => {
      onChange?.(event)
      refresh(event.target, Boolean(open?.explicit))
    },
    onKeyDown: handleKeyDown,
    onKeyUp: (event) => {
      if (CARET_KEYS.has(event.key)) refresh(event.target)
    },
    onClick: (event) => refresh(event.target),
    onBlur: (event) => {
      close()
      onBlur?.(event)
    },
  }

  const list = showing && (
    <Suggestions id={listId} names={names} detail={(name) => (open.whole ? "" : describeReference(name, variables).shown)} active={active} placement={open.placement} listRef={listRef} onPick={pick} />
  )

  return { variables, showing, fieldProps, list }
}

export const VariableInput = forwardRef(function VariableInput(
  { className, controlSize = "sm", value = "", fileReads = true, masked = false, suggest, onChange, onKeyDown, onBlur, onScroll, ...props },
  ref,
) {
  const inputRef = useRef(null)
  const mirrorRef = useRef(null)
  const [hover, setHover] = useState(null)
  useImperativeHandle(ref, () => inputRef.current)

  const syncScroll = useCallback(() => {
    const input = inputRef.current
    if (input && mirrorRef.current) mirrorRef.current.style.transform = `translateX(${-input.scrollLeft}px)`
  }, [])

  const leave = (event) => {
    setHover(null)
    onBlur?.(event)
  }

  const { variables, showing, fieldProps, list } = useCompletion(inputRef, { value, suggest, fileReads, onChange, onKeyDown, onBlur: leave, onCaretMove: syncScroll })

  const handleMouseMove = (event) => {
    const { clientX: x, clientY: y } = event
    const marks = mirrorRef.current?.querySelectorAll("[data-var]") ?? []
    for (const mark of marks) {
      const rect = mark.getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        setHover((current) => (current?.name === mark.dataset.var ? current : { info: describeReference(mark.dataset.var, variables), name: mark.dataset.var, anchor: rect }))
        return
      }
    }
    setHover(null)
  }

  const look = cn(CONTROL_BASE, CONTROL_SIZES[controlSize], className)

  return (
    <div className="relative min-w-0 flex-1">
      {!masked && <Mirror text={String(value)} variables={variables} innerRef={mirrorRef} className={look} />}
      <input
        dir="ltr"
        {...props}
        {...fieldProps}
        ref={inputRef}
        type={masked ? "password" : "text"}
        value={value}
        className={cn(look, "relative")}
        onScroll={(event) => {
          syncScroll()
          onScroll?.(event)
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      />
      {hover && !showing && <Tooltip info={hover.info} anchor={hover.anchor} />}
      {list}
    </div>
  )
})

export const VariableTextarea = forwardRef(function VariableTextarea(
  { value = "", fileReads = true, onChange, onKeyDown, onBlur, ...props },
  ref,
) {
  const textareaRef = useRef(null)
  useImperativeHandle(ref, () => textareaRef.current)
  const { fieldProps, list } = useCompletion(textareaRef, { value, fileReads, onChange, onKeyDown, onBlur })

  return (
    <>
      <Textarea dir="ltr" {...props} {...fieldProps} ref={textareaRef} value={value} />
      {list}
    </>
  )
})
