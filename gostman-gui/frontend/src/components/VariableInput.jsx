import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react"
import { CONTROL_BASE, CONTROL_SIZES } from "./ui/input"
import { useVariableMap } from "../hooks/useVariableMap"
import { applyCompletion, describeReference, findReferences, openReference, suggestNames } from "../lib/variables"
import { cn } from "../lib/utils"
import "./variables.css"

function Mirror({ text, variables, innerRef, className }) {
  const parts = useMemo(() => {
    const out = []
    let at = 0
    for (const ref of findReferences(text)) {
      if (ref.start > at) out.push(<span key={`t${at}`}>{text.slice(at, ref.start)}</span>)
      const defined = variables.has(ref.name)
      out.push(
        <span key={`v${ref.start}`} data-var={ref.name} className={defined ? "gm-var-ok" : "gm-var-missing"}>
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
      className="pointer-events-none z-50 max-w-xs break-all rounded-md border border-border bg-card px-2 py-1 font-mono text-xs text-foreground shadow-lg"
    >
      <span className="text-muted-foreground">{info.name}</span>
      <span className="text-muted-foreground"> = </span>
      {info.defined ? info.shown : <span className="text-warning">not defined in the active environment</span>}
    </div>
  )
}

function Suggestions({ names, variables, active, onPick }) {
  return (
    <ul
      role="listbox"
      className="absolute left-0 top-full z-50 mt-1 max-h-48 min-w-48 max-w-full overflow-auto rounded-md border border-border bg-card py-1 text-xs shadow-lg"
    >
      {names.map((name, index) => (
        <li
          key={name}
          role="option"
          aria-selected={index === active}
          onMouseDown={(event) => {
            event.preventDefault()
            onPick(name)
          }}
          className={cn("flex cursor-pointer items-center justify-between gap-3 px-2 py-1 font-mono", index === active && "bg-accent")}
        >
          <span className="text-foreground">{name}</span>
          <span className="truncate text-muted-foreground">{describeReference(name, variables).shown}</span>
        </li>
      ))}
    </ul>
  )
}

export const VariableInput = forwardRef(function VariableInput(
  { className, controlSize = "sm", value = "", onChange, onKeyDown, onBlur, onScroll, ...props },
  ref,
) {
  const variables = useVariableMap()
  const inputRef = useRef(null)
  const mirrorRef = useRef(null)
  const [open, setOpen] = useState(null)
  const [active, setActive] = useState(0)
  const [hover, setHover] = useState(null)
  useImperativeHandle(ref, () => inputRef.current)

  const text = String(value)
  const names = open ? suggestNames(variables, open.query) : []
  const showing = open && names.length > 0

  const syncScroll = useCallback(() => {
    const input = inputRef.current
    if (input && mirrorRef.current) mirrorRef.current.style.transform = `translateX(${-input.scrollLeft}px)`
  }, [])

  const refresh = (input) => {
    const caret = input.selectionStart ?? 0
    const reference = input.selectionEnd === caret ? openReference(input.value, caret) : null
    setOpen(reference && { ...reference, caret })
    setActive(0)
    requestAnimationFrame(syncScroll)
  }

  const emit = (next) => onChange?.({ target: { value: next } })

  const pick = (name) => {
    const input = inputRef.current
    const done = applyCompletion(input.value, open, open.caret, name)
    setOpen(null)
    emit(done.text)
    requestAnimationFrame(() => {
      input.setSelectionRange(done.caret, done.caret)
      syncScroll()
    })
  }

  const handleKeyDown = (event) => {
    if (showing) {
      const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
      if (step) {
        event.preventDefault()
        setActive((active + step + names.length) % names.length)
        return
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault()
        pick(names[active])
        return
      }
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        setOpen(null)
        return
      }
    }
    onKeyDown?.(event)
  }

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
      <Mirror text={text} variables={variables} innerRef={mirrorRef} className={look} />
      <input
        {...props}
        ref={inputRef}
        type="text"
        value={value}
        className={cn(look, "relative")}
        onChange={(event) => {
          onChange?.(event)
          refresh(event.target)
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") refresh(event.target)
        }}
        onClick={(event) => refresh(event.target)}
        onScroll={(event) => {
          syncScroll()
          onScroll?.(event)
        }}
        onBlur={(event) => {
          setOpen(null)
          setHover(null)
          onBlur?.(event)
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      />
      {hover && !showing && <Tooltip info={hover.info} anchor={hover.anchor} />}
      {showing && <Suggestions names={names} variables={variables} active={active} onPick={pick} />}
    </div>
  )
})
