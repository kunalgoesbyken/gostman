import * as React from "react"
import { createPortal } from "react-dom"
import { Input } from "./input"
import { LIST_CLASS, OptionRow, placeBelow, useDismiss } from "./select"

const STEPS = { ArrowDown: 1, ArrowUp: -1 }

function matching(suggestions, query) {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return suggestions
  return suggestions.filter((suggestion) => suggestion.toLocaleLowerCase().includes(needle))
}

function stepIndex(index, step, count) {
  if (index === -1) return step > 0 ? 0 : count - 1
  return (index + step + count) % count
}

export function Combobox({ value, suggestions, onChange, onKeyDown, onBlur, ...props }) {
  const [placement, setPlacement] = React.useState(null)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const anchorRef = React.useRef(null)
  const listRef = React.useRef(null)
  const listId = React.useId()

  const shown = matching(suggestions, value)
  const isOpen = placement !== null && shown.length > 0
  const optionId = (index) => `${listId}-${index}`

  const close = React.useCallback(() => setPlacement(null), [])
  useDismiss(placement !== null, close, anchorRef, listRef)

  const open = () => {
    setActiveIndex(-1)
    setPlacement(placeBelow(anchorRef.current))
  }

  const choose = (suggestion) => {
    close()
    onChange({ target: { value: suggestion } })
  }

  const change = (event) => {
    onChange(event)
    open()
  }

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && isOpen) {
      event.stopPropagation()
      close()
      return
    }
    if (STEPS[event.key]) {
      event.preventDefault()
      if (isOpen) setActiveIndex(stepIndex(activeIndex, STEPS[event.key], shown.length))
      else open()
      return
    }
    if (event.key === "Enter" && isOpen && shown[activeIndex]) {
      event.preventDefault()
      choose(shown[activeIndex])
      return
    }
    onKeyDown?.(event)
  }

  const handleBlur = (event) => {
    close()
    onBlur?.(event)
  }

  return (
    <>
      <Input
        {...props}
        ref={anchorRef}
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-activedescendant={isOpen && activeIndex !== -1 ? optionId(activeIndex) : undefined}
        value={value}
        onChange={change}
        onClick={open}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      {isOpen && createPortal(
        <div ref={listRef} id={listId} role="listbox" style={placement} className={LIST_CLASS}>
          {shown.map((suggestion, index) => (
            <OptionRow
              key={suggestion}
              id={optionId(index)}
              entry={{ label: suggestion }}
              isSelected={suggestion === value}
              isActive={index === activeIndex}
              onChoose={() => choose(suggestion)}
              onPoint={() => setActiveIndex(index)}
            />
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
